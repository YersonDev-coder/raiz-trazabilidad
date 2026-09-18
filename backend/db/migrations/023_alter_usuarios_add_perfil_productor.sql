-- Campos nuevos del perfil de Productor. Igual criterio que 015/020: se
-- dejan disponibles para cualquier rol en vez de restringir por columna
-- (no cuesta nada tenerlas, evita una migracion futura), salvo
-- codigo_productor que es un identificador interno/admin -- nunca se
-- selecciona en ningun endpoint publico (ver usuarioPublico() en
-- routes/trazabilidad.js y actividad-publica en routes/usuarios.js, que
-- explicitamente NO lo incluyen en su SELECT).
--
-- certificaciones_productor guarda un array JSON de texto (ej.
-- '["organico","fairtrade"]'), mismo criterio que detalles_json en
-- registros_procesamiento: es multi-select, no un unico valor, y no
-- amerita una tabla aparte para un prototipo.
ALTER TABLE usuarios ADD COLUMN asociacion_cooperativa TEXT;
ALTER TABLE usuarios ADD COLUMN certificaciones_productor TEXT;
ALTER TABLE usuarios ADD COLUMN practicas_agricolas TEXT
  CHECK (practicas_agricolas IS NULL OR practicas_agricolas IN ('convencional', 'organico', 'agroecologico'));
-- SQLite no permite agregar una columna UNIQUE con ALTER TABLE ADD COLUMN
-- directamente (solo al crear la tabla) -- se agrega sin esa clausula y se
-- fuerza la unicidad con un indice aparte, mismo resultado.
ALTER TABLE usuarios ADD COLUMN codigo_productor TEXT;

-- Backfill: productores ya existentes no tienen forma de generar su codigo
-- via el flujo normal (POST /api/auth/register, que a partir de ahora lo
-- genera al crear la cuenta), asi que se les asigna aca uno basado en su id
-- -- mismo formato PROD-0001 que usara el codigo nuevo en adelante.
UPDATE usuarios
SET codigo_productor = 'PROD-' || substr('0000' || id, -4, 4)
WHERE rol = 'productor' AND codigo_productor IS NULL;

CREATE UNIQUE INDEX idx_usuarios_codigo_productor ON usuarios(codigo_productor);
