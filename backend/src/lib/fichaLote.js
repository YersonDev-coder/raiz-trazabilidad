import db from "../db.js";
import { certificacionesPublicasDeLote } from "./certificaciones.js";

// Construye el mismo objeto "ficha" para dos consumidores distintos:
//   - GET /trazabilidad/:codigo (publico, routes/trazabilidad.js) -- exige
//     que la certificacion fitosanitaria ya este aprobada antes de llamar
//     a construirFichaLote(), ver loteEsPublico() alla.
//   - GET /api/lotes/:id/ficha (interno, routes/lotes.js) -- autenticado,
//     SIN ese gate (mismo criterio de permisos que ya tenia GET
//     /api/lotes/:id/cadena: cualquier rol autenticado, sin chequeo de
//     dueño), para que el boton "Descargar PDF" del panel interno funcione
//     en cualquier etapa del lote, no solo cuando ya es publico.
// Extraida a este archivo para que NINGUNA de las dos rutas duplique la
// logica de armado de datos -- solo deciden si la exponen o no.

// Mismo orden que el macro estado. La certificacion fitosanitaria y la
// documentacion aduanera no estan aca -- viven en la tabla
// `certificaciones` (ver lib/certificaciones.js), no en una tabla
// `registros_*` por etapa.
const ETAPAS = [
  {
    etapa: "produccion",
    tabla: "registros_produccion",
    campos: ["variedad", "fecha_cosecha", "volumen_kg", "estado_grano", "tipo_cosecha"],
  },
  {
    etapa: "acopio",
    tabla: "registros_acopio",
    // Union de campos comunes + especificos de cafe/cacao (ver migracion
    // 030) -- pick() de mas abajo solo copia los que existan en el
    // registro, asi que un lote de cafe simplemente no trae los de cacao.
    campos: [
      "fecha_recepcion",
      "peso_kg",
      "peso_salida_kg",
      "dias_secado",
      "metodo_secado",
      "fecha_hora_despulpado",
      "metodo_fermentacion",
      "horas_fermentacion",
      "peso_pergamino_humedo_kg",
      "dias_fermentacion",
      "humedad_pct",
    ],
  },
  {
    etapa: "procesamiento",
    tabla: "registros_procesamiento",
    // Union de campos comunes + especificos de cafe/cacao (ver migracion
    // 031). metodo_beneficio/tipo_secado/detalles_json son las columnas
    // originales -- se mantienen solo para no romper lotes ya 'entregado'
    // de antes de ese cambio (quedan NULL en cualquier registro nuevo).
    campos: [
      "peso_entrada_kg",
      "peso_salida_kg",
      "clasificacion_calidad",
      "tueste_temperatura",
      "tueste_tiempo",
      "molido",
      "descascarillado",
      "nibs_peso_kg",
      "molienda_tipo",
      "metodo_beneficio",
      "tipo_secado",
      "detalles_json",
    ],
  },
  { etapa: "exportacion", tabla: "registros_exportacion", campos: ["puerto", "destino", "contenedor"] },
];

function usuarioPublico(id) {
  if (!id) return null;
  return (
    db
      .prepare(
        `SELECT id, nombre, nombre_publico, rol, foto_perfil_url,
                anio_inicio_actividad, generacion_familiar, historia,
                asociacion_cooperativa
         FROM usuarios WHERE id = ?`
      )
      .get(id) ?? null
  );
}

// Solo Produccion tiene fotos de evidencia (fotos_registro_produccion,
// migracion 017) -- Acopio/Procesamiento/Exportacion nunca capturaron
// fotos en ningun momento del proyecto, no es que falte conectarlas.
function fotosDeProduccion(registroProduccionId) {
  return db
    .prepare("SELECT id, url, creado_en FROM fotos_registro_produccion WHERE registro_produccion_id = ? ORDER BY creado_en ASC")
    .all(registroProduccionId);
}

function fotosDeParcela(parcelaId) {
  return db
    .prepare("SELECT id, url, creado_en FROM fotos_parcela WHERE parcela_id = ? ORDER BY creado_en ASC")
    .all(parcelaId);
}

function parseDetalles(valor) {
  if (typeof valor !== "string") return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

function pick(objeto, campos) {
  const resultado = {};
  for (const c of campos) {
    resultado[c] = c === "detalles_json" ? parseDetalles(objeto[c]) : objeto[c];
  }
  return resultado;
}

// `lote` ya debe venir cargado (SELECT * FROM lotes) -- ambos llamadores
// ya lo tenian a mano antes de decidir si podian mostrarlo o no, asi que no
// tiene sentido volver a pedirlo aca.
export function construirFichaLote(lote, codigoConsultado, nivel, unidadId) {
  const lineaTiempo = [];
  let parcela = null;

  for (const { etapa, tabla, campos } of ETAPAS) {
    const registro = db
      .prepare(`SELECT * FROM ${tabla} WHERE lote_id = ? AND estado = 'validado' ORDER BY validado_en LIMIT 1`)
      .get(lote.id);
    if (!registro) continue;

    lineaTiempo.push({
      etapa,
      fecha_validacion: registro.validado_en,
      // actor = quien REGISTRO esta etapa (el Productor que cosecho, la
      // Cooperativa que peso, etc.), no solo quien la valido.
      actor: usuarioPublico(registro.actor_id),
      validado_por: usuarioPublico(registro.validado_por),
      detalle: pick(registro, campos),
      fotos: etapa === "produccion" ? fotosDeProduccion(registro.id) : [],
    });

    if (etapa === "produccion") {
      parcela = db
        .prepare(
          `SELECT nombre_parcela, ubicacion_lat, ubicacion_lng, zona,
                  extension_valor, extension_unidad, altitud_msnm, sistema_cultivo
           FROM parcelas WHERE id = ?`
        )
        .get(registro.parcela_id);
      if (parcela) {
        parcela.fotos = fotosDeParcela(registro.parcela_id);
      }
    }
  }

  let transformacion = null;
  if (lote.ruta === "B") {
    const registro = db
      .prepare("SELECT * FROM registros_transformacion WHERE lote_id = ? AND estado = 'validado' ORDER BY validado_en LIMIT 1")
      .get(lote.id);
    if (registro) {
      transformacion = {
        fecha_validacion: registro.validado_en,
        validado_por: usuarioPublico(registro.validado_por),
        detalle: pick(registro, ["tipo_transformacion", "detalles_json"]),
      };
    }
  }

  // El QR de este lote (nivel 'lote', ver lib/codigosQr.js) se emite desde
  // el registro de cosecha (routes/lotes.js) -- puede no existir todavia
  // solo en lotes de antes de ese cambio.
  const qrLote = db
    .prepare("SELECT generado_en FROM codigos_qr WHERE lote_id = ? AND nivel = 'lote'")
    .get(lote.id);

  // certificacionesPublicasDeLote() solo trae las 'aprobado' -- correcto
  // para ambos consumidores: si el llamador interno pide la ficha de un
  // lote que todavia no tiene ninguna aprobada, simplemente recibe [],
  // igual que hoy pasa en la ficha publica para certificaciones pendientes.
  const certificaciones = certificacionesPublicasDeLote(lote.id).map((c) => ({
    tipo: c.tipo,
    numero_documento: c.numero_documento,
    entidad_emisora: c.entidad_emisora,
    documento_url: c.documento_url,
    estado: "aprobado",
    fecha_validacion: c.validado_en,
  }));

  return {
    codigo_consultado: codigoConsultado,
    nivel,
    unidad_id: unidadId,
    lote: {
      codigo_unico: lote.codigo_unico,
      tipo_producto: lote.tipo_producto,
      ruta: lote.ruta,
      estado_macro: lote.estado_macro,
    },
    parcela,
    linea_tiempo: lineaTiempo,
    transformacion,
    certificaciones,
    qr_generado_en: qrLote?.generado_en ?? null,
  };
}
