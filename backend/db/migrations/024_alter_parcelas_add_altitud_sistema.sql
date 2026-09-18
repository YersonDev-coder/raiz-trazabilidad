-- altitud_msnm: si la geolocalizacion del navegador entrega altitude junto
-- con lat/lng se guarda automaticamente sin pedir input (ver
-- ParcelaNuevaPage.jsx); si no, el productor la escribe a mano -- por eso
-- es REAL simple, sin distincion de origen (no hace falta saber si vino
-- del GPS o fue tipeada, ver mismo criterio que ubicacion_lat/lng, que
-- tampoco lo distinguen).
ALTER TABLE parcelas ADD COLUMN altitud_msnm REAL;
ALTER TABLE parcelas ADD COLUMN anio_establecimiento INTEGER;
ALTER TABLE parcelas ADD COLUMN sistema_cultivo TEXT
  CHECK (sistema_cultivo IS NULL OR sistema_cultivo IN ('monocultivo', 'agroforestal'));
