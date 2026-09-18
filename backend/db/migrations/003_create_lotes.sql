-- estado_macro avanza de forma secuencial y estricta: no se puede saltar etapas.
-- ruta (A/B) se decide recien en la Planta de Procesamiento, por eso es NULL
-- hasta ese momento (no antes).
CREATE TABLE lotes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_unico   TEXT NOT NULL UNIQUE,
  tipo_producto  TEXT NOT NULL CHECK (tipo_producto IN ('cafe', 'cacao')),
  ruta           TEXT CHECK (ruta IN ('A', 'B')),
  estado_macro   TEXT NOT NULL DEFAULT 'produccion' CHECK (estado_macro IN (
                   'produccion',
                   'acopio',
                   'procesamiento',
                   'certificacion_sanitaria',
                   'exportacion',
                   'entregado'
                 )),
  creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);
