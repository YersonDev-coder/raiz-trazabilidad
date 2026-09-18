-- Registro de auditoria general (quien hizo que, sobre que entidad, cuando).
-- Complementa a `correcciones`: correcciones es para el dato de negocio,
-- auditoria es el rastro tecnico de acciones (login, creaciones, validaciones,
-- generacion de QR, etc.) sobre cualquier entidad del sistema.
CREATE TABLE auditoria (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id         INTEGER REFERENCES usuarios(id),
  accion             TEXT NOT NULL,
  entidad_afectada   TEXT NOT NULL,
  entidad_id         INTEGER,
  timestamp          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_auditoria_entidad ON auditoria(entidad_afectada, entidad_id);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);
