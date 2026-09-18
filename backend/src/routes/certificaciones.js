import { Router } from "express";
import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../lib/errors.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { registrarBloque } from "../lib/cadenaBloques.js";
import { certificacionesDeLote, ambasCertificacionesAprobadas } from "../lib/certificaciones.js";

const router = Router();

const TIPOS = ["fitosanitaria", "aduanera"];

// Reemplaza lo que antes hacian SENASA (certificacion fitosanitaria) y
// SUNAT (documentacion aduanera) por separado, ahora unificado en el
// Administrador -- ver routes/auth.js (esos dos roles ya no pueden
// loguearse) y routes/exportacion.js (donde el Exportador sube los
// documentos que se revisan aca).

// Lotes en etapa 'exportacion' con su registro de exportacion y sus
// certificaciones (si el Exportador ya las subio) -- la cola de trabajo
// del Administrador. Un lote sale de esta lista solo cuando ambas
// certificaciones quedan 'aprobado' (el lote pasa a 'entregado', ver
// POST /:loteId/:tipo/aprobar mas abajo).
router.get("/pendientes", authenticate, authorize("admin"), (req, res) => {
  const lotes = db
    .prepare(
      `SELECT l.id AS lote_id, l.codigo_unico, l.tipo_producto, l.ruta,
              re.id AS registro_exportacion_id, re.puerto, re.destino, re.contenedor,
              re.actor_id, re.creado_en AS registro_creado_en,
              u.nombre AS exportador_nombre,
              EXISTS(SELECT 1 FROM codigos_qr q WHERE q.lote_id = l.id) AS lote_tiene_qr
       FROM lotes l
       JOIN registros_exportacion re ON re.lote_id = l.id
       JOIN usuarios u ON u.id = re.actor_id
       WHERE l.estado_macro = 'exportacion'
       ORDER BY re.creado_en ASC`
    )
    .all();

  res.json({
    lotes: lotes.map((l) => ({
      ...l,
      lote_tiene_qr: Boolean(l.lote_tiene_qr),
      certificaciones: certificacionesDeLote(l.lote_id),
    })),
  });
});

function certificacionDe(loteId, tipo) {
  return db.prepare("SELECT * FROM certificaciones WHERE lote_id = ? AND tipo = ?").get(loteId, tipo);
}

// Al aprobar AMBAS certificaciones de un lote (puede pasar en cualquier
// orden, una por una): se marca el registro de exportacion como validado,
// el lote pasa a 'entregado', y se disparan los 2 bloques de cadena que
// antes disparaban SENASA/SUNAT por separado -- mismos tipo_evento
// ('certificacion_senasa', 'entrega_sunat'), porque describen el tramite
// real, no quien lo ejecuta en el sistema (asi lo pidio el equipo). Todo
// dentro de una sola transaccion.
function completarSiAmbasAprobadas(req, loteId) {
  if (!ambasCertificacionesAprobadas(loteId)) return null;

  const registro = db
    .prepare("SELECT * FROM registros_exportacion WHERE lote_id = ? ORDER BY creado_en DESC LIMIT 1")
    .get(loteId);
  const fito = certificacionDe(loteId, "fitosanitaria");
  const aduana = certificacionDe(loteId, "aduanera");

  db.prepare(
    "UPDATE registros_exportacion SET estado = 'validado', validado_por = @validado_por, validado_en = datetime('now') WHERE id = @id"
  ).run({ validado_por: req.user.id, id: registro.id });
  db.prepare("UPDATE lotes SET estado_macro = 'entregado' WHERE id = ?").run(loteId);

  registrarBloque(loteId, "certificacion_senasa", {
    validado_por: req.user.id,
    certificacion_id: fito.id,
    numero_documento: fito.numero_documento,
    entidad_emisora: fito.entidad_emisora,
  });
  registrarBloque(loteId, "entrega_sunat", {
    validado_por: req.user.id,
    certificacion_id: aduana.id,
    puerto: registro.puerto,
    destino: registro.destino,
    contenedor: registro.contenedor,
  });

  registrarAuditoria(req.user.id, "completar_entrega_lote", "lotes", loteId);

  return db.prepare("SELECT * FROM lotes WHERE id = ?").get(loteId);
}

// Aprueba UNA certificacion (fitosanitaria o aduanera) de un lote, de forma
// independiente de la otra -- es valido que una este aprobada y la otra
// todavia pendiente o rechazada.
router.post("/:loteId/:tipo/aprobar", authenticate, authorize("admin"), (req, res) => {
  const { loteId, tipo } = req.params;
  if (!TIPOS.includes(tipo)) throw httpError(400, `tipo debe ser uno de: ${TIPOS.join(", ")}`);

  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(loteId);
  if (!lote) throw httpError(404, "Lote no encontrado");
  if (lote.estado_macro === "entregado") {
    throw httpError(409, "Este lote ya fue entregado; sus certificaciones ya no se pueden modificar");
  }

  const cert = certificacionDe(loteId, tipo);
  if (!cert) throw httpError(404, `El Exportador todavia no subio la certificacion ${tipo} de este lote`);
  if (cert.estado !== "pendiente") {
    throw httpError(409, `Esta certificacion ya esta en estado '${cert.estado}', no se puede aprobar de nuevo`);
  }

  let loteActualizado = lote;
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE certificaciones
       SET estado = 'aprobado', validado_por = @validado_por, validado_en = datetime('now'),
           motivo_rechazo = NULL, rechazado_por = NULL, rechazado_en = NULL
       WHERE id = @id`
    ).run({ validado_por: req.user.id, id: cert.id });
    registrarAuditoria(req.user.id, `aprobar_certificacion_${tipo}`, "certificaciones", cert.id);

    loteActualizado = completarSiAmbasAprobadas(req, Number(loteId)) ?? lote;
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  res.json({ certificaciones: certificacionesDeLote(loteId), lote: loteActualizado });
});

// Rechaza UNA certificacion -- mismo patron que el resto del sistema
// (motivo obligatorio). A diferencia de las 4 etapas (que reutilizan
// 'borrador' + rechazado_en), aca se usa el valor 'rechazado' propio de
// esta tabla (ver migracion 009/029). El Exportador corrige y reenvia con
// PUT /api/registros/exportacion/:id/certificaciones/:tipo, que limpia el
// rechazo y vuelve a dejarla en 'pendiente'.
router.post("/:loteId/:tipo/rechazar", authenticate, authorize("admin"), (req, res) => {
  const { loteId, tipo } = req.params;
  if (!TIPOS.includes(tipo)) throw httpError(400, `tipo debe ser uno de: ${TIPOS.join(", ")}`);

  const motivo = (req.body?.motivo ?? "").trim();
  if (!motivo) throw httpError(400, "El motivo de rechazo es requerido");

  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(loteId);
  if (!lote) throw httpError(404, "Lote no encontrado");
  if (lote.estado_macro === "entregado") {
    throw httpError(409, "Este lote ya fue entregado; sus certificaciones ya no se pueden modificar");
  }

  const cert = certificacionDe(loteId, tipo);
  if (!cert) throw httpError(404, `El Exportador todavia no subio la certificacion ${tipo} de este lote`);
  if (cert.estado !== "pendiente") {
    throw httpError(409, `Esta certificacion ya esta en estado '${cert.estado}', no se puede rechazar`);
  }

  db.prepare(
    `UPDATE certificaciones
     SET estado = 'rechazado', motivo_rechazo = @motivo, rechazado_por = @rechazado_por, rechazado_en = datetime('now')
     WHERE id = @id`
  ).run({ motivo, rechazado_por: req.user.id, id: cert.id });
  registrarAuditoria(req.user.id, `rechazar_certificacion_${tipo}`, "certificaciones", cert.id);

  res.json({ certificaciones: certificacionesDeLote(loteId) });
});

export default router;
