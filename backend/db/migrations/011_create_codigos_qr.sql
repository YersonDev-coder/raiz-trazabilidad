-- nivel = 'lote': Ruta A, se genera al final en Exportador, uno por
-- lote/contenedor (unidad_id queda NULL).
-- nivel = 'unidad': Ruta B, se genera en la Planta de Procesamiento al
-- envasar, uno por cada unidad individual (unidad_id identifica la unidad;
-- no existe una tabla `unidades` separada en esta fase, se maneja como
-- identificador libre, p.ej. numero de serie/lote de envasado).
CREATE TABLE codigos_qr (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo         TEXT NOT NULL UNIQUE,
  nivel          TEXT NOT NULL CHECK (nivel IN ('lote', 'unidad')),
  lote_id        INTEGER NOT NULL REFERENCES lotes(id),
  unidad_id      TEXT,
  url_destino    TEXT NOT NULL,
  generado_por   INTEGER NOT NULL REFERENCES usuarios(id),
  generado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_codigos_qr_lote_id ON codigos_qr(lote_id);
