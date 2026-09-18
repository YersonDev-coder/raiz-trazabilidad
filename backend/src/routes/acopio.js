import db from "../db.js";
import { crearRouterEtapa } from "../lib/etapaRouter.js";
import { httpError } from "../lib/errors.js";
import { registrarBloque } from "../lib/cadenaBloques.js";

// Acopio se separa en dos formularios (Cafe/Cacao) segun el producto
// heredado del lote (lote.tipo_producto, fijado por el Productor al crear
// el lote, ver routes/lotes.js) -- mismo criterio que ya usaba Produccion
// para derivar variedad/estado_grano del cultivo de la parcela: el producto
// NO se elige aca, se deriva del lote seleccionado.
//
// Comunes a ambos productos (ver migracion 030 para el porque de reusar
// peso_kg/humedad_pct/fecha_recepcion en vez de duplicarlos por producto):
//   fecha_recepcion, peso_kg ("peso recibido": cafe cereza / cacao en
//   baba), peso_salida_kg ("peso final entregado": cafe pergamino seco /
//   cacao en grano seco), dias_secado, metodo_secado.
const CAMPOS_COMUNES = ["fecha_recepcion", "peso_kg", "peso_salida_kg", "dias_secado", "metodo_secado"];
const CAMPOS_CAFE = [
  "fecha_hora_despulpado",
  "metodo_fermentacion",
  "horas_fermentacion",
  "peso_pergamino_humedo_kg",
];
// humedad_pct ya existia como columna generica; ahora es exclusiva de cacao
// ("% humedad final tras secado") -- cafe no la envia en este formulario.
const CAMPOS_CACAO = ["dias_fermentacion", "humedad_pct"];

const CAMPOS_POR_PRODUCTO = { cafe: CAMPOS_CAFE, cacao: CAMPOS_CACAO };
const METODOS_FERMENTACION = ["lavado", "seco"];
const METODOS_SECADO = ["natural_sol", "mecanico"];

function tieneValor(v) {
  return v !== undefined && v !== null && v !== "";
}

const router = crearRouterEtapa({
  tabla: "registros_acopio",
  campos: [...CAMPOS_COMUNES, ...CAMPOS_CAFE, ...CAMPOS_CACAO],
  rolActor: "cooperativa",
  rolValidador: "planta_procesamiento",
  etapaMacro: "acopio",
  // Rumbo por defecto para Ruta B (valor agregado): sigue el camino de
  // siempre, pasa a Planta de Procesamiento. Ruta A (materia prima) se
  // desvia directo a 'exportacion' en despuesDeValidar mas abajo, sin
  // pasar por aca -- ver ese hook para el porque.
  siguienteEtapaMacro: "procesamiento",
  antesDeCrear(req, lote, datos) {
    // La ruta (A o B) se decide aqui, una sola vez -- se movio desde
    // Procesamiento (routes/procesamiento.js ya no la acepta, solo la lee).
    // Mismo criterio de inmutabilidad que tenia alla: si el lote ya la
    // tiene fijada, no se puede cambiar.
    if (lote.ruta) {
      if (datos.ruta && datos.ruta !== lote.ruta) {
        throw httpError(
          409,
          `La ruta del lote ya fue definida como '${lote.ruta}' y no se puede cambiar`
        );
      }
    } else {
      if (!["A", "B"].includes(datos.ruta)) {
        throw httpError(400, "Debe especificar 'ruta' ('A' o 'B') al registrar el acopio");
      }
      db.prepare("UPDATE lotes SET ruta = @ruta WHERE id = @id").run({ ruta: datos.ruta, id: lote.id });
    }

    // Los campos especificos de producto no se eligen: se derivan de
    // lote.tipo_producto (igual que Produccion deriva de parcela.tipo_cultivo).
    // Igual se valida en el servidor -- no basta con que el frontend oculte
    // los campos que no aplican, alguien podria llamar al endpoint directo.
    const camposProducto = CAMPOS_POR_PRODUCTO[lote.tipo_producto] ?? [];
    const camposDeOtroProducto = lote.tipo_producto === "cafe" ? CAMPOS_CACAO : CAMPOS_CAFE;

    for (const campo of camposDeOtroProducto) {
      if (tieneValor(datos[campo])) {
        throw httpError(
          409,
          `El campo '${campo}' no corresponde a un lote de ${lote.tipo_producto} (es propio de ${
            lote.tipo_producto === "cafe" ? "cacao" : "cafe"
          })`
        );
      }
    }

    for (const campo of camposProducto) {
      if (!tieneValor(datos[campo])) {
        throw httpError(400, `El campo '${campo}' es requerido para un lote de ${lote.tipo_producto}`);
      }
    }
    for (const campo of CAMPOS_COMUNES) {
      if (!tieneValor(datos[campo])) {
        throw httpError(400, `El campo '${campo}' es requerido`);
      }
    }

    if (datos.metodo_fermentacion !== undefined && !METODOS_FERMENTACION.includes(datos.metodo_fermentacion)) {
      throw httpError(400, `metodo_fermentacion debe ser uno de: ${METODOS_FERMENTACION.join(", ")}`);
    }
    if (datos.metodo_secado !== undefined && !METODOS_SECADO.includes(datos.metodo_secado)) {
      throw httpError(400, `metodo_secado debe ser uno de: ${METODOS_SECADO.join(", ")}`);
    }
  },
  // Bloque de cadena hash al VALIDAR (Planta), no al registrar
  // (Cooperativa) -- los datos que importan para la cadena son los que ya
  // quedaron confirmados, no los que todavia pueden editarse en borrador.
  despuesDeValidar(req, lote, registro) {
    registrarBloque(lote.id, "acopio", {
      actor_id: registro.actor_id,
      validado_por: registro.validado_por,
      fecha_recepcion: registro.fecha_recepcion,
      peso_kg: registro.peso_kg,
      peso_salida_kg: registro.peso_salida_kg,
      dias_secado: registro.dias_secado,
      metodo_secado: registro.metodo_secado,
      fecha_hora_despulpado: registro.fecha_hora_despulpado,
      metodo_fermentacion: registro.metodo_fermentacion,
      horas_fermentacion: registro.horas_fermentacion,
      peso_pergamino_humedo_kg: registro.peso_pergamino_humedo_kg,
      dias_fermentacion: registro.dias_fermentacion,
      humedad_pct: registro.humedad_pct,
    });

    // Ruta A (materia prima): salta Planta de Procesamiento por completo,
    // el lote queda disponible directo para el Exportador. `lote` aca ya
    // fue actualizado por crearRouterEtapa a `siguienteEtapaMacro`
    // ('procesamiento') antes de este hook -- se corrige a 'exportacion'
    // dentro de la misma transaccion, y se refleja en el objeto `lote`
    // (mutado por referencia) para que la respuesta HTTP tambien lo
    // muestre correcto sin tener que tocar etapaRouter.js.
    if (lote.ruta === "A") {
      db.prepare("UPDATE lotes SET estado_macro = 'exportacion' WHERE id = ?").run(lote.id);
      lote.estado_macro = "exportacion";
    }
  },
});

export default router;
