import { Router } from "express";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { httpError } from "../lib/errors.js";
import { crearUploaderImagen, urlPublica } from "../lib/uploads.js";

const router = Router();
const uploadFotoPerfil = crearUploaderImagen("perfiles");

// Se llama "CAMPOS_PUBLICOS" por el nombre historico (info que no es la
// contraseña), pero ojo: se usa para GET/PUT /perfil, que es SIEMPRE la
// propia cuenta autenticada -- no confundir con lo que de verdad se expone
// sin login (ver usuarioPublico() en routes/trazabilidad.js y
// GET /:id/actividad-publica mas abajo, que excluyen codigo_productor a
// proposito). Aca si va codigo_productor: el propio productor puede ver su
// identificador interno.
const CAMPOS_PUBLICOS =
  "id, nombre, email, rol, nombre_publico, foto_perfil_url, anio_inicio_actividad, generacion_familiar, historia, asociacion_cooperativa, practicas_agricolas, codigo_productor";

const GENERACIONES = ["1ra", "2da", "3ra_o_mas"];
const HISTORIA_MAX = 500;
const PRACTICAS_VALIDAS = ["convencional", "organico", "agroecologico"];

router.get("/perfil", authenticate, (req, res) => {
  const usuario = db.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`).get(req.user.id);
  res.json({ usuario });
});

// Publico, sin autenticacion: es lo que consume la tarjeta de perfil que
// aparece al hacer click en un actor dentro de la linea de tiempo de
// /trazabilidad/:codigo (ver TrazabilidadPublicaPage.jsx). Mismo criterio
// de "que informacion es publica" que el resto de la ficha:
//   - identidad (nombre_publico/foto) -- ya es publica por diseño, es lo
//     que el propio usuario configuro para que el comprador final la vea.
//   - parcelas (solo si es productor) -- info de la finca, no datos
//     sensibles (no se expone email ni telefono).
//   - lotes -- SOLO los que ya son visibles publicamente en el catalogo/
//     trazabilidad (registros_procesamiento validado), para no filtrar
//     lotes todavia en borrador de un actor a traves de su perfil.
router.get("/:id/actividad-publica", (req, res) => {
  // asociacion_cooperativa (migracion 023): igual criterio que
  // anio_inicio_actividad/generacion_familiar/historia arriba, dato publico
  // que el propio productor eligio compartir. NO se incluye
  // practicas_agricolas (no pedido como publico) ni codigo_productor
  // (identificador interno/admin, nunca publico). certificaciones_productor
  // existio brevemente (migracion 023) pero se elimino (migracion 026): una
  // certificacion la otorga un tercero auditor, no el propio productor
  // autodeclarandola -- ver el paso de Certificacion dentro de
  // Procesamiento para el flujo real.
  const usuario = db
    .prepare(
      `SELECT id, nombre, nombre_publico, rol, foto_perfil_url,
              anio_inicio_actividad, generacion_familiar, historia,
              asociacion_cooperativa
       FROM usuarios WHERE id = ?`
    )
    .get(req.params.id);
  if (!usuario) throw httpError(404, "Usuario no encontrado");

  let parcelas = [];
  if (usuario.rol === "productor") {
    parcelas = db
      .prepare(
        `SELECT p.id, p.nombre_parcela, p.zona, p.tipo_cultivo,
                (SELECT url FROM fotos_parcela fp WHERE fp.parcela_id = p.id ORDER BY fp.creado_en ASC LIMIT 1) AS foto
         FROM parcelas p
         WHERE p.productor_id = ?
         ORDER BY p.creado_en DESC`
      )
      .all(usuario.id);
  }

  const lotes = db
    .prepare(
      `SELECT DISTINCT l.id, l.codigo_unico, l.tipo_producto, l.ruta, rp.variedad
       FROM lotes l
       JOIN registros_procesamiento procvalido
         ON procvalido.lote_id = l.id AND procvalido.estado = 'validado'
       LEFT JOIN registros_produccion rp ON rp.lote_id = l.id
       WHERE l.id IN (
         SELECT lote_id FROM registros_produccion WHERE actor_id = @id
         UNION SELECT lote_id FROM registros_acopio WHERE actor_id = @id
         UNION SELECT lote_id FROM registros_procesamiento WHERE actor_id = @id
         UNION SELECT lote_id FROM registros_exportacion WHERE actor_id = @id
       )
       ORDER BY l.creado_en DESC`
    )
    .all({ id: usuario.id });

  res.json({
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      nombre_publico: usuario.nombre_publico,
      rol: usuario.rol,
      foto_perfil_url: usuario.foto_perfil_url,
      anio_inicio_actividad: usuario.anio_inicio_actividad,
      generacion_familiar: usuario.generacion_familiar,
      historia: usuario.historia,
      asociacion_cooperativa: usuario.asociacion_cooperativa,
    },
    parcelas,
    lotes,
  });
});

// Cualquier usuario autenticado edita su propio nombre_publico y/o sube su
// foto de perfil. nombre_publico es el nombre que vera el comprador final
// en la ficha de trazabilidad (mas relevante para Productor, pero no se
// restringe por rol: es un campo cosmetico sin riesgo para otros roles).
router.put("/perfil", authenticate, uploadFotoPerfil.single("foto"), (req, res) => {
  const cambios = {};
  if (req.body?.nombre_publico !== undefined) cambios.nombre_publico = req.body.nombre_publico;
  if (req.file) cambios.foto_perfil_url = urlPublica("perfiles", req.file.filename);

  // Los 3 campos del perfil extendido llegan como texto plano (multipart,
  // igual que nombre_publico) -- "" se trata como "lo dejo vacio a
  // proposito" (limpia el campo), no como "no se toco" (eso es undefined).
  if (req.body?.anio_inicio_actividad !== undefined) {
    const valor = req.body.anio_inicio_actividad;
    if (valor === "") {
      cambios.anio_inicio_actividad = null;
    } else {
      const anio = Number(valor);
      if (!Number.isInteger(anio) || anio < 1900 || anio > new Date().getFullYear()) {
        throw httpError(400, "anio_inicio_actividad debe ser un año válido");
      }
      cambios.anio_inicio_actividad = anio;
    }
  }

  if (req.body?.generacion_familiar !== undefined) {
    const valor = req.body.generacion_familiar;
    if (valor === "") {
      cambios.generacion_familiar = null;
    } else if (!GENERACIONES.includes(valor)) {
      throw httpError(400, `generacion_familiar debe ser uno de: ${GENERACIONES.join(", ")}`);
    } else {
      cambios.generacion_familiar = valor;
    }
  }

  if (req.body?.historia !== undefined) {
    const valor = req.body.historia;
    if (valor.length > HISTORIA_MAX) {
      throw httpError(400, `historia no puede superar los ${HISTORIA_MAX} caracteres`);
    }
    cambios.historia = valor === "" ? null : valor;
  }

  if (req.body?.asociacion_cooperativa !== undefined) {
    const valor = req.body.asociacion_cooperativa;
    cambios.asociacion_cooperativa = valor === "" ? null : valor;
  }

  if (req.body?.practicas_agricolas !== undefined) {
    const valor = req.body.practicas_agricolas;
    if (valor === "") {
      cambios.practicas_agricolas = null;
    } else if (!PRACTICAS_VALIDAS.includes(valor)) {
      throw httpError(400, `practicas_agricolas debe ser uno de: ${PRACTICAS_VALIDAS.join(", ")}`);
    } else {
      cambios.practicas_agricolas = valor;
    }
  }

  if (Object.keys(cambios).length === 0) throw httpError(400, "Nada para actualizar");

  const set = Object.keys(cambios)
    .map((campo) => `${campo} = @${campo}`)
    .join(", ");
  db.prepare(`UPDATE usuarios SET ${set} WHERE id = @id`).run({ ...cambios, id: req.user.id });

  registrarAuditoria(req.user.id, "actualizar_perfil", "usuarios", req.user.id);

  const usuario = db.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`).get(req.user.id);
  res.json({ usuario });
});

export default router;
