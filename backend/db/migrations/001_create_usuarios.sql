-- Actores con login: Productor, Cooperativa, Planta de Procesamiento, SENASA,
-- Exportador, SUNAT, Administrador. El Comprador/público no tiene login
-- (consulta vía QR/catálogo) y por eso no aparece en este enum.
CREATE TABLE usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  rol            TEXT NOT NULL CHECK (rol IN (
                   'productor',
                   'cooperativa',
                   'planta_procesamiento',
                   'senasa',
                   'exportador',
                   'sunat',
                   'admin'
                 )),
  creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);
