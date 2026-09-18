import { Router } from "express";
import db from "../db.js";

const router = Router();

// Publico, sin autenticacion: catalogo tipo marketplace para el
// comprador/publico general. Mismo criterio de exposicion que
// GET /trazabilidad/:codigo (certificacion fitosanitaria aprobada en
// adelante, ver loteEsPublico() ahi) para que nunca aparezca un lote con
// informacion incompleta.
router.get("/", (req, res) => {
  const { tipo_producto, ruta, zona } = req.query;

  const condiciones = [];
  const params = {};

  if (tipo_producto) {
    condiciones.push("l.tipo_producto = @tipo_producto");
    params.tipo_producto = tipo_producto;
  }
  if (ruta) {
    condiciones.push("l.ruta = @ruta");
    params.ruta = ruta;
  }
  if (zona) {
    condiciones.push("p.zona = @zona");
    params.zona = zona;
  }

  // El gate (solo lotes con la certificacion fitosanitaria ya aprobada) es
  // un JOIN, no un EXISTS -- ademas de filtrar, esto da acceso a
  // cf.validado_en para el ORDER BY (cuando el Administrador aprobo esa
  // certificacion, que es lo que de verdad indica que "acaba de estar
  // listo para el catalogo"). Antes el gate era "Procesamiento validado"
  // (proxy de que SENASA ya habia certificado), pero eso ya no aplica: un
  // lote Ruta A nunca pasa por Procesamiento, y en Ruta B "Procesamiento
  // validado" ahora solo significa que el Administrador confirmo el
  // trabajo de Planta, no que aprobo la certificacion fitosanitaria (eso
  // es un paso aparte, ver routes/certificaciones.js). Solo puede haber
  // una certificacion 'fitosanitaria' por lote (UNIQUE de facto: el POST
  // que la crea rechaza duplicados), asi que el JOIN no duplica filas.
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const items = db
    .prepare(
      `SELECT
         l.codigo_unico AS codigo,
         l.tipo_producto,
         l.ruta,
         rp.variedad,
         p.zona,
         u.nombre AS productor_nombre,
         (SELECT COUNT(*) FROM certificaciones c
          WHERE c.lote_id = l.id AND c.estado = 'aprobado') AS certificaciones_aprobadas,
         COALESCE(
           (SELECT url FROM fotos_registro_produccion
            WHERE registro_produccion_id = rp.id ORDER BY creado_en ASC LIMIT 1),
           (SELECT url FROM fotos_parcela
            WHERE parcela_id = p.id ORDER BY creado_en ASC LIMIT 1)
         ) AS foto_url
       FROM lotes l
       JOIN registros_produccion rp ON rp.lote_id = l.id AND rp.estado = 'validado'
       JOIN parcelas p ON p.id = rp.parcela_id
       JOIN usuarios u ON u.id = rp.actor_id
       JOIN certificaciones cf ON cf.lote_id = l.id AND cf.tipo = 'fitosanitaria' AND cf.estado = 'aprobado'
       ${where}
       ORDER BY cf.validado_en DESC`
    )
    .all(params);

  res.json({ items });
});

export default router;
