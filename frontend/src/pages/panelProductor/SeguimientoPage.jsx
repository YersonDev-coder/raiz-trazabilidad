import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelProductorLayout } from "../../components/panelProductor/PanelProductorLayout.jsx";
import { DescargaQrLote } from "../../components/panelInterno/DescargaQrLote.jsx";
import { ETIQUETAS_ROL } from "../../constants/catalogos.js";
import "../../styles/publico.css";

const ORDEN_ETAPAS = [
  "produccion",
  "acopio",
  "procesamiento",
  "certificacion_sanitaria",
  "exportacion",
  "entregado",
];

const ETIQUETAS_ETAPA = {
  produccion: "Producción",
  acopio: "Acopio",
  procesamiento: "Procesamiento",
  certificacion_sanitaria: "Certificación",
  exportacion: "Exportación",
  entregado: "Entregado",
};

const ICONOS_ETAPA = {
  produccion: "🌱",
  acopio: "⚖️",
  procesamiento: "🔥",
  certificacion_sanitaria: "✅",
  exportacion: "🚢",
  entregado: "📦",
};

// Convierte la linea_tiempo "cruda" (una entrada por etapa CON registro,
// solo para las 4 etapas que tienen tabla propia) en el detalle de las 6
// etapas del macro-estado, solo lectura -- el productor ve el progreso
// completo pero no puede tocar nada que no le corresponda.
function calcularDetalle(lote) {
  const indiceActual = ORDEN_ETAPAS.indexOf(lote.estado_macro);
  const porEtapa = Object.fromEntries(lote.linea_tiempo.map((d) => [d.etapa, d]));
  const procesamiento = porEtapa.procesamiento;

  return ORDEN_ETAPAS.map((etapa, i) => {
    const alcanzadaPorIndice = i < indiceActual ? "completo" : i === indiceActual ? "actual" : "pendiente";

    // certificacion_sanitaria no tiene tabla propia: la aprobacion de
    // SENASA esta embebida en la validacion de registros_procesamiento
    // (ver docs/CONTEXTO.md, "Decision de alcance").
    if (etapa === "certificacion_sanitaria") {
      if (procesamiento?.estado === "validado") {
        return {
          etapa,
          alcanzada: "completo",
          nota: "Aprobada por SENASA junto con la validación de Procesamiento",
          fecha: procesamiento.fecha_validacion,
          validadoPor: procesamiento.validado_por,
        };
      }
      return { etapa, alcanzada: alcanzadaPorIndice, nota: null, fecha: null, validadoPor: null };
    }

    if (etapa === "entregado") {
      return { etapa, alcanzada: alcanzadaPorIndice, nota: null, fecha: null, validadoPor: null };
    }

    const registro = porEtapa[etapa];
    if (!registro) {
      return { etapa, alcanzada: alcanzadaPorIndice, nota: null, fecha: null, validadoPor: null };
    }

    // fue_rechazado: el registro sigue en 'borrador' (nunca llego a
    // validado), asi que el indice de la etapa no cambia -- solo se
    // distingue el motivo por el que sigue ahi. El motivo en si (texto)
    // solo viene poblado cuando la etapa es 'produccion' (el propio
    // Productor es el actor que debe verlo); en las demas etapas el
    // backend ya lo omite por privacidad, asi que aqui solo se puede armar
    // una nota generica.
    if (registro.fue_rechazado) {
      return {
        etapa,
        alcanzada: "rechazado",
        nota:
          etapa === "produccion"
            ? `Rechazado: ${registro.motivo_rechazo}`
            : "Esta etapa fue rechazada por el validador y está pendiente de corrección",
        fecha: registro.fecha_registro,
        validadoPor: null,
      };
    }

    return {
      etapa,
      alcanzada: registro.estado === "validado" ? "completo" : "actual",
      nota: registro.estado === "validado" ? null : "En curso (registrado en borrador)",
      fecha: registro.estado === "validado" ? registro.fecha_validacion : registro.fecha_registro,
      validadoPor: registro.validado_por,
    };
  });
}

function CodigoQr({ codigo, generadoEn }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const url = `${window.location.origin}/trazabilidad/${codigo}`;
    QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: "#3b2415", light: "#ffffff" } })
      .then((d) => {
        if (!cancelado) setDataUrl(d);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  return (
    <div className="tarjeta-qr">
      {dataUrl ? <img src={dataUrl} alt={`Código QR de ${codigo}`} /> : <p className="texto-tenue-panel">Generando...</p>}
      <p className="texto-tenue-panel">{codigo}</p>
      {generadoEn && <p className="texto-tenue-panel">Emitido el {generadoEn}</p>}
    </div>
  );
}

export function SeguimientoPage() {
  const { token } = useAuth();
  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .obtenerLotesMiosEstado(token, controller.signal)
      .then(({ lotes: propios }) => setLotes(propios))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [token]);

  return (
    <PanelProductorLayout>
      <h1 className="panel-titulo">Seguimiento de mi cosecha</h1>
      <p className="subtitulo-panel">
        Así avanza cada uno de tus lotes por la cadena de trazabilidad, en tiempo real. Esta vista es
        de solo lectura: cada etapa la edita quien corresponde.
      </p>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && lotes.length === 0 && (
        <div className="estado-vacio-panel">
          <p>Todavía no tienes lotes en seguimiento. Registra una cosecha para empezar.</p>
        </div>
      )}

      <div className="lista-seguimiento">
        {lotes.map((lote) => {
          const indiceActual = ORDEN_ETAPAS.indexOf(lote.estado_macro);
          const detalle = calcularDetalle(lote);

          return (
            <div key={lote.id} className="tarjeta-panel">
              <div className="tarjeta-seguimiento__encabezado">
                <strong>{lote.codigo_unico}</strong>
                <span className="texto-tenue-panel">
                  {lote.variedad ? `${lote.variedad} · ` : ""}
                  {lote.tipo_producto === "cafe" ? "Café" : "Cacao"}
                </span>
              </div>

              <DescargaQrLote loteId={lote.id} tieneQr={lote.tiene_qr} />

              <div className="stepper">
                {ORDEN_ETAPAS.map((etapa, i) => (
                  <div
                    key={etapa}
                    className={`stepper__paso ${
                      i < indiceActual ? "completo" : i === indiceActual ? "actual" : ""
                    }`}
                  >
                    <span className="stepper__punto" />
                    <span className="stepper__etiqueta">{ETIQUETAS_ETAPA[etapa]}</span>
                  </div>
                ))}
              </div>

              <div className="panel-publico">
                <h3 className="panel-publico__titulo">Detalle por etapa</h3>
                <ol className="linea-tiempo">
                  {detalle.map((d) => (
                    <li
                      key={d.etapa}
                      className={`linea-tiempo__item linea-tiempo__item--${d.alcanzada}`}
                    >
                      <span className="linea-tiempo__punto">{ICONOS_ETAPA[d.etapa]}</span>
                      <div className="linea-tiempo__etapa">{ETIQUETAS_ETAPA[d.etapa]}</div>
                      <div className="linea-tiempo__fecha">
                        {d.alcanzada === "completo" && d.fecha && `Validado el ${d.fecha}`}
                        {d.alcanzada === "completo" && !d.fecha && "Completada"}
                        {d.alcanzada === "actual" && (d.nota ?? "En curso ahora mismo")}
                        {d.alcanzada === "rechazado" && "Rechazado — en corrección"}
                        {d.alcanzada === "pendiente" && "Aún no iniciada"}
                      </div>
                      {(d.alcanzada === "completo" || d.alcanzada === "rechazado") && d.nota && (
                        <div className="linea-tiempo__validador">{d.nota}</div>
                      )}
                      {d.validadoPor && (
                        <div className="linea-tiempo__validador">
                          Por {d.validadoPor.nombre} ({ETIQUETAS_ROL[d.validadoPor.rol] ?? d.validadoPor.rol})
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="panel-publico">
                <h3 className="panel-publico__titulo">Fotos de evidencia</h3>
                {lote.fotos.length === 0 ? (
                  <p className="texto-tenue-panel">Todavía no hay fotos para esta cosecha.</p>
                ) : (
                  <div className="galeria-fotos__grid">
                    {lote.fotos.map((f) => (
                      <img key={f.id} src={`${API_BASE_URL}${f.url}`} alt="Evidencia de la cosecha" />
                    ))}
                  </div>
                )}
              </div>

              {lote.tiene_qr && lote.codigos_qr.length > 0 && (
                <div className="panel-publico">
                  <h3 className="panel-publico__titulo">Código{lote.codigos_qr.length > 1 ? "s" : ""} QR</h3>
                  <p className="texto-tenue-panel">
                    Este es el código QR que ve el comprador final al escanear la ficha pública de
                    este lote.
                  </p>
                  <div className="grid-catalogo">
                    {lote.codigos_qr.map((q) => (
                      <CodigoQr key={q.codigo} codigo={q.codigo} generadoEn={q.generado_en} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PanelProductorLayout>
  );
}
