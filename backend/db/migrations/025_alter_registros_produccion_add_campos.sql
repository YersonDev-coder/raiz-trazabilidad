-- estado_grano: valor por defecto en el frontend segun el cultivo heredado
-- de la parcela (cafe -> cereza_fresca, cacao -> mazorca, ver
-- ProduccionNuevoPage.jsx), pero sigue siendo un select con una segunda
-- opcion por cultivo -- no se restringe por tipo_producto con un CHECK
-- (igual criterio que tipo_producto/tipo_cultivo: ese cruce se valida en
-- antesDeCrear de routes/produccion.js, no en el schema).
ALTER TABLE registros_produccion ADD COLUMN estado_grano TEXT
  CHECK (estado_grano IS NULL OR estado_grano IN (
    'cereza_fresca', 'cereza_sobremadura', 'mazorca', 'mazorca_partida'
  ));
ALTER TABLE registros_produccion ADD COLUMN tipo_cosecha TEXT
  CHECK (tipo_cosecha IS NULL OR tipo_cosecha IN ('selectiva', 'general'));
