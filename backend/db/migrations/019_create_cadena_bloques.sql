-- Hash-chain SHA-256 por lote: simulacion academica de propiedades de
-- blockchain (inmutabilidad verificable) dentro del sistema convencional
-- que ya existe -- NO es una blockchain real distribuida, es una tabla mas
-- con hashes reales encadenados (ver lib/cadenaBloques.js para el calculo).
-- Cada lote tiene su PROPIA cadena independiente (hash_anterior enlaza
-- solo con el bloque previo de ESE lote_id, no una cadena global unica
-- entre lotes distintos).
CREATE TABLE cadena_bloques (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id        INTEGER NOT NULL REFERENCES lotes(id),
  tipo_evento    TEXT NOT NULL CHECK (tipo_evento IN (
                   'produccion',
                   'acopio',
                   'procesamiento',
                   'certificacion_senasa',
                   'exportacion',
                   'entrega_sunat'
                 )),
  datos_evento   TEXT NOT NULL,
  hash_anterior  TEXT NOT NULL,
  hash_actual    TEXT NOT NULL,
  timestamp      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cadena_bloques_lote_id ON cadena_bloques(lote_id);
