-- Motivo de rechazo para una certificacion individual (fitosanitaria o
-- aduanera) que el Administrador rechaza -- ver routes/certificaciones.js.
-- A diferencia del patron de motivo_rechazo en registros_produccion/
-- acopio/procesamiento/exportacion (migracion 018, que reutiliza 'borrador'
-- + rechazado_en como marca), `certificaciones` YA tenia un valor
-- 'rechazado' propio en el CHECK de `estado` desde la migracion 009 -- se
-- usa ese en vez de forzar el otro patron, es mas explicito para esta
-- tabla. Visible solo para el Exportador (subido_por) y Administrador,
-- igual criterio de privacidad que el resto: nunca en /trazabilidad ni
-- /catalogo.
ALTER TABLE certificaciones ADD COLUMN motivo_rechazo TEXT;
ALTER TABLE certificaciones ADD COLUMN rechazado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE certificaciones ADD COLUMN rechazado_en TEXT;
