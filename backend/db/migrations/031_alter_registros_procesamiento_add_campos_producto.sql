-- Procesamiento se separa en dos formularios (Cafe/Cacao) segun el
-- producto heredado del lote (lotes.tipo_producto), mismo criterio que la
-- migracion 030 aplico a Acopio. metodo_beneficio/tipo_secado/detalles_json
-- (columnas originales) se dejan intactas para no romper el historial de
-- lotes ya 'entregado' de antes de este cambio, pero el formulario nuevo ya
-- no las usa -- quedan NULL en cualquier registro creado de aqui en
-- adelante (ver routes/procesamiento.js).
--
-- Columnas nuevas:
--   peso_entrada_kg      -> comun: cafe pergamino seco / cacao en grano seco
--                           (la entrada de ESTA etapa es la salida de Acopio).
--   peso_salida_kg       -> comun: cafe verde/oro / peso de salida final de
--                           cacao (nibs/licor/manteca/polvo, ver mas abajo).
--   clasificacion_calidad -> solo cafe: informativa, no fragmenta el lote.
--   tueste_temperatura/tueste_tiempo -> comunes en la columna (cafe: solo si
--                           Ruta B; cacao: siempre) pero opcionales a nivel
--                           de fila -- la obligatoriedad exacta se valida en
--                           la app segun producto/ruta, no aqui.
--   molido               -> solo cafe, solo Ruta B, opcional.
--   descascarillado       -> solo cacao (winnowing), independiente de ruta.
--   nibs_peso_kg         -> solo cacao, solo Ruta B.
--   molienda_tipo        -> solo cacao, solo Ruta B: licor | manteca | polvo.
ALTER TABLE registros_procesamiento ADD COLUMN peso_entrada_kg REAL;
ALTER TABLE registros_procesamiento ADD COLUMN peso_salida_kg REAL;
ALTER TABLE registros_procesamiento ADD COLUMN clasificacion_calidad TEXT
  CHECK (clasificacion_calidad IS NULL OR clasificacion_calidad IN ('excelso', 'consumo', 'pasilla', 'mezcla_variable'));
ALTER TABLE registros_procesamiento ADD COLUMN tueste_temperatura REAL;
ALTER TABLE registros_procesamiento ADD COLUMN tueste_tiempo REAL;
ALTER TABLE registros_procesamiento ADD COLUMN molido INTEGER CHECK (molido IS NULL OR molido IN (0, 1));
ALTER TABLE registros_procesamiento ADD COLUMN descascarillado INTEGER CHECK (descascarillado IS NULL OR descascarillado IN (0, 1));
ALTER TABLE registros_procesamiento ADD COLUMN nibs_peso_kg REAL;
ALTER TABLE registros_procesamiento ADD COLUMN molienda_tipo TEXT
  CHECK (molienda_tipo IS NULL OR molienda_tipo IN ('licor', 'manteca', 'polvo'));
