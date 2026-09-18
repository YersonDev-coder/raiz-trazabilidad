-- Perfil extendido, opcional, pensado para Productor (aunque no se
-- restringe por rol, mismo criterio que nombre_publico/foto_perfil_url en
-- 015: es informacion cosmetica/narrativa, no hay riesgo en dejarla
-- disponible para cualquier rol). Publica: se muestra en la ficha de
-- trazabilidad junto al nombre/foto que ya se exponen ahi.
ALTER TABLE usuarios ADD COLUMN anio_inicio_actividad INTEGER;
ALTER TABLE usuarios ADD COLUMN generacion_familiar TEXT
  CHECK (generacion_familiar IS NULL OR generacion_familiar IN ('1ra', '2da', '3ra_o_mas'));
ALTER TABLE usuarios ADD COLUMN historia TEXT;
