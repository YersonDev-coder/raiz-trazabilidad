import db from "../db.js";

// Certificacion fitosanitaria + documentacion aduanera de un lote (tabla
// `certificaciones`, migraciones 009/027/029). Las sube el Exportador (ver
// routes/exportacion.js) y las aprueba/rechaza el Administrador (ver
// routes/certificaciones.js) -- SENASA/SUNAT ya no participan de este
// flujo, ver auth.js.

// Version completa (incluye motivo_rechazo y quien subio/valido/rechazo):
// solo para vistas internas autenticadas (Exportador dueño del lote,
// Administrador). NUNCA usar esto para responder un endpoint publico.
export function certificacionesDeLote(loteId) {
  return db
    .prepare(
      `SELECT id, lote_id, tipo, numero_documento, entidad_emisora, documento_url, estado,
              subido_por, validado_por, validado_en, motivo_rechazo, rechazado_por, rechazado_en,
              creado_en
       FROM certificaciones WHERE lote_id = ? ORDER BY creado_en ASC`
    )
    .all(loteId);
}

// Version publica: solo lo ya 'aprobado' (una certificacion pendiente o
// rechazada no es una certificacion real todavia, no corresponde mostrarla
// en la ficha de trazabilidad), y sin ninguno de los campos internos
// (motivo_rechazo, subido_por, etc.). Usada por routes/trazabilidad.js.
export function certificacionesPublicasDeLote(loteId) {
  return db
    .prepare(
      `SELECT tipo, numero_documento, entidad_emisora, documento_url, validado_en
       FROM certificaciones WHERE lote_id = ? AND estado = 'aprobado' ORDER BY creado_en ASC`
    )
    .all(loteId);
}

// true si AMBAS certificaciones del lote (fitosanitaria y aduanera) estan
// 'aprobado' -- la condicion que dispara la transicion compuesta a
// 'entregado' en routes/certificaciones.js.
export function ambasCertificacionesAprobadas(loteId) {
  const filas = certificacionesDeLote(loteId);
  const fito = filas.find((c) => c.tipo === "fitosanitaria");
  const aduana = filas.find((c) => c.tipo === "aduanera");
  return Boolean(fito && fito.estado === "aprobado" && aduana && aduana.estado === "aprobado");
}
