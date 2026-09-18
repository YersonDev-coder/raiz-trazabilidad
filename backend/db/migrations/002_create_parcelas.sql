CREATE TABLE parcelas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  productor_id    INTEGER NOT NULL REFERENCES usuarios(id),
  ubicacion_lat   REAL,
  ubicacion_lng   REAL,
  zona            TEXT,
  nombre_parcela  TEXT NOT NULL,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_parcelas_productor_id ON parcelas(productor_id);
