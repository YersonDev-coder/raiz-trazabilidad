-- Etapa Procesamiento. actor_id = Planta de Procesamiento. validado_por =
-- usuario de SENASA que valida la certificacion fitosanitaria.
--
-- Aqui es donde la Planta decide la ruta del lote (columna `ruta` en
-- `lotes`, A o B) -- no antes, no despues.
--
-- `detalles_json` guarda campos especificos de cafe o cacao (por ejemplo
-- grado de fermentacion para cacao, o porcentaje de defectos para cafe).
-- Se eligio JSON en vez de columnas separadas por producto porque son
-- campos que varian por producto y no se necesitan filtrar/indexar en SQL
-- en esta fase del proyecto; agregar columnas nuevas por cada variante
-- futura infla el esquema sin necesidad real todavia.
CREATE TABLE registros_procesamiento (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id           INTEGER NOT NULL REFERENCES lotes(id),
  estado            TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'validado')),
  metodo_beneficio  TEXT,
  tipo_secado       TEXT,
  detalles_json     TEXT,
  actor_id          INTEGER NOT NULL REFERENCES usuarios(id),
  validado_por      INTEGER REFERENCES usuarios(id),
  validado_en       TEXT,
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registros_procesamiento_lote_id ON registros_procesamiento(lote_id);
