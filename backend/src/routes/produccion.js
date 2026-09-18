import db from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { crearRouterEtapa } from "../lib/etapaRouter.js";
import { httpError } from "../lib/errors.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { crearUploaderImagen, urlPublica } from "../lib/uploads.js";
import { registrarBloque } from "../lib/cadenaBloques.js";

const MAX_FOTOS = 4;
const uploadFotosProduccion = crearUploaderImagen("produccion");

// estado_grano: 2 opciones por cultivo (ver migracion 025) -- las de cafe
// solo tienen sentido en un lote de cafe, las de cacao solo en uno de
// cacao. Se valida el cruce en antesDeCrear, mismo criterio que
// tipo_producto/tipo_cultivo de la parcela un poco mas abajo.
const ESTADOS_GRANO_POR_PRODUCTO = {
  cafe: ["cereza_fresca", "cereza_sobremadura"],
  cacao: ["mazorca", "mazorca_partida"],
};
const TIPOS_COSECHA = ["selectiva", "general"];

function fotosDe(registroId) {
  return db
    .prepare(
      "SELECT id, url, creado_en FROM fotos_registro_produccion WHERE registro_produccion_id = ? ORDER BY creado_en ASC"
    )
    .all(registroId);
}

function conFotos(registro) {
  return { ...registro, fotos: fotosDe(registro.id) };
}

const router = crearRouterEtapa({
  tabla: "registros_produccion",
  campos: ["parcela_id", "variedad", "fecha_cosecha", "volumen_kg", "estado_grano", "tipo_cosecha"],
  rolActor: "productor",
  rolValidador: "cooperativa",
  etapaMacro: "produccion",
  siguienteEtapaMacro: "acopio",
  antesDeCrear(req, lote, datos) {
    if (!datos.parcela_id) throw httpError(400, "parcela_id es requerido");

    const parcela = db.prepare("SELECT * FROM parcelas WHERE id = ?").get(datos.parcela_id);
    if (!parcela) throw httpError(404, "Parcela no encontrada");
    if (parcela.productor_id !== req.user.id) {
      throw httpError(403, "La parcela no pertenece a este productor");
    }
    // El tipo de producto se fija al crear el lote (POST /api/lotes), no
    // aca -- pero la parcela elegida recien se conoce en este paso. Si la
    // parcela tiene un cultivo unico definido (no NULL, no 'ambos') debe
    // coincidir con el tipo_producto del lote al que se esta asociando
    // este registro; si no, es un estado inconsistente (ej. cosecha de
    // cacao asociada a una parcela de cafe). 'ambos'/NULL se dejan pasar
    // sin exigir coincidencia: ahi no hay un unico cultivo del que derivar.
    if (
      parcela.tipo_cultivo &&
      parcela.tipo_cultivo !== "ambos" &&
      parcela.tipo_cultivo !== lote.tipo_producto
    ) {
      throw httpError(
        409,
        `La parcela "${parcela.nombre_parcela}" esta registrada para cultivo de ${parcela.tipo_cultivo}, pero este lote es de ${lote.tipo_producto}. El tipo de producto del lote debe coincidir con el cultivo de la parcela.`
      );
    }

    // estado_grano y tipo_cosecha son opcionales -- solo se valida cuando
    // llegan. Mismo espiritu que el chequeo de arriba: no basta con que el
    // frontend oculte las opciones que no aplican, alguien podria llamar
    // al endpoint directo y mandar "mazorca" en un lote de cafe.
    if (datos.estado_grano !== undefined && datos.estado_grano !== null && datos.estado_grano !== "") {
      const estadosValidos = ESTADOS_GRANO_POR_PRODUCTO[lote.tipo_producto] ?? [];
      if (!estadosValidos.includes(datos.estado_grano)) {
        throw httpError(
          409,
          `estado_grano "${datos.estado_grano}" no corresponde a un lote de ${lote.tipo_producto}. Debe ser uno de: ${estadosValidos.join(", ")}`
        );
      }
    }
    if (datos.tipo_cosecha !== undefined && datos.tipo_cosecha !== null && datos.tipo_cosecha !== "" && !TIPOS_COSECHA.includes(datos.tipo_cosecha)) {
      throw httpError(400, `tipo_cosecha debe ser uno de: ${TIPOS_COSECHA.join(", ")}`);
    }
  },
  // Primer bloque de la cadena hash de este lote (ver lib/cadenaBloques.js)
  // -- se registra al crear, no al validar, porque este es el punto donde
  // ya existen datos reales de la cosecha (no hay nada que "certificar"
  // todavia, la validacion de Cooperativa es una etapa aparte).
  despuesDeCrear(req, lote, registro) {
    registrarBloque(lote.id, "produccion", {
      actor_id: registro.actor_id,
      parcela_id: registro.parcela_id,
      variedad: registro.variedad,
      fecha_cosecha: registro.fecha_cosecha,
      volumen_kg: registro.volumen_kg,
    });
  },
  conExtra: conFotos,
});

// Fotos de evidencia de ESTA cosecha puntual (distinto de la galeria
// general de la parcela, ver fotos_parcela). Visibles para cualquier
// usuario autenticado: son las mismas imagenes que terminan expuestas sin
// login en /trazabilidad, asi que restringir su lectura interna no aporta
// seguridad real.
router.get("/:id/fotos", authenticate, (req, res) => {
  const registro = db.prepare("SELECT id FROM registros_produccion WHERE id = ?").get(req.params.id);
  if (!registro) throw httpError(404, "Registro no encontrado");
  res.json({ fotos: fotosDe(registro.id) });
});

// Solo quien creo el registro puede subir fotos, y solo mientras siga en
// borrador (mismo criterio de inmutabilidad que PUT /:id) -- esto tambien
// cubre el caso de un borrador viejo sin fotos: se le pueden agregar
// mientras no se haya validado. Una vez validado, ya no se puede tocar.
router.post(
  "/:id/fotos",
  authenticate,
  authorize("productor"),
  (req, res, next) => {
    const registro = db.prepare("SELECT * FROM registros_produccion WHERE id = ?").get(req.params.id);
    if (!registro) throw httpError(404, "Registro no encontrado");
    if (registro.actor_id !== req.user.id) {
      throw httpError(403, "Solo quien creo el registro puede agregarle fotos");
    }
    if (registro.estado !== "borrador") {
      throw httpError(409, "El registro ya fue validado; ya no se le pueden agregar fotos");
    }
    const yaTiene = fotosDe(registro.id).length;
    if (yaTiene >= MAX_FOTOS) {
      throw httpError(409, `Ya tiene el maximo de ${MAX_FOTOS} fotos`);
    }
    req.registroProduccion = registro;
    req.fotosDisponibles = MAX_FOTOS - yaTiene;
    next();
  },
  (req, res, next) => {
    uploadFotosProduccion.array("fotos", req.fotosDisponibles)(req, res, next);
  },
  (req, res) => {
    const archivos = req.files ?? [];
    if (archivos.length === 0) {
      throw httpError(400, "Debe adjuntar al menos una imagen en el campo 'fotos'");
    }

    const insertar = db.prepare(
      "INSERT INTO fotos_registro_produccion (registro_produccion_id, url) VALUES (@registro_produccion_id, @url)"
    );
    for (const archivo of archivos) {
      const url = urlPublica("produccion", archivo.filename);
      const info = insertar.run({ registro_produccion_id: req.registroProduccion.id, url });
      registrarAuditoria(req.user.id, "subir_foto_produccion", "fotos_registro_produccion", info.lastInsertRowid);
    }

    res.status(201).json({ fotos: fotosDe(req.registroProduccion.id) });
  }
);

export default router;
