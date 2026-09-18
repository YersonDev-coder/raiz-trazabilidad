-- Etapa Produccion. actor_id = Productor que registra. validado_por = usuario
-- de Cooperativa que valida (segun tabla de quien-valida-a-quien).
-- Una vez estado = 'validado' el registro se congela: los cambios posteriores
-- van a la tabla `correcciones`, nunca se edita esta fila.
CREATE TABLE registros_produccion (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id        INTEGER NOT NULL REFERENCES lotes(id),
  parcela_id     INTEGER NOT NULL REFERENCES parcelas(id),
  estado         TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'validado')),
  variedad       TEXT,
  fecha_cosecha  TEXT,
  volumen_kg     REAL,
  actor_id       INTEGER NOT NULL REFERENCES usuarios(id),
  validado_por   INTEGER REFERENCES usuarios(id),
  validado_en    TEXT,
  creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registros_produccion_lote_id ON registros_produccion(lote_id);
CREATE INDEX idx_registros_produccion_parcela_id ON registros_produccion(parcela_id);
