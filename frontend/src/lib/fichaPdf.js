import QRCode from "qrcode";
import jsPDF from "jspdf";

// Extraido de TrazabilidadPublicaPage.jsx para que el boton "Descargar PDF"
// de los paneles internos (ver components/panelInterno/DescargaQrLote.jsx)
// reutilice EXACTAMENTE la misma generacion en vez de duplicarla -- ambos
// llamadores (la ficha publica y cada panel interno) le pasan el mismo
// shape de `datos` (el que devuelven GET /trazabilidad/:codigo y
// GET /api/lotes/:id/ficha, ver backend/src/lib/fichaLote.js), asi que el
// PDF resultante es identico sin importar de donde se descargue.
const ETIQUETAS_ETAPA = {
  produccion: "Producción",
  acopio: "Acopio",
  procesamiento: "Procesamiento",
  exportacion: "Exportación",
};

const ETIQUETA_RUTA = { A: "Materia prima", B: "Valor agregado" };

// Si el lote todavia no tiene QR emitido (caso raro, solo lotes de antes
// de que el QR se emitiera al crear el lote), no hay nada que codificar ni
// descargar -- el llamador debe verificar esto antes (mismo patron de
// "omitir limpiamente" que ya usa la ficha publica), pero se revalida aca
// tambien por si acaso.
export async function descargarFichaPdf(datos) {
  if (!datos || !datos.qr_generado_en) return;

  const url = `${window.location.origin}/trazabilidad/${datos.codigo_consultado}`;
  const qrDataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 320,
    color: { dark: "#3b2415", light: "#ffffff" },
  });

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(20);
  doc.text("Raíz — Ficha de trazabilidad", 40, 50);
  doc.setFontSize(12);
  doc.text(`Código: ${datos.lote.codigo_unico}`, 40, 78);
  doc.text(
    `Producto: ${datos.lote.tipo_producto} · Ruta: ${
      datos.lote.ruta ? ETIQUETA_RUTA[datos.lote.ruta] : "sin definir"
    }`,
    40,
    94
  );

  doc.addImage(qrDataUrl, "PNG", 40, 114, 150, 150);
  doc.setFontSize(9);
  doc.text("Escanea este código o visita el enlace:", 210, 140);
  doc.text(url, 210, 154);

  let y = 300;
  doc.setFontSize(14);
  doc.text("Línea de tiempo", 40, y);
  y += 20;
  doc.setFontSize(10);
  for (const paso of datos.linea_tiempo) {
    const nombreActor = paso.actor ? paso.actor.nombre_publico || paso.actor.nombre : null;
    doc.text(
      `${ETIQUETAS_ETAPA[paso.etapa] ?? paso.etapa}` +
        (nombreActor ? ` — por ${nombreActor}` : "") +
        ` — validado el ${paso.fecha_validacion}` +
        (paso.validado_por ? ` por ${paso.validado_por.nombre}` : ""),
      40,
      y
    );
    y += 16;
  }

  doc.save(`trazabilidad-${datos.lote.codigo_unico}.pdf`);
}
