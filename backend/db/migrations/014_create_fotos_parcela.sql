-- Galeria de fotos GENERALES de la parcela (ej. vista del terreno, la
-- entrada, el productor en su campo). Distinto de las futuras fotos de
-- evidencia por cosecha, que se enlazarian a registros_produccion en vez
-- de a la parcela directamente.
CREATE TABLE fotos_parcela (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parcela_id  INTEGER NOT NULL REFERENCES parcelas(id),
  url         TEXT NOT NULL,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fotos_parcela_parcela_id ON fotos_parcela(parcela_id);
