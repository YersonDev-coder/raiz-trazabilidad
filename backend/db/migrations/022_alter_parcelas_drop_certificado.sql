-- Revierte la parte de "certificado de no vinculacion a deforestacion" de
-- la migracion 021 -- se decidio no seguir con esa funcionalidad. No se
-- edita la 021 (ya aplicada) ni se toca extension_valor/extension_unidad
-- (misma migracion, sigue vigente). SQLite soporta DROP COLUMN nativo
-- desde 3.35 (aqui: 3.53), no hace falta el rodeo de recrear la tabla.
ALTER TABLE parcelas DROP COLUMN certificado_no_deforestacion;
ALTER TABLE parcelas DROP COLUMN certificado_detalle;
