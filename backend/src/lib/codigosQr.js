import db from "../db.js";

// Emite el QR de nivel 'lote' para un lote, una sola vez. El codigo del QR
// es literalmente lote.codigo_unico (determinístico, ya generado en el
// registro de cosecha) -- no se genera un identificador nuevo, solo se dejá
// constancia de CUANDO y QUIEN disparó el evento. Idempotente: si el
// endpoint que la llama se invoca mas de una vez para el mismo lote (p.ej.
// Planta reenvía un registro de procesamiento en borrador), no revienta
// contra el UNIQUE de `codigo`, simplemente no hace nada la segunda vez.
export function emitirCodigoQrLote(loteId, generadoPorUsuarioId) {
  const yaEmitido = db
    .prepare("SELECT 1 FROM codigos_qr WHERE lote_id = ? AND nivel = 'lote'")
    .get(loteId);
  if (yaEmitido) return;

  const lote = db.prepare("SELECT codigo_unico FROM lotes WHERE id = ?").get(loteId);

  db.prepare(
    `INSERT INTO codigos_qr (codigo, nivel, lote_id, unidad_id, url_destino, generado_por)
     VALUES (@codigo, 'lote', @lote_id, NULL, @url_destino, @generado_por)`
  ).run({
    codigo: lote.codigo_unico,
    lote_id: loteId,
    url_destino: `/trazabilidad/${lote.codigo_unico}`,
    generado_por: generadoPorUsuarioId,
  });
}
