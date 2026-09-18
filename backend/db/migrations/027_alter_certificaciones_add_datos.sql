-- El Exportador ahora sube el la certificacion fitosanitaria y la
-- documentacion aduanera junto con el registro de exportacion (antes
-- SENASA/SUNAT solo aprobaban/rechazaban sin que nadie subiera nada real,
-- ver comentario original en 009_create_certificaciones.sql). Se agregan
-- los 2 campos de texto que pidio la Ficha de Verificacion:
--   - numero_documento: numero de certificado (fitosanitaria) o de
--     declaracion/documento (aduanera) -- mismo campo generico para ambos
--     tipos, solo cambia la etiqueta en el formulario segun `tipo`.
--   - entidad_emisora: solo tiene sentido para 'fitosanitaria' (ej.
--     "SENASA"); queda NULL para 'aduanera', no se fuerza con CHECK.
-- documento_url ya existia y sigue siendo opcional (el adjunto es
-- opcional por ahora, ver routes/exportacion.js).
ALTER TABLE certificaciones ADD COLUMN numero_documento TEXT;
ALTER TABLE certificaciones ADD COLUMN entidad_emisora TEXT;
