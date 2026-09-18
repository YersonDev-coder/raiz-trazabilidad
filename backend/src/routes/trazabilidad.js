import { Router } from "express";
import db from "../db.js";
import { httpError } from "../lib/errors.js";
import { verificarIntegridadLote } from "../lib/cadenaBloques.js";
import { certificacionesPublicasDeLote } from "../lib/certificaciones.js";
import { construirFichaLote } from "../lib/fichaLote.js";

const router = Router();

// Gate de visibilidad publica: antes se exigia que Procesamiento estuviera
// validado (proxy de "SENASA ya certifico esto"), pero eso ya no describe
// bien el flujo -- desde que la ruta (A/B) se fija en Acopio, un lote Ruta A
// salta Procesamiento por completo, y desde que la certificacion
// fitosanitaria la aprueba el Administrador como documento real del
// Exportador (ver routes/certificaciones.js), "Procesamiento validado" ni
// siquiera implica que esa certificacion ya se reviso. El gate correcto,
// valido para ambas rutas, es: la certificacion fitosanitaria de este lote
// ya esta 'aprobado'.
function loteEsPublico(loteId) {
  return certificacionesPublicasDeLote(loteId).some((c) => c.tipo === "fitosanitaria");
}

// Resuelve el codigo escaneado: primero contra codigos_qr (nivel lote o
// unidad, aun sin endpoint de generacion pero la tabla ya existe), y si no
// hay match ahi, contra lotes.codigo_unico directamente -- que es lo unico
// que hoy en dia se puede generar y probar de punta a punta.
function resolverCodigo(codigo) {
  const qr = db.prepare("SELECT * FROM codigos_qr WHERE codigo = ?").get(codigo);
  if (qr) {
    return { loteId: qr.lote_id, nivel: qr.nivel, unidadId: qr.unidad_id };
  }

  const lote = db.prepare("SELECT id FROM lotes WHERE codigo_unico = ?").get(codigo);
  if (lote) {
    return { loteId: lote.id, nivel: "lote", unidadId: null };
  }

  return null;
}

router.get("/:codigo", (req, res) => {
  const resuelto = resolverCodigo(req.params.codigo);
  if (!resuelto) throw httpError(404, "Codigo no encontrado");

  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(resuelto.loteId);
  if (!lote) throw httpError(404, "Codigo no encontrado");

  // Solo se expone informacion una vez que la certificacion fitosanitaria
  // esta aprobada (ver loteEsPublico arriba) -- evita mostrar lotes que
  // todavia no llegaron ahi, con datos incompletos.
  if (!loteEsPublico(lote.id)) {
    throw httpError(404, "Este lote todavia no tiene informacion publica disponible");
  }

  res.json(construirFichaLote(lote, req.params.codigo, resuelto.nivel, resuelto.unidadId));
});

// Cadena de bloques del lote, para el "Explorador de cadena de bloques" de
// la ficha publica (Fase 2). Publica y sin token a proposito -- a
// diferencia de GET /api/lotes/:id/cadena (Fase 1, sigue intacto y solo
// para el panel interno autenticado), esta ruta resuelve el codigo igual
// que GET /:codigo de arriba, en vez de pedir el id numerico del lote, y no
// exige rol alguno. No toca lib/cadenaBloques.js: solo reutiliza
// verificarIntegridadLote(), la misma logica de verificacion que ya estaba
// implementada y probada en la Fase 1.
router.get("/:codigo/cadena", (req, res) => {
  const resuelto = resolverCodigo(req.params.codigo);
  if (!resuelto) throw httpError(404, "Codigo no encontrado");

  const lote = db.prepare("SELECT id, codigo_unico FROM lotes WHERE id = ?").get(resuelto.loteId);
  if (!lote) throw httpError(404, "Codigo no encontrado");

  // Mismo gate que GET /:codigo: sin esto se podria consultar la cadena de
  // un lote que todavia no es publico segun ese criterio, aunque el resto
  // de la ficha le devuelva 404.
  if (!loteEsPublico(lote.id)) {
    throw httpError(404, "Este lote todavia no tiene informacion publica disponible");
  }

  // Solo lo que necesita la vista de bloques (numero, tipo, hashes,
  // timestamp) -- a diferencia del endpoint interno de Fase 1, no se
  // expone datos_evento aqui: esta vista es sobre la cadena en si (hashes
  // encadenados), no una repeticion del detalle que ya muestra la linea de
  // tiempo de arriba.
  const bloques = db
    .prepare(
      "SELECT id, tipo_evento, hash_anterior, hash_actual, timestamp FROM cadena_bloques WHERE lote_id = ? ORDER BY id ASC"
    )
    .all(lote.id);

  res.json({
    codigo_consultado: req.params.codigo,
    lote: { codigo_unico: lote.codigo_unico },
    bloques,
    integridad: verificarIntegridadLote(lote.id),
  });
});

export default router;
