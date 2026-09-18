import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";
import { DescargaQrLote } from "../../components/panelInterno/DescargaQrLote.jsx";
import { CONFIG_ETAPA } from "../../constants/etapas.js";

function formatearValor(valor, sufijo, traducir) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return `${traducir ? traducir(valor) : valor}${sufijo ?? ""}`;
}

// Ver mismo helper en EtapaListaPage.jsx: camposMostrar puede ser un array
// plano o una funcion de (tipoProducto, ruta) -- Acopio/Procesamiento, ver
// constants/etapas.js.
function resolverPorProducto(valor, tipoProducto, ruta) {
  return typeof valor === "function" ? valor(tipoProducto, ruta) : valor;
}

// Generico: "validar pendientes" es el mismo patron para las 4 etapas
// (Cooperativa valida Produccion, Planta valida Acopio, SENASA valida
// Procesamiento, SUNAT valida Exportacion) -- mismo backend generico
// (etapaRouter.js GET /pendientes + POST /:id/validar), asi que una sola
// pagina parametrizada evita repetir el mismo componente 3 veces mas.
export function EtapaValidarPage({ etapa, titulo, subtitulo }) {
  const { token } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [validandoId, setValidandoId] = useState(null);
  // Id del registro cuyo formulario de rechazo esta abierto (solo uno a la
  // vez) + su motivo en progreso, separado de `error` para no mezclar un
  // error de red con la validacion "escribe un motivo".
  const [rechazandoAbiertoId, setRechazandoAbiertoId] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [enviandoRechazoId, setEnviandoRechazoId] = useState(null);
  const [errorRechazo, setErrorRechazo] = useState(null);

  function cargar() {
    setCargando(true);
    api
      .listarPendientesEtapa(etapa, token)
      .then(({ registros: pendientes }) => setRegistros(pendientes))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [token, etapa]);

  async function handleValidar(id) {
    setError(null);
    setValidandoId(id);
    try {
      await api.validarRegistroEtapa(etapa, token, id);
      setRegistros((actuales) => actuales.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setValidandoId(null);
    }
  }

  function abrirRechazo(id) {
    setRechazandoAbiertoId(id);
    setMotivoRechazo("");
    setErrorRechazo(null);
  }

  function cancelarRechazo() {
    setRechazandoAbiertoId(null);
    setMotivoRechazo("");
    setErrorRechazo(null);
  }

  async function handleConfirmarRechazo(id) {
    if (!motivoRechazo.trim()) {
      setErrorRechazo("Escribe el motivo del rechazo.");
      return;
    }
    setErrorRechazo(null);
    setEnviandoRechazoId(id);
    try {
      await api.rechazarRegistroEtapa(etapa, token, id, motivoRechazo.trim());
      setRegistros((actuales) => actuales.filter((r) => r.id !== id));
      setRechazandoAbiertoId(null);
      setMotivoRechazo("");
    } catch (err) {
      setErrorRechazo(err.message);
    } finally {
      setEnviandoRechazoId(null);
    }
  }

  return (
    <PanelLayout>
      <h1 className="panel-titulo">{titulo}</h1>
      <p className="subtitulo-panel">{subtitulo}</p>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && registros.length === 0 && (
        <div className="estado-vacio-panel">
          <p>No hay registros pendientes por ahora.</p>
        </div>
      )}

      <div className="lista-registros-panel">
        {registros.map((r) => {
          const camposMostrar = resolverPorProducto(CONFIG_ETAPA[etapa].camposMostrar, r.lote_tipo_producto, r.lote_ruta);
          return (
          <div key={r.id} className="tarjeta-panel tarjeta-registro-panel">
            <div className="tarjeta-registro-panel__encabezado">
              <strong>{r.lote_codigo_unico}</strong>
              <span className="estado-panel estado-panel--borrador">Borrador</span>
            </div>
            <DescargaQrLote loteId={r.lote_id} tieneQr={r.lote_tiene_qr} />
            <p>Registrado por: {r.actor_nombre}</p>
            {camposMostrar.map(({ key, label, sufijo, traducir }) => (
              <p key={key}>
                {label}: {formatearValor(r[key], sufijo, traducir)}
              </p>
            ))}
            <div className="formulario-rechazo__acciones">
              <button
                type="button"
                className="boton-panel"
                onClick={() => handleValidar(r.id)}
                disabled={validandoId === r.id || rechazandoAbiertoId === r.id}
              >
                {validandoId === r.id ? "Validando..." : "Validar"}
              </button>
              <button
                type="button"
                className="boton-panel boton-panel--peligro"
                onClick={() => abrirRechazo(r.id)}
                disabled={validandoId === r.id || rechazandoAbiertoId === r.id}
              >
                Rechazar
              </button>
            </div>

            {rechazandoAbiertoId === r.id && (
              <div className="formulario-panel formulario-rechazo">
                <label>
                  Motivo del rechazo (obligatorio, lo vera quien registro esto)
                  <textarea
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    placeholder="Ej: el peso no coincide con la guia de remision adjunta"
                    autoFocus
                  />
                </label>
                {errorRechazo && <p className="mensaje-error">{errorRechazo}</p>}
                <div className="formulario-rechazo__acciones">
                  <button
                    type="button"
                    className="boton-panel boton-panel--peligro"
                    onClick={() => handleConfirmarRechazo(r.id)}
                    disabled={enviandoRechazoId === r.id}
                  >
                    {enviandoRechazoId === r.id ? "Rechazando..." : "Confirmar rechazo"}
                  </button>
                  <button
                    type="button"
                    className="boton-panel boton-panel--secundario"
                    onClick={cancelarRechazo}
                    disabled={enviandoRechazoId === r.id}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </PanelLayout>
  );
}
