-- Etapa Exportacion. actor_id = Exportador. validado_por = usuario de SUNAT
-- que valida la documentacion aduanera.
CREATE TABLE registros_exportacion (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id       INTEGER NOT NULL REFERENCES lotes(id),
  estado        TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'validado')),
  puerto        TEXT,
  destino       TEXT,
  contenedor    TEXT,
  actor_id      INTEGER NOT NULL REFERENCES usuarios(id),
  validado_por  INTEGER REFERENCES usuarios(id),
  validado_en   TEXT,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registros_exportacion_lote_id ON registros_exportacion(lote_id);
