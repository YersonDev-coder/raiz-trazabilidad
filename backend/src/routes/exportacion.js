import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { crearRouterEtapa } from "../lib/etapaRouter.js";
import { httpError } from "../lib/errors.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { crearUploaderDocumento, urlPublica } from "../lib/uploads.js";
import { registrarBloque } from "../lib/cadenaBloques.js";
import { certificacionesDeLote } from "../lib/certificaciones.js";

const ENTIDAD_EMISORA_DEFAULT = "SENASA";
const TIPOS_CERTIFICACION = ["fitosanitaria", "aduanera"];
const uploadCertificaciones = crearUploaderDocumento("certificaciones");

// Certificacion fitosanitaria y documentacion aduanera del lote: las sube
// el Exportador aca (junto con el registro de exportacion), y las
// aprueba/rechaza el Administrador (ver routes/certificaciones.js --
// SENASA/SUNAT ya no participan, ver routes/auth.js). Quedan en
// 'pendiente' hasta esa revision.
function conCertificaciones(registro) {
  return { ...registro, certificaciones: certificacionesDeLote(registro.lote_id) };
}

// rolValidador se deja en "sunat" A PROPOSITO, sin reasignar a "admin":
// SUNAT ya no puede loguearse (ver auth.js), asi que POST /:id/validar y
// POST /:id/rechazar (generados abajo por crearRouterEtapa) quedan
// inalcanzables para siempre -- nadie puede tener ese rol otra vez. Es
// intencional: la transicion a 'entregado' ahora SOLO puede pasar por
// routes/certificaciones.js (cuando el Administrador aprueba ambas
// certificaciones), y dejar esta ruta vieja alcanzable con rolValidador:
// "admin" habria abierto una puerta trasera para saltarse esa revision.
const router = crearRouterEtapa({
  tabla: "registros_exportacion",
  campos: ["puerto", "destino", "contenedor"],
  rolActor: "exportador",
  rolValidador: "sunat",
  etapaMacro: "exportacion",
  siguienteEtapaMacro: "entregado",
  conExtra: conCertificaciones,
  // El QR ya no se emite aqui (se emite desde el registro de cosecha, ver
  // routes/lotes.js) -- esta guarda queda porque es una regla de negocio
  // propia, independiente del QR: `ruta` deberia estar siempre definida a
  // esta altura (se fija en Acopio, ver routes/acopio.js -- Ruta A llega
  // directo desde ahi, Ruta B pasa antes por Procesamiento) pero se valida
  // por seguridad en vez de fallar en silencio.
  despuesDeCrear(req, lote, registro) {
    if (!lote.ruta) {
      throw httpError(
        409,
        "El lote no tiene ruta de exportacion (A/B) definida; no se puede registrar la exportacion todavia"
      );
    }
    registrarBloque(lote.id, "exportacion", {
      actor_id: registro.actor_id,
      puerto: registro.puerto,
      destino: registro.destino,
      contenedor: registro.contenedor,
    });
  },
  // despuesDeValidar queda definido pero, igual que rolValidador arriba, ya
  // no puede dispararse (nadie llega a POST /:id/validar). El bloque
  // 'entrega_sunat' real ahora se registra desde
  // routes/certificaciones.js al completarse ambas aprobaciones.
  despuesDeValidar(req, lote, registro) {
    registrarBloque(lote.id, "entrega_sunat", {
      validado_por: registro.validado_por,
      puerto: registro.puerto,
      destino: registro.destino,
      contenedor: registro.contenedor,
    });
  },
});

// Certificaciones de ESTE registro de exportacion (fitosanitaria +
// aduanera del lote al que pertenece). Cualquier usuario autenticado puede
// leerlas -- mismo criterio que GET /:id/fotos en produccion.js, no son mas
// sensibles que el resto de lo que ya expone el panel interno.
router.get("/:id/certificaciones", authenticate, (req, res) => {
  const registro = db.prepare("SELECT lote_id FROM registros_exportacion WHERE id = ?").get(req.params.id);
  if (!registro) throw httpError(404, "Registro no encontrado");
  res.json({ certificaciones: certificacionesDeLote(registro.lote_id) });
});

// Solo quien creo el registro puede subirlas, y solo mientras siga en
// borrador (mismo criterio de inmutabilidad que PUT /:id y que
// POST /:id/fotos en produccion.js). Numero de documento es obligatorio
// para cada tipo que se manda; el archivo adjunto es opcional (criterio
// conservador para no bloquear el flujo si todavia no hay un PDF real a
// mano) -- entidad_emisora tiene un default sugerido si llega vacia.
// Ambos tipos (fitosanitaria/aduanera) se mandan juntos en el mismo
// formulario, pero cada uno es independiente: se puede mandar solo uno de
// los dos si el otro ya se registro antes (no se duplica, ver mas abajo).
router.post(
  "/:id/certificaciones",
  authenticate,
  authorize("exportador"),
  (req, res, next) => {
    const registro = db.prepare("SELECT * FROM registros_exportacion WHERE id = ?").get(req.params.id);
    if (!registro) throw httpError(404, "Registro no encontrado");
    if (registro.actor_id !== req.user.id) {
      throw httpError(403, "Solo quien creo el registro puede agregarle certificaciones");
    }
    if (registro.estado !== "borrador") {
      throw httpError(409, "El registro ya fue validado; ya no se le pueden agregar certificaciones");
    }
    req.registroExportacion = registro;
    next();
  },
  (req, res, next) => {
    uploadCertificaciones.fields([
      { name: "fitosanitaria_archivo", maxCount: 1 },
      { name: "aduanera_archivo", maxCount: 1 },
    ])(req, res, next);
  },
  (req, res) => {
    const loteId = req.registroExportacion.lote_id;
    const archivos = req.files ?? {};
    const body = req.body ?? {};

    const yaExistentes = new Set(certificacionesDeLote(loteId).map((c) => c.tipo));
    const insertar = db.prepare(
      `INSERT INTO certificaciones (lote_id, tipo, numero_documento, entidad_emisora, documento_url, subido_por)
       VALUES (@lote_id, @tipo, @numero_documento, @entidad_emisora, @documento_url, @subido_por)`
    );

    const creadas = [];

    const numeroFitosanitaria = (body.fitosanitaria_numero ?? "").trim();
    if (numeroFitosanitaria) {
      if (yaExistentes.has("fitosanitaria")) {
        throw httpError(409, "Ya se registro la certificacion fitosanitaria de este lote");
      }
      const archivo = archivos.fitosanitaria_archivo?.[0];
      const info = insertar.run({
        lote_id: loteId,
        tipo: "fitosanitaria",
        numero_documento: numeroFitosanitaria,
        entidad_emisora: (body.fitosanitaria_entidad ?? "").trim() || ENTIDAD_EMISORA_DEFAULT,
        documento_url: archivo ? urlPublica("certificaciones", archivo.filename) : null,
        subido_por: req.user.id,
      });
      registrarAuditoria(req.user.id, "subir_certificacion_fitosanitaria", "certificaciones", info.lastInsertRowid);
      creadas.push(info.lastInsertRowid);
    }

    const numeroAduanera = (body.aduanera_numero ?? "").trim();
    if (numeroAduanera) {
      if (yaExistentes.has("aduanera")) {
        throw httpError(409, "Ya se registro la documentacion aduanera de este lote");
      }
      const archivo = archivos.aduanera_archivo?.[0];
      const info = insertar.run({
        lote_id: loteId,
        tipo: "aduanera",
        numero_documento: numeroAduanera,
        entidad_emisora: null,
        documento_url: archivo ? urlPublica("certificaciones", archivo.filename) : null,
        subido_por: req.user.id,
      });
      registrarAuditoria(req.user.id, "subir_documentacion_aduanera", "certificaciones", info.lastInsertRowid);
      creadas.push(info.lastInsertRowid);
    }

    if (creadas.length === 0) {
      throw httpError(400, "Debe enviar al menos fitosanitaria_numero o aduanera_numero");
    }

    res.status(201).json({ certificaciones: certificacionesDeLote(loteId) });
  }
);

// Corrige y reenvia UNA certificacion que el Administrador rechazo (ver
// routes/certificaciones.js) -- mismo espiritu que PUT /:id en
// etapaRouter.js para un registro rechazado (limpia el rechazo al
// guardar), pero a nivel de una certificacion individual en vez de todo el
// registro. Solo funciona si esa certificacion especifica esta
// 'rechazado'; no se puede "corregir" una que sigue pendiente o que ya fue
// aprobada. Si no llega un archivo nuevo, se conserva el que ya tenia.
router.put(
  "/:id/certificaciones/:tipo",
  authenticate,
  authorize("exportador"),
  (req, res, next) => {
    const { tipo } = req.params;
    if (!TIPOS_CERTIFICACION.includes(tipo)) {
      throw httpError(400, `tipo debe ser uno de: ${TIPOS_CERTIFICACION.join(", ")}`);
    }
    const registro = db.prepare("SELECT * FROM registros_exportacion WHERE id = ?").get(req.params.id);
    if (!registro) throw httpError(404, "Registro no encontrado");
    if (registro.actor_id !== req.user.id) {
      throw httpError(403, "Solo quien creo el registro puede corregir sus certificaciones");
    }
    const cert = db
      .prepare("SELECT * FROM certificaciones WHERE lote_id = ? AND tipo = ?")
      .get(registro.lote_id, tipo);
    if (!cert) throw httpError(404, "Esa certificacion todavia no existe");
    if (cert.estado !== "rechazado") {
      throw httpError(409, "Solo se puede corregir una certificacion que fue rechazada");
    }
    req.registroExportacion = registro;
    req.certificacion = cert;
    next();
  },
  (req, res, next) => {
    uploadCertificaciones.fields([{ name: "archivo", maxCount: 1 }])(req, res, next);
  },
  (req, res) => {
    const { tipo } = req.params;
    const numero = (req.body?.numero_documento ?? "").trim();
    if (!numero) throw httpError(400, "numero_documento es requerido");

    const archivo = req.files?.archivo?.[0];
    const entidadEmisora =
      tipo === "fitosanitaria"
        ? (req.body?.entidad_emisora ?? "").trim() || ENTIDAD_EMISORA_DEFAULT
        : null;

    db.prepare(
      `UPDATE certificaciones
       SET numero_documento = @numero_documento, entidad_emisora = @entidad_emisora,
           documento_url = @documento_url, estado = 'pendiente',
           motivo_rechazo = NULL, rechazado_por = NULL, rechazado_en = NULL
       WHERE id = @id`
    ).run({
      numero_documento: numero,
      entidad_emisora: entidadEmisora,
      documento_url: archivo ? urlPublica("certificaciones", archivo.filename) : req.certificacion.documento_url,
      id: req.certificacion.id,
    });
    registrarAuditoria(req.user.id, `corregir_certificacion_${tipo}`, "certificaciones", req.certificacion.id);

    res.json({ certificaciones: certificacionesDeLote(req.registroExportacion.lote_id) });
  }
);

export default router;
