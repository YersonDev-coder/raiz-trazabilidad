-- Fotos de evidencia de UNA cosecha puntual (registros_produccion), no de
-- la parcela en general (esa es fotos_parcela, tabla aparte). Requisito de
-- diseno original: el comprador final debe poder ver de donde viene el
-- producto que esta consumiendo.
CREATE TABLE fotos_registro_produccion (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_produccion_id  INTEGER NOT NULL REFERENCES registros_produccion(id),
  url                     TEXT NOT NULL,
  creado_en               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fotos_registro_produccion_registro_id
  ON fotos_registro_produccion(registro_produccion_id);
