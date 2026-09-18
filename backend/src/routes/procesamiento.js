import { crearRouterEtapa } from "../lib/etapaRouter.js";
import { httpError } from "../lib/errors.js";
import { registrarBloque } from "../lib/cadenaBloques.js";

// Procesamiento se separa en dos formularios (Cafe/Cacao) segun el
// producto heredado del lote (lote.tipo_producto) -- mismo criterio que
// Acopio (ver migracion 030/031 y routes/acopio.js): el producto NO se
// elige aca, se deriva del lote seleccionado.
//
// Comunes a ambos productos: peso_entrada_kg (la entrada de esta etapa es
// la salida de Acopio: cafe pergamino seco / cacao en grano seco) y
// peso_salida_kg (cafe verde/oro, o el peso final de cacao segun cuanto se
// haya transformado).
const CAMPOS_COMUNES = ["peso_entrada_kg", "peso_salida_kg"];

// tueste_temperatura/tueste_tiempo son columnas COMPARTIDAS entre cafe y
// cacao (mismo significado: temperatura/tiempo de tueste), pero bajo
// condiciones distintas: en cafe solo aplican en Ruta B (tostado/envasado
// -- Ruta A exporta cafe verde sin tostar), en cacao aplican siempre (el
// tueste es parte del beneficio estandar del cacao sin importar la ruta).
// Se separan de los campos EXCLUSIVOS de cada producto para no rechazarlas
// por error como "propias del otro producto" en la validacion de abajo.
const CAMPOS_TUESTE = ["tueste_temperatura", "tueste_tiempo"];

// Cafe: clasificacion_calidad siempre aplica (informativa, no fragmenta el
// lote) y es exclusiva de cafe. molido tambien es exclusivo de cafe, solo
// en Ruta B.
const CAMPOS_CAFE_SIEMPRE = ["clasificacion_calidad"];
const CAMPOS_CAFE_RUTA_B = [...CAMPOS_TUESTE, "molido"];

// Cacao: descascarillado (winnowing) es exclusivo de cacao, siempre.
// nibs_peso_kg y molienda_tipo (licor/manteca/polvo) son exclusivos de
// cacao y solo aplican si ademas se sigue transformando hasta valor
// agregado (Ruta B).
const CAMPOS_CACAO_SIEMPRE = [...CAMPOS_TUESTE, "descascarillado"];
const CAMPOS_CACAO_RUTA_B = ["nibs_peso_kg", "molienda_tipo"];

// Exclusivos de cada producto (sin el tueste compartido) -- son los unicos
// que tiene sentido rechazar como "propios del otro producto".
const CAMPOS_CAFE_EXCLUSIVOS = [...CAMPOS_CAFE_SIEMPRE, "molido"];
const CAMPOS_CACAO_EXCLUSIVOS = ["descascarillado", ...CAMPOS_CACAO_RUTA_B];

const CLASIFICACIONES_CALIDAD = ["excelso", "consumo", "pasilla", "mezcla_variable"];
const TIPOS_MOLIENDA = ["licor", "manteca", "polvo"];

function tieneValor(v) {
  return v !== undefined && v !== null && v !== "";
}

function aBooleano01(v) {
  if (v === true || v === 1 || v === "1" || v === "true") return 1;
  if (v === false || v === 0 || v === "0" || v === "false") return 0;
  return v;
}

const router = crearRouterEtapa({
  tabla: "registros_procesamiento",
  campos: [
    ...CAMPOS_COMUNES,
    ...CAMPOS_CAFE_SIEMPRE,
    ...CAMPOS_CAFE_RUTA_B,
    ...CAMPOS_CACAO_SIEMPRE,
    ...CAMPOS_CACAO_RUTA_B,
    // Columnas originales: se conservan en la whitelist solo por
    // compatibilidad con clientes viejos, pero el formulario nuevo
    // (ProcesamientoNuevoPage.jsx) ya no las envia.
    "metodo_beneficio",
    "tipo_secado",
    "detalles_json",
  ],
  rolActor: "planta_procesamiento",
  // SENASA ya no puede loguearse (ver routes/auth.js) -- este paso lo
  // confirma el Administrador (ver decision documentada en sesiones
  // anteriores: la certificacion fitosanitaria real se resuelve por
  // separado en routes/certificaciones.js).
  rolValidador: "admin",
  etapaMacro: "procesamiento",
  siguienteEtapaMacro: "exportacion",
  antesDeCrear(req, lote, datos) {
    if (!lote.ruta) {
      throw httpError(
        409,
        "Este lote no tiene ruta de exportacion (A/B) definida. Se fija en el registro de Acopio (Cooperativa)."
      );
    }

    if (datos.detalles_json !== undefined && typeof datos.detalles_json !== "string") {
      datos.detalles_json = JSON.stringify(datos.detalles_json);
    }

    for (const c of CAMPOS_COMUNES) {
      if (!tieneValor(datos[c])) throw httpError(400, `El campo '${c}' es requerido`);
    }

    const esCafe = lote.tipo_producto === "cafe";
    const camposSiempre = esCafe ? CAMPOS_CAFE_SIEMPRE : CAMPOS_CACAO_SIEMPRE;
    const camposRutaB = esCafe ? CAMPOS_CAFE_RUTA_B : CAMPOS_CACAO_RUTA_B;
    const camposDeOtroProducto = esCafe ? CAMPOS_CACAO_EXCLUSIVOS : CAMPOS_CAFE_EXCLUSIVOS;

    for (const c of camposDeOtroProducto) {
      if (tieneValor(datos[c])) {
        throw httpError(
          409,
          `El campo '${c}' no corresponde a un lote de ${lote.tipo_producto} (es propio de ${esCafe ? "cacao" : "cafe"})`
        );
      }
    }

    for (const c of camposSiempre) {
      if (!tieneValor(datos[c])) {
        throw httpError(400, `El campo '${c}' es requerido para un lote de ${lote.tipo_producto}`);
      }
    }

    if (lote.ruta === "A") {
      // Ruta A (materia prima): nada de tueste/molido/nibs/molienda, ese
      // procesamiento adicional es exactamente lo que define la Ruta B.
      for (const c of camposRutaB) {
        if (tieneValor(datos[c])) {
          throw httpError(409, `El campo '${c}' solo aplica a lotes de Ruta B (valor agregado)`);
        }
      }
    }

    if (datos.clasificacion_calidad !== undefined && !CLASIFICACIONES_CALIDAD.includes(datos.clasificacion_calidad)) {
      throw httpError(400, `clasificacion_calidad debe ser una de: ${CLASIFICACIONES_CALIDAD.join(", ")}`);
    }
    if (datos.molienda_tipo !== undefined && !TIPOS_MOLIENDA.includes(datos.molienda_tipo)) {
      throw httpError(400, `molienda_tipo debe ser uno de: ${TIPOS_MOLIENDA.join(", ")}`);
    }
    if (datos.molido !== undefined) datos.molido = aBooleano01(datos.molido);
    if (datos.descascarillado !== undefined) datos.descascarillado = aBooleano01(datos.descascarillado);
  },
  // Bloque de cadena hash al registrar (Planta) -- ya se sabe la ruta y
  // todos los datos del beneficio en este punto (igual que antes).
  despuesDeCrear(req, lote, registro) {
    registrarBloque(lote.id, "procesamiento", {
      actor_id: registro.actor_id,
      ruta: lote.ruta,
      peso_entrada_kg: registro.peso_entrada_kg,
      peso_salida_kg: registro.peso_salida_kg,
      clasificacion_calidad: registro.clasificacion_calidad,
      tueste_temperatura: registro.tueste_temperatura,
      tueste_tiempo: registro.tueste_tiempo,
      molido: registro.molido,
      descascarillado: registro.descascarillado,
      nibs_peso_kg: registro.nibs_peso_kg,
      molienda_tipo: registro.molienda_tipo,
    });
  },
  // Sin despuesDeValidar: la certificacion fitosanitaria real se aprueba
  // por separado en routes/certificaciones.js (ver comentario ahi).
});

export default router;
