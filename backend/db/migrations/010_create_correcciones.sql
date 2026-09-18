-- Reemplazo de la inmutabilidad que blockchain daria automaticamente: un
-- registro 'validado' nunca se edita ni se borra. Si se descubre un error,
-- se crea una fila aqui enlazada al original por (registro_tabla,
-- registro_id_original), con el motivo, el autor y el nuevo valor propuesto.
CREATE TABLE correcciones (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_tabla         TEXT NOT NULL,
  registro_id_original   INTEGER NOT NULL,
  motivo                 TEXT NOT NULL,
  autor_id               INTEGER NOT NULL REFERENCES usuarios(id),
  nuevo_valor_json       TEXT NOT NULL,
  creado_en              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_correcciones_registro_original
  ON correcciones(registro_tabla, registro_id_original);
