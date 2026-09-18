-- Tabla clave/valor deliberadamente simple: hoy solo necesitamos el nombre
-- de la plataforma y la imagen de fondo de la landing, y agregar una
-- configuracion nueva despues es solo un INSERT, no una migracion de
-- columnas.
CREATE TABLE configuracion_sitio (
  clave  TEXT PRIMARY KEY,
  valor  TEXT
);

INSERT INTO configuracion_sitio (clave, valor) VALUES ('nombre_plataforma', 'Raíz');
INSERT INTO configuracion_sitio (clave, valor) VALUES ('imagen_fondo_landing_url', NULL);
