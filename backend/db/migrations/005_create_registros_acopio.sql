-- Etapa Acopio. actor_id = Cooperativa que recibe/pesa el lote.
-- validado_por = usuario de Planta de Procesamiento que valida.
CREATE TABLE registros_acopio (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id          INTEGER NOT NULL REFERENCES lotes(id),
  estado           TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'validado')),
  peso_kg          REAL,
  humedad_pct      REAL,
  fecha_recepcion  TEXT,
  actor_id         INTEGER NOT NULL REFERENCES usuarios(id),
  validado_por     INTEGER REFERENCES usuarios(id),
  validado_en      TEXT,
  creado_en        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registros_acopio_lote_id ON registros_acopio(lote_id);
