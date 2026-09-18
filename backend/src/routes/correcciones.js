import { Router } from "express";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { httpError } from "../lib/errors.js";

const router = Router();

// Tablas de registro con el ciclo borrador/validado que pueden tener una
// correccion. No se permite corregir cualquier tabla arbitraria (whitelist).
const TABLAS_CORREGIBLES = [
  "registros_produccion",
  "registros_acopio",
  "registros_procesamiento",
  "registros_exportacion",
];

// Abierto a cualquier rol autenticado: el motivo de la correccion y el
// autor_id quedan registrados, y quien la creo puede ser cualquier actor
// que detecte el error (no solo el validador original).
router.post("/", authenticate, (req, res) => {
  const { registro_tabla, registro_id_original, motivo, nuevo_valor_json } = req.body ?? {};

  if (!TABLAS_CORREGIBLES.includes(registro_tabla)) {
    throw httpError(400, `registro_tabla debe ser uno de: ${TABLAS_CORREGIBLES.join(", ")}`);
  }
  if (!registro_id_original) throw httpError(400, "registro_id_original es requerido");
  if (!motivo) throw httpError(400, "motivo es requerido");
  if (nuevo_valor_json === undefined) throw httpError(400, "nuevo_valor_json es requerido");

  const original = db
    .prepare(`SELECT * FROM ${registro_tabla} WHERE id = ?`)
    .get(registro_id_original);
  if (!original) throw httpError(404, "El registro original no existe");
  if (original.estado !== "validado") {
    throw httpError(400, "Solo se puede corregir un registro que ya este validado");
  }

  const info = db
    .prepare(
      `INSERT INTO correcciones (registro_tabla, registro_id_original, motivo, autor_id, nuevo_valor_json)
       VALUES (@registro_tabla, @registro_id_original, @motivo, @autor_id, @nuevo_valor_json)`
    )
    .run({
      registro_tabla,
      registro_id_original,
      motivo,
      autor_id: req.user.id,
      nuevo_valor_json: JSON.stringify(nuevo_valor_json),
    });

  registrarAuditoria(req.user.id, "crear_correccion", registro_tabla, registro_id_original);

  const correccion = db.prepare("SELECT * FROM correcciones WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({
    correccion: { ...correccion, nuevo_valor_json: JSON.parse(correccion.nuevo_valor_json) },
  });
});

export default router;
