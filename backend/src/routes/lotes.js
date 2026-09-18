import { Router } from "express";
import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { generarCodigoLote } from "../lib/codigos.js";
import { emitirCodigoQrLote } from "../lib/codigosQr.js";
import { verificarIntegridadLote } from "../lib/cadenaBloques.js";
import { construirFichaLote } from "../lib/fichaLote.js";
import { httpError } from "../lib/errors.js";

const router = Router();

const TIPOS_PRODUCTO = ["cafe", "cacao"];
const MAX_INTENTOS_CODIGO = 5;

// Mismas 4 etapas con tabla de registro propia que usa /trazabilidad (ver
// routes/trazabilidad.js) -- certificacion_sanitaria no tiene tabla propia,
// esta embebida en la validacion de registros_procesamiento (SENASA es
// quien valida esa etapa, ver docs/CONTEXTO.md "Decision de alcance").
const ETAPAS_REGISTRO = [
  { etapa: "produccion", tabla: "registros_produccion" },
  { etapa: "acopio", tabla: "registros_acopio" },
  { etapa: "procesamiento", tabla: "registros_procesamiento" },
  { etapa: "exportacion", tabla: "registros_exportacion" },
];

function usuarioPublico(id) {
  if (!id) return null;
  return db.prepare("SELECT id, nombre, rol FROM usuarios WHERE id = ?").get(id) ?? null;
}

// Linea de tiempo del propio lote para el Productor: a diferencia de
// /trazabilidad/:codigo (publica), aqui SI se muestran etapas en borrador o
// todavia sin registro -- el productor necesita ver el progreso completo,
// no solo lo ya validado.
function lineaTiempoDeLote(loteId) {
  return ETAPAS_REGISTRO.map(({ etapa, tabla }) => {
    const registro = db
      .prepare(`SELECT * FROM ${tabla} WHERE lote_id = ? ORDER BY creado_en DESC LIMIT 1`)
      .get(loteId);
    if (!registro) return null;
    // motivo_rechazo es confidencial (solo el actor que creo el registro y
    // Administrador pueden verlo -- ver etapaRouter.js). Esta funcion sirve
    // TODAS las etapas del lote para el Productor, pero el Productor solo
    // es el actor real en 'produccion' -- en las otras 3 etapas (que el no
    // creo) solo se expone el booleano `fue_rechazado`, nunca el texto.
    const fueRechazado = Boolean(registro.rechazado_en);
    return {
      etapa,
      estado: registro.estado,
      fecha_registro: registro.creado_en,
      fecha_validacion: registro.validado_en,
      validado_por: usuarioPublico(registro.validado_por),
      fue_rechazado: fueRechazado,
      motivo_rechazo: etapa === "produccion" && fueRechazado ? registro.motivo_rechazo : null,
    };
  }).filter(Boolean);
}

function fotosDeLote(loteId) {
  return db
    .prepare(
      `SELECT f.id, f.url, f.creado_en
       FROM fotos_registro_produccion f
       JOIN registros_produccion rp ON rp.id = f.registro_produccion_id
       WHERE rp.lote_id = ?
       ORDER BY f.creado_en ASC`
    )
    .all(loteId);
}

function codigosQrDeLote(loteId) {
  return db
    .prepare("SELECT codigo, nivel, unidad_id, generado_en FROM codigos_qr WHERE lote_id = ? ORDER BY generado_en ASC")
    .all(loteId);
}

// Solo el Productor abre un lote nuevo; a partir de ahi Cooperativa,
// Planta, etc. van agregando registros sobre este mismo lote_id.
router.post("/", authenticate, authorize("productor"), (req, res) => {
  const { tipo_producto } = req.body ?? {};
  if (!TIPOS_PRODUCTO.includes(tipo_producto)) {
    throw httpError(400, `tipo_producto debe ser uno de: ${TIPOS_PRODUCTO.join(", ")}`);
  }

  const insert = db.prepare(
    "INSERT INTO lotes (codigo_unico, tipo_producto) VALUES (@codigo_unico, @tipo_producto)"
  );

  let info;
  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
    try {
      info = insert.run({ codigo_unico: generarCodigoLote(tipo_producto), tipo_producto });
      break;
    } catch (err) {
      if (!err.message.includes("UNIQUE constraint failed") || intento === MAX_INTENTOS_CODIGO - 1) {
        throw err;
      }
    }
  }

  registrarAuditoria(req.user.id, "crear_lote", "lotes", info.lastInsertRowid);

  // El QR ya no depende de la ruta (A/B, que ni siquiera existe todavia en
  // este punto -- se fija recien en Procesamiento): se emite desde el
  // primer paso del flujo, apenas el lote tiene codigo_unico. Ya no hace
  // falta emitirlo en procesamiento.js ni exportacion.js.
  emitirCodigoQrLote(info.lastInsertRowid, req.user.id);

  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ lote });
});

// Lista lotes, opcionalmente filtrados por etapa macro (p.ej.
// ?estado_macro=acopio para que Cooperativa elija sobre cual lote
// registrar el acopio). Sin restriccion de rol: cualquier actor de la
// cadena necesita ver lotes en la etapa que le corresponde.
router.get("/", authenticate, (req, res) => {
  const { estado_macro } = req.query;
  const lotes = estado_macro
    ? db.prepare("SELECT * FROM lotes WHERE estado_macro = ? ORDER BY creado_en ASC").all(estado_macro)
    : db.prepare("SELECT * FROM lotes ORDER BY creado_en DESC").all();
  res.json({ lotes });
});

// "Donde esta mi cosecha": el Productor ve en que etapa macro esta cada
// lote que salio de una parcela suya, y si ya tiene un codigo QR generado
// (o sea, si ya llego a manos del comprador). Solo lectura -- no puede
// editar nada de las etapas que no le corresponden, eso ya lo bloquean los
// endpoints de cada etapa (RBAC + chequeo de estado_macro).
router.get("/mios/estado", authenticate, authorize("productor"), (req, res) => {
  const lotes = db
    .prepare(
      `SELECT l.id, l.codigo_unico, l.tipo_producto, l.ruta, l.estado_macro, l.creado_en,
              rp.variedad, rp.fecha_cosecha,
              EXISTS(SELECT 1 FROM codigos_qr q WHERE q.lote_id = l.id) AS tiene_qr
       FROM lotes l
       JOIN registros_produccion rp ON rp.lote_id = l.id
       WHERE rp.actor_id = ?
       ORDER BY l.creado_en DESC`
    )
    .all(req.user.id);

  res.json({
    lotes: lotes.map((l) => ({
      ...l,
      tiene_qr: Boolean(l.tiene_qr),
      linea_tiempo: lineaTiempoDeLote(l.id),
      fotos: fotosDeLote(l.id),
      codigos_qr: l.tiene_qr ? codigosQrDeLote(l.id) : [],
    })),
  });
});

router.get("/:id", authenticate, (req, res) => {
  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(req.params.id);
  if (!lote) throw httpError(404, "Lote no encontrado");
  res.json({ lote });
});

// Cadena hash del lote (ver lib/cadenaBloques.js) -- todos los bloques en
// orden, con sus hashes, mas el resultado de verificar la integridad
// completa. Mismo criterio de acceso que GET /:id: cualquier usuario
// autenticado, sin restriccion de rol (cualquier actor de la cadena puede
// necesitar consultarlo, y no expone nada mas sensible que lo que ya
// muestra /:id o /mios/estado).
router.get("/:id/cadena", authenticate, (req, res) => {
  const lote = db.prepare("SELECT id, codigo_unico FROM lotes WHERE id = ?").get(req.params.id);
  if (!lote) throw httpError(404, "Lote no encontrado");

  const bloques = db
    .prepare("SELECT * FROM cadena_bloques WHERE lote_id = ? ORDER BY id ASC")
    .all(lote.id)
    .map((b) => ({ ...b, datos_evento: JSON.parse(b.datos_evento) }));

  res.json({
    lote: { id: lote.id, codigo_unico: lote.codigo_unico },
    bloques,
    integridad: verificarIntegridadLote(lote.id),
  });
});

// Ficha del lote para el panel interno -- mismo shape que devuelve
// GET /trazabilidad/:codigo (misma funcion, ver lib/fichaLote.js) pero SIN
// el gate de "certificacion fitosanitaria aprobada" que tiene esa ruta
// publica: aca el usuario ya esta autenticado y viendolo desde su propio
// panel (Mis registros, Validar pendientes, etc.), no tiene sentido
// esconderle el contenido de un lote que su propio rol ya puede ver por
// otras vias mientras todavia esta en curso. Usada para el boton
// "Descargar PDF" en cada panel interno donde aparece un lote (Productor,
// Cooperativa, Planta, Exportador, Administrador) -- mismo criterio de
// acceso que GET /:id/cadena: cualquier usuario autenticado, sin
// restriccion de rol ni chequeo de dueño.
router.get("/:id/ficha", authenticate, (req, res) => {
  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(req.params.id);
  if (!lote) throw httpError(404, "Lote no encontrado");

  res.json(construirFichaLote(lote, lote.codigo_unico, "lote", null));
});

export default router;
