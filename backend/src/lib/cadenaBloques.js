import crypto from "node:crypto";
import db from "../db.js";

// Simulacion academica de hash-chain (propiedades de blockchain -- cadena
// de bloques enlazados por hash, inmutabilidad verificable -- dentro del
// sistema convencional que ya existe). No es una blockchain real
// distribuida: es una tabla SQL con hashes SHA-256 reales encadenados, no
// texto que diga "hash" sin calculo detras.
//
// Cada lote tiene su propia cadena independiente: hash_anterior enlaza
// solo con el bloque previo de ESE lote_id (ORDER BY id, insercion es
// siempre secuencial dentro de un lote porque cada bloque se registra
// dentro de la misma transaccion que el evento que lo origina). El primer
// bloque de un lote usa HASH_GENESIS en vez de encadenar con otro lote.
const HASH_GENESIS = "0".repeat(64);

// El hash se calcula sobre el STRING ya serializado de datos_evento (no
// sobre el objeto JS) para que verificarIntegridadLote no dependa de que
// JSON.parse(JSON.stringify(x)) reproduzca bit a bit el mismo string --
// usa directamente lo que quedo guardado en la columna.
function calcularHash(datosEventoJson, hashAnterior, timestamp) {
  return crypto
    .createHash("sha256")
    .update(datosEventoJson + hashAnterior + timestamp)
    .digest("hex");
}

function timestampActual() {
  // Mismo formato (datetime('now') de SQLite: "YYYY-MM-DD HH:MM:SS") que
  // ya usan creado_en/validado_en en el resto del schema -- se pide aqui
  // explicitamente (en vez de confiar en el DEFAULT de la columna) porque
  // el valor exacto tiene que quedar fijo ANTES de calcular el hash.
  return db.prepare("SELECT datetime('now') AS t").get().t;
}

// Ultimo bloque de un lote especifico (no global): el que tiene el id mas
// alto para ese lote_id. Como cada bloque se inserta dentro de la misma
// transaccion sincronica que su evento de origen, no hay condicion de
// carrera real entre bloques del mismo lote en este sistema de un solo
// proceso Node.
function ultimoBloqueDe(loteId) {
  return db
    .prepare("SELECT * FROM cadena_bloques WHERE lote_id = ? ORDER BY id DESC LIMIT 1")
    .get(loteId);
}

// Agrega un bloque nuevo a la cadena de un lote. `datosEvento` es un
// objeto plano (actor, campos especificos de la etapa, etc.) -- se
// serializa una sola vez aqui y ese mismo string es lo que se hashea y lo
// que se guarda, para que la verificacion posterior sea un recalculo
// exacto, no una re-serializacion.
export function registrarBloque(loteId, tipoEvento, datosEvento) {
  const anterior = ultimoBloqueDe(loteId);
  const hashAnterior = anterior ? anterior.hash_actual : HASH_GENESIS;
  const timestamp = timestampActual();
  const datosEventoJson = JSON.stringify(datosEvento);
  const hashActual = calcularHash(datosEventoJson, hashAnterior, timestamp);

  const info = db
    .prepare(
      `INSERT INTO cadena_bloques (lote_id, tipo_evento, datos_evento, hash_anterior, hash_actual, timestamp)
       VALUES (@lote_id, @tipo_evento, @datos_evento, @hash_anterior, @hash_actual, @timestamp)`
    )
    .run({
      lote_id: loteId,
      tipo_evento: tipoEvento,
      datos_evento: datosEventoJson,
      hash_anterior: hashAnterior,
      hash_actual: hashActual,
      timestamp,
    });

  return db.prepare("SELECT * FROM cadena_bloques WHERE id = ?").get(info.lastInsertRowid);
}

// Recorre la cadena de un lote en orden y recalcula cada hash_actual a
// partir de sus propios datos_evento + hash_anterior + timestamp,
// comparando contra lo guardado. Dos formas de romperse:
//   1. hash_anterior de un bloque no coincide con el hash_actual real del
//      bloque previo (alguien reordeno o borro un bloque intermedio).
//   2. hash_actual no coincide con el recalculo (alguien edito
//      datos_evento, hash_anterior o timestamp de ese bloque sin
//      recalcular -- exactamente lo que hace el endpoint de alteracion
//      academica).
// Se detiene en el PRIMER bloque roto (igual que una blockchain real: todo
// lo que viene despues ya es no confiable, no tiene sentido seguir).
export function verificarIntegridadLote(loteId) {
  const bloques = db
    .prepare("SELECT * FROM cadena_bloques WHERE lote_id = ? ORDER BY id ASC")
    .all(loteId);

  let hashPrevioEsperado = HASH_GENESIS;
  for (const bloque of bloques) {
    if (bloque.hash_anterior !== hashPrevioEsperado) {
      return {
        integro: false,
        bloque_id: bloque.id,
        tipo_evento: bloque.tipo_evento,
        motivo: "hash_anterior no coincide con el hash_actual del bloque previo de este lote",
        total_bloques: bloques.length,
      };
    }

    const hashRecalculado = calcularHash(bloque.datos_evento, bloque.hash_anterior, bloque.timestamp);
    if (hashRecalculado !== bloque.hash_actual) {
      return {
        integro: false,
        bloque_id: bloque.id,
        tipo_evento: bloque.tipo_evento,
        motivo: "hash_actual no coincide con el recalculo -- los datos de este bloque fueron alterados",
        total_bloques: bloques.length,
      };
    }

    hashPrevioEsperado = bloque.hash_actual;
  }

  return {
    integro: true,
    bloque_id: null,
    tipo_evento: null,
    motivo: null,
    total_bloques: bloques.length,
  };
}
