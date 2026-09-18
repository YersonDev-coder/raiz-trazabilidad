-- Rechazo de un registro en borrador (antes de validar): el registro NUNCA
-- llega a 'validado', simplemente se queda en 'borrador' con estos metadatos
-- explicando por que. No es un estado nuevo en el CHECK de `estado` --
-- reutiliza 'borrador' tal cual, distinguible solo por rechazado_en IS NOT
-- NULL. motivo_rechazo es visible unicamente para el actor que creo el
-- registro y para Administrador (nunca en endpoints publicos como
-- /trazabilidad o /catalogo -- ver routes/trazabilidad.js y catalogo.js,
-- ninguno de los dos selecciona estas columnas).
ALTER TABLE registros_produccion ADD COLUMN motivo_rechazo TEXT;
ALTER TABLE registros_produccion ADD COLUMN rechazado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE registros_produccion ADD COLUMN rechazado_en TEXT;

ALTER TABLE registros_acopio ADD COLUMN motivo_rechazo TEXT;
ALTER TABLE registros_acopio ADD COLUMN rechazado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE registros_acopio ADD COLUMN rechazado_en TEXT;

ALTER TABLE registros_procesamiento ADD COLUMN motivo_rechazo TEXT;
ALTER TABLE registros_procesamiento ADD COLUMN rechazado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE registros_procesamiento ADD COLUMN rechazado_en TEXT;

ALTER TABLE registros_exportacion ADD COLUMN motivo_rechazo TEXT;
ALTER TABLE registros_exportacion ADD COLUMN rechazado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE registros_exportacion ADD COLUMN rechazado_en TEXT;
