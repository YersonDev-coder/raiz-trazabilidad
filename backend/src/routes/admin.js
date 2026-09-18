import { Router } from "express";
import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { httpError } from "../lib/errors.js";
import { crearUploaderImagen, urlPublica } from "../lib/uploads.js";
import { obtenerConfiguracion } from "../lib/configuracion.js";

const router = Router();
const uploadFondoLanding = crearUploaderImagen("sitio");

const upsertConfiguracion = db.prepare(`
  INSERT INTO configuracion_sitio (clave, valor) VALUES (@clave, @valor)
  ON CONFLICT(clave) DO UPDATE SET valor = @valor
`);

// Solo Administrador puede cambiar la imagen de fondo de la landing y el
// nombre mostrado de la plataforma.
router.put(
  "/configuracion",
  authenticate,
  authorize("admin"),
  uploadFondoLanding.single("imagen_fondo"),
  (req, res) => {
    const cambios = {};
    if (req.body?.nombre_plataforma !== undefined) {
      cambios.nombre_plataforma = req.body.nombre_plataforma;
    }
    if (req.file) {
      cambios.imagen_fondo_landing_url = urlPublica("sitio", req.file.filename);
    }

    if (Object.keys(cambios).length === 0) throw httpError(400, "Nada para actualizar");

    for (const [clave, valor] of Object.entries(cambios)) {
      upsertConfiguracion.run({ clave, valor });
    }

    registrarAuditoria(req.user.id, "actualizar_configuracion_sitio", "configuracion_sitio", null);

    res.json({ configuracion: obtenerConfiguracion() });
  }
);

// ============================================================================
// DEMOSTRACION ACADEMICA -- esto NO es un flujo de uso normal del sistema.
// Existe unicamente para poder mostrar en clase que verificarIntegridadLote()
// (ver lib/cadenaBloques.js) detecta una alteracion: modifica el contenido de
// un bloque YA EXISTENTE de la cadena hash sin recalcular su hash_actual,
// rompiendo deliberadamente la cadena a partir de ese bloque. Ningun flujo
// real de negocio llama a este endpoint.
// ============================================================================
router.post(
  "/cadena-bloques/:bloqueId/alterar-demo-academica",
  authenticate,
  authorize("admin"),
  (req, res) => {
    const { datos_evento } = req.body ?? {};
    if (!datos_evento || typeof datos_evento !== "object" || Array.isArray(datos_evento)) {
      throw httpError(400, "datos_evento (objeto) es requerido");
    }

    const bloque = db.prepare("SELECT * FROM cadena_bloques WHERE id = ?").get(req.params.bloqueId);
    if (!bloque) throw httpError(404, "Bloque no encontrado");

    const datosEventoAnterior = JSON.parse(bloque.datos_evento);
    const datosEventoNuevoJson = JSON.stringify(datos_evento);

    // A proposito: NO se toca hash_actual ni hash_anterior ni timestamp.
    // Eso es justo lo que hace que verificarIntegridadLote() detecte el
    // bloque como alterado.
    db.prepare("UPDATE cadena_bloques SET datos_evento = @datos_evento WHERE id = @id").run({
      datos_evento: datosEventoNuevoJson,
      id: bloque.id,
    });

    console.warn(
      `[DEMO ACADEMICA] Bloque #${bloque.id} (lote_id=${bloque.lote_id}, tipo_evento='${bloque.tipo_evento}') ` +
        `alterado manualmente por admin (usuario_id=${req.user.id}, email=${req.user.email}) sin recalcular ` +
        "hash_actual. Esto es una funcion de demostracion academica, no ocurre en el uso normal del sistema."
    );

    registrarAuditoria(
      req.user.id,
      "ALTERACION_DEMO_ACADEMICA_cadena_bloques",
      "cadena_bloques",
      bloque.id
    );

    res.json({
      aviso:
        "Bloque alterado manualmente con fines de demostracion academica -- el hash_actual NO fue " +
        "recalculado a proposito. Usa GET /api/lotes/:id/cadena para ver como verificarIntegridadLote() " +
        "detecta la ruptura.",
      bloque_id: bloque.id,
      lote_id: bloque.lote_id,
      datos_evento_anterior: datosEventoAnterior,
      datos_evento_nuevo: datos_evento,
      hash_actual_sin_recalcular: bloque.hash_actual,
    });
  }
);

export default router;
