import { Router } from "express";
import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { httpError } from "../lib/errors.js";
import { crearUploaderImagen, urlPublica } from "../lib/uploads.js";

const router = Router();
const uploadFotoParcela = crearUploaderImagen("parcelas");

const TIPOS_CULTIVO = ["cafe", "cacao", "ambos"];
const UNIDADES_EXTENSION = ["ha", "m2"];
const SISTEMAS_CULTIVO = ["monocultivo", "agroforestal"];
const ANIO_MINIMO_ESTABLECIMIENTO = 1900;

function conFotos(parcela) {
  const fotos = db
    .prepare("SELECT id, url, creado_en FROM fotos_parcela WHERE parcela_id = ? ORDER BY creado_en ASC")
    .all(parcela.id);
  return { ...parcela, fotos };
}

function listarPropias(req, res) {
  const parcelas = db
    .prepare("SELECT * FROM parcelas WHERE productor_id = ? ORDER BY creado_en DESC")
    .all(req.user.id)
    .map(conFotos);
  res.json({ parcelas });
}

// El Productor registra su parcela UNA vez (ya no se crea "de paso" dentro
// del formulario de cada cosecha). tipo_cultivo: que se produce ahi.
router.post("/", authenticate, authorize("productor"), (req, res) => {
  const {
    nombre_parcela,
    ubicacion_lat,
    ubicacion_lng,
    zona,
    tipo_cultivo,
    extension_valor,
    extension_unidad,
    altitud_msnm,
    anio_establecimiento,
    sistema_cultivo,
  } = req.body ?? {};
  if (!nombre_parcela) throw httpError(400, "nombre_parcela es requerido");
  if (tipo_cultivo && !TIPOS_CULTIVO.includes(tipo_cultivo)) {
    throw httpError(400, `tipo_cultivo debe ser uno de: ${TIPOS_CULTIVO.join(", ")}`);
  }
  // extension_unidad por defecto 'ha' si se dio un valor sin especificarla
  // -- el formulario del frontend siempre manda las dos juntas, pero no
  // hay razon para rechazar la request si en algun momento no lo hace.
  const unidadFinal = extension_valor != null ? extension_unidad || "ha" : null;
  if (unidadFinal && !UNIDADES_EXTENSION.includes(unidadFinal)) {
    throw httpError(400, `extension_unidad debe ser uno de: ${UNIDADES_EXTENSION.join(", ")}`);
  }

  let anioEstablecimientoFinal = null;
  if (anio_establecimiento != null && anio_establecimiento !== "") {
    const anio = Number(anio_establecimiento);
    if (!Number.isInteger(anio) || anio < ANIO_MINIMO_ESTABLECIMIENTO || anio > new Date().getFullYear()) {
      throw httpError(400, "anio_establecimiento debe ser un año válido");
    }
    anioEstablecimientoFinal = anio;
  }

  if (sistema_cultivo && !SISTEMAS_CULTIVO.includes(sistema_cultivo)) {
    throw httpError(400, `sistema_cultivo debe ser uno de: ${SISTEMAS_CULTIVO.join(", ")}`);
  }

  const info = db
    .prepare(
      `INSERT INTO parcelas (
         productor_id, nombre_parcela, ubicacion_lat, ubicacion_lng, zona, tipo_cultivo,
         extension_valor, extension_unidad, altitud_msnm, anio_establecimiento, sistema_cultivo
       )
       VALUES (
         @productor_id, @nombre_parcela, @ubicacion_lat, @ubicacion_lng, @zona, @tipo_cultivo,
         @extension_valor, @extension_unidad, @altitud_msnm, @anio_establecimiento, @sistema_cultivo
       )`
    )
    .run({
      productor_id: req.user.id,
      nombre_parcela,
      ubicacion_lat: ubicacion_lat ?? null,
      ubicacion_lng: ubicacion_lng ?? null,
      zona: zona ?? null,
      tipo_cultivo: tipo_cultivo ?? null,
      extension_valor: extension_valor ?? null,
      extension_unidad: unidadFinal,
      altitud_msnm: altitud_msnm === "" || altitud_msnm == null ? null : Number(altitud_msnm),
      anio_establecimiento: anioEstablecimientoFinal,
      sistema_cultivo: sistema_cultivo ?? null,
    });

  registrarAuditoria(req.user.id, "crear_parcela", "parcelas", info.lastInsertRowid);

  const parcela = db.prepare("SELECT * FROM parcelas WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ parcela: conFotos(parcela) });
});

// Lista las parcelas propias, para poblar el selector del formulario de
// registro de produccion sin tener que crear una parcela nueva cada vez.
// GET / y GET /mias hacen exactamente lo mismo: se mantiene GET / por
// compatibilidad con el frontend ya construido (no se toca en este turno),
// y se agrega /mias porque asi se pidio explicitamente esta vez.
router.get("/", authenticate, authorize("productor"), listarPropias);
router.get("/mias", authenticate, authorize("productor"), listarPropias);

// Sube una foto a la galeria general de la parcela (no es evidencia de una
// cosecha puntual, es la galeria propia de la parcela como entidad).
router.post(
  "/:id/fotos",
  authenticate,
  authorize("productor"),
  (req, res, next) => {
    const parcela = db.prepare("SELECT * FROM parcelas WHERE id = ?").get(req.params.id);
    if (!parcela) throw httpError(404, "Parcela no encontrada");
    if (parcela.productor_id !== req.user.id) {
      throw httpError(403, "La parcela no pertenece a este productor");
    }
    req.parcela = parcela;
    next();
  },
  uploadFotoParcela.single("foto"),
  (req, res) => {
    if (!req.file) throw httpError(400, "Debe adjuntar una imagen en el campo 'foto'");

    const url = urlPublica("parcelas", req.file.filename);
    const info = db
      .prepare("INSERT INTO fotos_parcela (parcela_id, url) VALUES (@parcela_id, @url)")
      .run({ parcela_id: req.parcela.id, url });

    registrarAuditoria(req.user.id, "subir_foto_parcela", "fotos_parcela", info.lastInsertRowid);

    const foto = db.prepare("SELECT id, parcela_id, url, creado_en FROM fotos_parcela WHERE id = ?").get(
      info.lastInsertRowid
    );
    res.status(201).json({ foto });
  }
);

export default router;
