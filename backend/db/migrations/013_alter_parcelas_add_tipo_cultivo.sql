-- La parcela ahora se registra una sola vez como entidad propia (ya no se
-- crea "de paso" dentro del formulario de cada cosecha). tipo_cultivo indica
-- que producto(s) se cultivan ahi; queda NULL en parcelas creadas antes de
-- este cambio porque no hay forma honesta de inferirlo retroactivamente.
ALTER TABLE parcelas ADD COLUMN tipo_cultivo TEXT
  CHECK (tipo_cultivo IS NULL OR tipo_cultivo IN ('cafe', 'cacao', 'ambos'));
