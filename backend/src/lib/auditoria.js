import db from "../db.js";

export function registrarAuditoria(usuarioId, accion, entidadAfectada, entidadId) {
  db.prepare(
    "INSERT INTO auditoria (usuario_id, accion, entidad_afectada, entidad_id) VALUES (@usuario_id, @accion, @entidad_afectada, @entidad_id)"
  ).run({
    usuario_id: usuarioId,
    accion,
    entidad_afectada: entidadAfectada,
    entidad_id: entidadId ?? null,
  });
}
