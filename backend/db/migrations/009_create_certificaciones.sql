-- SENASA y SUNAT no registran documentos propios, solo aprueban/rechazan lo
-- que sube la Planta (fitosanitaria) o el Exportador (aduanera). Por eso
-- se distingue `subido_por` (Planta/Exportador) de `validado_por` (SENASA/SUNAT).
CREATE TABLE certificaciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id         INTEGER NOT NULL REFERENCES lotes(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('fitosanitaria', 'aduanera')),
  documento_url   TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  subido_por      INTEGER NOT NULL REFERENCES usuarios(id),
  validado_por    INTEGER REFERENCES usuarios(id),
  validado_en     TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_certificaciones_lote_id ON certificaciones(lote_id);
