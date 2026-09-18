-- Acopio se separa en dos formularios (Café/Cacao) segun el producto
-- heredado del lote (lotes.tipo_producto, fijado por el Productor al crear
-- el lote) -- mismo criterio que ya usaba Produccion para derivar
-- variedad/estado_grano del cultivo de la parcela.
--
-- Campos que ya existian se REUTILIZAN sin romper su semantica ni el
-- payload ya guardado en cadena_bloques/ficha publica:
--   peso_kg         -> "peso recibido" (cafe cereza / cacao en baba)
--   humedad_pct      -> ahora es SOLO de cacao ("% humedad final", <=8%
--                        validado en la app, no aca porque el CHECK no
--                        puede saber a que producto pertenece un registro
--                        sin hacer JOIN); cafe ya no lo envia (validado en
--                        antesDeCrear de routes/acopio.js).
--   fecha_recepcion  -> comun a ambos, sin cambios.
--
-- Columnas nuevas:
--   peso_salida_kg          -> comun: "peso final entregado" (cafe
--                              pergamino seco / cacao en grano seco).
--   dias_secado              -> comun: dias de secado.
--   metodo_secado            -> comun: natural_sol | mecanico.
--   fecha_hora_despulpado    -> solo cafe.
--   metodo_fermentacion      -> solo cafe: lavado | seco.
--   horas_fermentacion       -> solo cafe (tipico 14-24h).
--   peso_pergamino_humedo_kg -> solo cafe: peso intermedio tras lavado.
--   dias_fermentacion        -> solo cacao (cafe fermenta en horas, no dias).
ALTER TABLE registros_acopio ADD COLUMN peso_salida_kg REAL;
ALTER TABLE registros_acopio ADD COLUMN dias_secado INTEGER;
ALTER TABLE registros_acopio ADD COLUMN metodo_secado TEXT
  CHECK (metodo_secado IS NULL OR metodo_secado IN ('natural_sol', 'mecanico'));

ALTER TABLE registros_acopio ADD COLUMN fecha_hora_despulpado TEXT;
ALTER TABLE registros_acopio ADD COLUMN metodo_fermentacion TEXT
  CHECK (metodo_fermentacion IS NULL OR metodo_fermentacion IN ('lavado', 'seco'));
ALTER TABLE registros_acopio ADD COLUMN horas_fermentacion REAL;
ALTER TABLE registros_acopio ADD COLUMN peso_pergamino_humedo_kg REAL;

ALTER TABLE registros_acopio ADD COLUMN dias_fermentacion INTEGER;
