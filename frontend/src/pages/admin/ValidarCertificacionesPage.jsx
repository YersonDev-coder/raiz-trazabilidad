import { useEffect, useState } from "react";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";
import { DescargaQrLote } from "../../components/panelInterno/DescargaQrLote.jsx";

const ETIQUETA_TIPO = {
  fitosanitaria: "Certificación fitosanitaria",
  aduanera: "Documentación aduanera",
};

const ETIQUETA_ESTADO = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const CLASE_ESTADO = { pendiente: "borrador", aprobado: "validado", rechazado: "rechazado" };

function urlArchivo(rutaRelativa) {
  if (!rutaRelativa) return null;
  return rutaRelativa.startsWith("http") ? rutaRelativa : `${API_BASE_URL}${rutaRelativa}`;
}

// Una certificacion individual (fitosanitaria o aduanera) de un lote, con
// sus botones de Aprobar/Rechazar independientes -- reemplaza lo que antes
// hacian SENASA y SUNAT por separado (ver routes/certificaciones.js).
function TarjetaCertificacion({ loteId, cert, tipo, onCambio }) {
  const { token } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);

  async function handleAprobar() {
    setError(null);
    setEnviando(true);
    try {
      await api.aprobarCertificacion(token, loteId, tipo);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleConfirmarRechazo() {
    if (!motivo.trim()) {
      setError("Escribe el motivo del rechazo.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await api.rechazarCertificacion(token, loteId, tipo, motivo.trim());
      setRechazando(false);
      setMotivo("");
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!cert) {
    return (
      <div className="tarjeta-certificacion-panel">
        <strong>{ETIQUETA_TIPO[tipo]}</strong>
        <p className="texto-tenue-panel">El Exportador todavía no la subió.</p>
      </div>
    );
  }

  return (
    <div className="tarjeta-certificacion-panel">
      <div className="tarjeta-registro-panel__encabezado">
        <strong>{ETIQUETA_TIPO[tipo]}</strong>
        <span className={`estado-panel estado-panel--${CLASE_ESTADO[cert.estado]}`}>
          {ETIQUETA_ESTADO[cert.estado] ?? cert.estado}
        </span>
      </div>
      <p>Número: {cert.numero_documento}</p>
      {cert.entidad_emisora && <p>Entidad emisora: {cert.entidad_emisora}</p>}
      <p>
        Archivo:{" "}
        {cert.documento_url ? (
          <a href={urlArchivo(cert.documento_url)} target="_blank" rel="noreferrer">
            Ver archivo ↗
          </a>
        ) : (
          "sin archivo adjunto"
        )}
      </p>
      {cert.estado === "rechazado" && cert.motivo_rechazo && (
        <div className="aviso-rechazo">
          <strong>Rechazado el {cert.rechazado_en}.</strong> Motivo: {cert.motivo_rechazo}
        </div>
      )}

      {cert.estado === "pendiente" && (
        <>
          <div className="formulario-rechazo__acciones">
            <button type="button" className="boton-panel" onClick={handleAprobar} disabled={enviando || rechazando}>
              {enviando && !rechazando ? "Aprobando..." : "Aprobar"}
            </button>
            <button
              type="button"
              className="boton-panel boton-panel--peligro"
              onClick={() => setRechazando(true)}
              disabled={enviando || rechazando}
            >
              Rechazar
            </button>
          </div>

          {rechazando && (
            <div className="formulario-panel formulario-rechazo">
              <label>
                Motivo del rechazo (obligatorio, lo verá el Exportador)
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: el número de certificado no coincide con el documento adjunto"
                  autoFocus
                />
              </label>
              <div className="formulario-rechazo__acciones">
                <button
                  type="button"
                  className="boton-panel boton-panel--peligro"
                  onClick={handleConfirmarRechazo}
                  disabled={enviando}
                >
                  {enviando ? "Rechazando..." : "Confirmar rechazo"}
                </button>
                <button
                  type="button"
                  className="boton-panel boton-panel--secundario"
                  onClick={() => {
                    setRechazando(false);
                    setMotivo("");
                    setError(null);
                  }}
                  disabled={enviando}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export function ValidarCertificacionesPage() {
  const { token } = useAuth();
  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  function cargar() {
    setCargando(true);
    api
      .listarCertificacionesPendientes(token)
      .then(({ lotes: pendientes }) => setLotes(pendientes))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [token]);

  return (
    <PanelLayout>
      <h1 className="panel-titulo">Validar certificaciones</h1>
      <p className="subtitulo-panel">
        Certificación fitosanitaria y documentación aduanera subidas por el Exportador, pendientes de tu
        revisión. Un lote pasa a "entregado" recién cuando ambas quedan aprobadas.
      </p>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && lotes.length === 0 && (
        <div className="estado-vacio-panel">
          <p>No hay lotes esperando revisión de certificaciones por ahora.</p>
        </div>
      )}

      <div className="lista-registros-panel">
        {lotes.map((l) => {
          const fito = l.certificaciones.find((c) => c.tipo === "fitosanitaria");
          const aduana = l.certificaciones.find((c) => c.tipo === "aduanera");
          return (
            <div key={l.lote_id} className="tarjeta-panel tarjeta-registro-panel">
              <div className="tarjeta-registro-panel__encabezado">
                <strong>{l.codigo_unico}</strong>
                <span className="texto-tenue-panel">{l.tipo_producto}</span>
              </div>
              <DescargaQrLote loteId={l.lote_id} tieneQr={l.lote_tiene_qr} />
              <p>Exportador: {l.exportador_nombre}</p>
              <p>
                Puerto: {l.puerto} — Destino: {l.destino} — Contenedor: {l.contenedor}
              </p>

              <TarjetaCertificacion loteId={l.lote_id} cert={fito} tipo="fitosanitaria" onCambio={cargar} />
              <TarjetaCertificacion loteId={l.lote_id} cert={aduana} tipo="aduanera" onCambio={cargar} />
            </div>
          );
        })}
      </div>
    </PanelLayout>
  );
}
