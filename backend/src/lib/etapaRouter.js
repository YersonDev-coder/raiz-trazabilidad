import { Router } from "express";
import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { registrarAuditoria } from "./auditoria.js";
import { httpError } from "./errors.js";

/**
 * Factory que arma el patron borrador -> validado repetido en cada etapa
 * (produccion, acopio, procesamiento, exportacion):
 *   POST   /            crea el registro en borrador (rolActor), solo si el
 *                        lote esta en `etapaMacro`
 *   PUT    /:id         edita, solo si esta en borrador y el editor es quien
 *                        lo creo
 *   POST   /:id/validar cambia a validado (rolValidador) y avanza
 *                        lotes.estado_macro a `siguienteEtapaMacro`
 *
 * `antesDeCrear(req, lote, datos)` y `antesDeValidar(req, lote, registro)`
 * son hooks opcionales para reglas propias de cada etapa (p.ej. verificar
 * dueño de parcela, o fijar la ruta A/B del lote). Deben lanzar
 * `httpError(status, mensaje)` para abortar.
 *
 * `despuesDeCrear(req, lote, registro)` es un hook opcional que corre
 * DESPUES del insert pero dentro de la misma transaccion (p.ej. emitir el
 * QR de Ruta B al registrar procesamiento). `lote` aqui ya refleja
 * cualquier cambio hecho en `antesDeCrear` (por ejemplo `ruta`), a
 * diferencia del `lote` que recibe `antesDeCrear`. Debe lanzar
 * `httpError(status, mensaje)` para abortar (hace rollback del insert).
 *
 * `despuesDeValidar(req, lote, registro)` es el equivalente para
 * POST /:id/validar: corre DESPUES de marcar el registro validado y
 * avanzar `lotes.estado_macro`, dentro de la misma transaccion, con el
 * `registro`/`lote` ya actualizados (p.ej. agregar un bloque a la cadena
 * hash de ese lote). Debe lanzar `httpError(status, mensaje)` para abortar
 * (hace rollback de ambos UPDATE).
 *
 * `conExtra(registro)` es un hook opcional para enriquecer cada fila antes
 * de responder en GET / y GET /pendientes (p.ej. Produccion lo usa para
 * embeber las fotos de evidencia). Por defecto no hace nada, asi que las
 * demas etapas no se ven afectadas.
 */
export function crearRouterEtapa({
  tabla,
  campos,
  rolActor,
  rolValidador,
  etapaMacro,
  siguienteEtapaMacro,
  antesDeCrear,
  despuesDeCrear,
  antesDeValidar,
  despuesDeValidar,
  conExtra = (registro) => registro,
}) {
  const router = Router();

  // Lista los propios registros (los creados por el usuario autenticado),
  // con el codigo y estado_macro del lote para dar contexto sin que el
  // frontend tenga que pedir cada lote por separado.
  router.get("/", authenticate, authorize(rolActor), (req, res) => {
    const registros = db
      .prepare(
        `SELECT r.*, l.codigo_unico AS lote_codigo_unico, l.estado_macro AS lote_estado_macro,
                l.tipo_producto AS lote_tipo_producto, l.ruta AS lote_ruta,
                EXISTS(SELECT 1 FROM codigos_qr q WHERE q.lote_id = l.id) AS lote_tiene_qr
         FROM ${tabla} r
         JOIN lotes l ON l.id = r.lote_id
         WHERE r.actor_id = ?
         ORDER BY r.creado_en DESC`
      )
      .all(req.user.id)
      .map((r) => conExtra({ ...r, lote_tiene_qr: Boolean(r.lote_tiene_qr) }));
    res.json({ registros });
  });

  // Lista los registros en borrador, pendientes de que `rolValidador` los
  // apruebe. No se filtra por quien los creo (cualquier usuario del rol
  // validador puede validar cualquiera, igual que en POST /:id/validar).
  // `rechazado_en IS NULL` saca de esta lista lo que el propio validador
  // acaba de rechazar -- vuelve a aparecer solo cuando el actor lo corrige
  // (PUT /:id limpia rechazado_en al reenviar, ver abajo).
  router.get("/pendientes", authenticate, authorize(rolValidador), (req, res) => {
    const registros = db
      .prepare(
        `SELECT r.*, l.codigo_unico AS lote_codigo_unico, l.tipo_producto AS lote_tipo_producto,
                l.ruta AS lote_ruta, u.nombre AS actor_nombre,
                EXISTS(SELECT 1 FROM codigos_qr q WHERE q.lote_id = l.id) AS lote_tiene_qr
         FROM ${tabla} r
         JOIN lotes l ON l.id = r.lote_id
         JOIN usuarios u ON u.id = r.actor_id
         WHERE r.estado = 'borrador' AND r.rechazado_en IS NULL
         ORDER BY r.creado_en ASC`
      )
      .all()
      .map((r) => conExtra({ ...r, lote_tiene_qr: Boolean(r.lote_tiene_qr) }));
    res.json({ registros });
  });

  router.post("/", authenticate, authorize(rolActor), (req, res) => {
    const { lote_id, ...datos } = req.body ?? {};
    if (!lote_id) throw httpError(400, "lote_id es requerido");

    const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(lote_id);
    if (!lote) throw httpError(404, "Lote no encontrado");

    if (lote.estado_macro !== etapaMacro) {
      throw httpError(
        409,
        `El lote esta en la etapa '${lote.estado_macro}', no se puede registrar '${etapaMacro}' todavia`
      );
    }

    if (antesDeCrear) antesDeCrear(req, lote, datos);

    const columnas = campos.filter((c) => datos[c] !== undefined);
    const params = { lote_id, actor_id: req.user.id };
    for (const c of columnas) params[c] = datos[c];

    const nombresColumnas = ["lote_id", "actor_id", ...columnas].join(", ");
    const placeholders = ["@lote_id", "@actor_id", ...columnas.map((c) => `@${c}`)].join(", ");

    let creado, loteActual;
    db.exec("BEGIN");
    try {
      const info = db
        .prepare(`INSERT INTO ${tabla} (${nombresColumnas}) VALUES (${placeholders})`)
        .run(params);

      registrarAuditoria(req.user.id, "crear_registro", tabla, info.lastInsertRowid);

      creado = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(info.lastInsertRowid);
      loteActual = db.prepare("SELECT * FROM lotes WHERE id = ?").get(lote_id);

      if (despuesDeCrear) despuesDeCrear(req, loteActual, creado);

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    res.status(201).json({ registro: conExtra(creado), lote: loteActual });
  });

  router.put("/:id", authenticate, authorize(rolActor), (req, res) => {
    const registro = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(req.params.id);
    if (!registro) throw httpError(404, "Registro no encontrado");

    if (registro.actor_id !== req.user.id) {
      throw httpError(403, "Solo quien creo el registro puede editarlo");
    }
    if (registro.estado !== "borrador") {
      throw httpError(
        409,
        "El registro ya fue validado y no se puede editar; use POST /api/correcciones"
      );
    }

    const body = req.body ?? {};
    const cambios = campos.filter((c) => body[c] !== undefined);
    if (cambios.length === 0) throw httpError(400, "Nada para actualizar");

    const params = { id: registro.id };
    for (const c of cambios) params[c] = body[c];

    // Editar un registro rechazado ES el "corregir y reenviar": limpia el
    // rechazo (motivo/quien/cuando) para que vuelva a aparecer en
    // GET /pendientes del validador, igual que antes de que lo rechazaran.
    // El motivo anterior queda en `auditoria` (registrarAuditoria de
    // rechazar_registro), no se pierde, solo deja de ser el estado "activo".
    // Si el registro no estaba rechazado, esto no cambia nada (ya eran NULL).
    const set = [
      ...cambios.map((c) => `${c} = @${c}`),
      "motivo_rechazo = NULL",
      "rechazado_por = NULL",
      "rechazado_en = NULL",
    ].join(", ");
    db.prepare(`UPDATE ${tabla} SET ${set} WHERE id = @id`).run(params);

    registrarAuditoria(req.user.id, "editar_registro", tabla, registro.id);

    const actualizado = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(registro.id);
    res.json({ registro: actualizado });
  });

  // El registro rechazado NUNCA llega a 'validado' -- se queda en
  // 'borrador' (nunca salio de ahi), solo se le agregan los metadatos del
  // rechazo. Mismas guardas que /:id/validar (estado y etapa del lote)
  // porque es la misma decision que /:id/validar, con el resultado
  // opuesto. motivo es obligatorio: sin el, el actor no sabe que corregir.
  router.post("/:id/rechazar", authenticate, authorize(rolValidador), (req, res) => {
    const motivo = (req.body?.motivo ?? "").trim();
    if (!motivo) throw httpError(400, "El motivo de rechazo es requerido");

    const registro = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(req.params.id);
    if (!registro) throw httpError(404, "Registro no encontrado");
    if (registro.estado === "validado") {
      throw httpError(409, "El registro ya esta validado, no se puede rechazar");
    }

    const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(registro.lote_id);
    if (lote.estado_macro !== etapaMacro) {
      throw httpError(
        409,
        `El lote ya no esta en la etapa '${etapaMacro}' (esta en '${lote.estado_macro}')`
      );
    }

    db.prepare(
      `UPDATE ${tabla} SET motivo_rechazo = @motivo, rechazado_por = @rechazado_por, rechazado_en = datetime('now') WHERE id = @id`
    ).run({ motivo, rechazado_por: req.user.id, id: registro.id });

    registrarAuditoria(req.user.id, "rechazar_registro", tabla, registro.id);

    const registroActualizado = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(registro.id);
    res.json({ registro: conExtra(registroActualizado) });
  });

  router.post("/:id/validar", authenticate, authorize(rolValidador), (req, res) => {
    const registro = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(req.params.id);
    if (!registro) throw httpError(404, "Registro no encontrado");
    if (registro.estado === "validado") {
      throw httpError(409, "El registro ya esta validado");
    }

    const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(registro.lote_id);
    if (lote.estado_macro !== etapaMacro) {
      throw httpError(
        409,
        `El lote ya no esta en la etapa '${etapaMacro}' (esta en '${lote.estado_macro}')`
      );
    }

    if (antesDeValidar) antesDeValidar(req, lote, registro);

    let registroActualizado, loteActualizado;
    db.exec("BEGIN");
    try {
      db.prepare(
        `UPDATE ${tabla} SET estado = 'validado', validado_por = @validado_por, validado_en = datetime('now') WHERE id = @id`
      ).run({ validado_por: req.user.id, id: registro.id });

      db.prepare("UPDATE lotes SET estado_macro = @estado_macro WHERE id = @id").run({
        estado_macro: siguienteEtapaMacro,
        id: lote.id,
      });

      registrarAuditoria(req.user.id, "validar_registro", tabla, registro.id);

      registroActualizado = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(registro.id);
      loteActualizado = db.prepare("SELECT * FROM lotes WHERE id = ?").get(lote.id);

      if (despuesDeValidar) despuesDeValidar(req, loteActualizado, registroActualizado);

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    res.json({ registro: registroActualizado, lote: loteActualizado });
  });

  return router;
}
