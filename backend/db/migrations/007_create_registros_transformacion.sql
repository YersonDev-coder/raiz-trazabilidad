-- Solo aplica a lotes con ruta = 'B' (valor agregado): la Planta transforma
-- el producto hasta unidad de consumo (cafe tostado/envasado, o chocolate
-- de barra terminado). actor_id = Planta de Procesamiento. validado_por =
-- usuario de SENASA (esta etapa sigue dentro de la fase Procesamiento,
-- antes de Certificacion Sanitaria).
--
-- `detalles_json` guarda campos especificos segun producto (p.ej. gramaje
-- de bolsa para cafe, porcentaje de cacao para chocolate), por la misma
-- razon que en `registros_procesamiento`.
CREATE TABLE registros_transformacion (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id              INTEGER NOT NULL REFERENCES lotes(id),
  estado               TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'validado')),
  tipo_transformacion  TEXT,
  detalles_json        TEXT,
  actor_id             INTEGER NOT NULL REFERENCES usuarios(id),
  validado_por         INTEGER REFERENCES usuarios(id),
  validado_en          TEXT,
  creado_en            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registros_transformacion_lote_id ON registros_transformacion(lote_id);
