-- Extension de la parcela (valor + unidad por separado, no normalizado a
-- una sola unidad interna, para no perder precision/intencion de lo que el
-- productor realmente ingreso -- el frontend formatea "X ha" / "X m2" segun
-- estos dos campos) y certificado de no vinculacion a deforestacion, ambos
-- opcionales. certificado_no_deforestacion es 0/1 (SQLite no tiene tipo
-- boolean nativo, mismo criterio que el resto del schema); *_detalle solo
-- tiene sentido cuando el checkbox esta marcado, pero no se fuerza esa
-- relacion con un CHECK -- se deja a criterio de la app, igual que otros
-- campos condicionales del proyecto (ver ruta/detalles_json en
-- registros_procesamiento).
ALTER TABLE parcelas ADD COLUMN extension_valor REAL;
ALTER TABLE parcelas ADD COLUMN extension_unidad TEXT
  CHECK (extension_unidad IS NULL OR extension_unidad IN ('ha', 'm2'));
ALTER TABLE parcelas ADD COLUMN certificado_no_deforestacion INTEGER NOT NULL DEFAULT 0
  CHECK (certificado_no_deforestacion IN (0, 1));
ALTER TABLE parcelas ADD COLUMN certificado_detalle TEXT;
