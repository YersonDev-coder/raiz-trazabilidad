-- Permite desactivar una cuenta sin borrarla (se pierde el login, pero se
-- conserva el historial: nombre/quien-valido-que en registros ya validados
-- sigue apuntando a un usuario real, no a un id huerfano). Se usa de
-- entrada para los roles senasa/sunat, que se eliminan del flujo de login
-- en este cambio (ver routes/auth.js) pero NO se borran de la tabla --
-- lotes ya 'entregado' de antes de este cambio todavia referencian a estos
-- usuarios como quienes validaron procesamiento/exportacion en su momento.
ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));

UPDATE usuarios SET activo = 0 WHERE rol IN ('senasa', 'sunat');
