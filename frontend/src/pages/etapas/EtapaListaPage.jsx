import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";
import { FormularioCorreccion } from "../../components/panelInterno/FormularioCorreccion.jsx";
import { DescargaQrLote } from "../../components/panelInterno/DescargaQrLote.jsx";
import { CONFIG_ETAPA } from "../../constants/etapas.js";

function formatearValor(valor, sufijo, traducir) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return `${traducir ? traducir(valor) : valor}${sufijo ?? ""}`;
}

// camposMostrar/camposCorreccion de CONFIG_ETAPA pueden ser un array plano
// (la mayoria de etapas) o una funcion de (tipoProducto, ruta) -- Acopio y
// Procesamiento, ver constants/etapas.js -- porque sus campos difieren
// entre cafe y cacao (y, en Procesamiento, tambien segun Ruta A/B). Se
// resuelve aca en vez de en cada callsite.
function resolverPorProducto(valor, tipoProducto, ruta) {
  return typeof valor === "function" ? valor(tipoProducto, ruta) : valor;
}

const ETIQUETA_TIPO_CERTIFICACION = {
  fitosanitaria: "Certificado fitosanitario",
  aduanera: "Documentación aduanera",
};
const ETIQUETA_ESTADO_CERT = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const CLASE_ESTADO_CERT = { pendiente: "borrador", aprobado: "validado", rechazado: "rechazado" };

// Una certificacion (fitosanitaria o aduanera) tal como la ve el Exportador
// que la subio: si el Administrador la rechazo (ver routes/certificaciones.js),
// muestra el motivo y un formulario para corregir el numero/archivo y
// reenviarla -- vuelve a 'pendiente' sin crear una fila nueva (PUT
// /:id/certificaciones/:tipo en routes/exportacion.js). Si ya esta aprobada
// o sigue pendiente, no hay nada que el Exportador pueda hacer aca, solo se
// muestra el estado.
function CertificacionExportador({ registroId, cert, onCorregida }) {
  const { token } = useAuth();
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [numero, setNumero] = useState(cert.numero_documento ?? "");
  const [entidad, setEntidad] = useState(cert.entidad_emisora ?? "");
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  async function handleReenviar(e) {
    e.preventDefault();
    setError(null);
    if (!numero.trim()) {
      setError("El número es obligatorio.");
      return;
    }
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("numero_documento", numero);
      if (cert.tipo === "fitosanitaria") formData.append("entidad_emisora", entidad);
      if (archivo) formData.append("archivo", archivo);
      const { certificaciones } = await api.corregirCertificacionExportacion(
        token,
        registroId,
        cert.tipo,
        formData
      );
      setCorrigiendo(false);
      onCorregida(certificaciones);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta-certificacion-panel">
      <div className="tarjeta-registro-panel__encabezado">
        <strong>{ETIQUETA_TIPO_CERTIFICACION[cert.tipo] ?? cert.tipo}</strong>
        <span className={`estado-panel estado-panel--${CLASE_ESTADO_CERT[cert.estado] ?? "borrador"}`}>
          {ETIQUETA_ESTADO_CERT[cert.estado] ?? cert.estado}
        </span>
      </div>
      <p>
        Número: {cert.numero_documento}
        {cert.entidad_emisora && ` (${cert.entidad_emisora})`}
      </p>
      <p>
        {cert.documento_url ? (
          <a href={`${API_BASE_URL}${cert.documento_url}`} target="_blank" rel="noreferrer">
            Ver archivo ↗
          </a>
        ) : (
          "sin archivo adjunto"
        )}
      </p>

      {cert.estado === "rechazado" && (
        <>
          <div className="aviso-rechazo">
            <strong>Rechazado el {cert.rechazado_en}.</strong> Motivo: {cert.motivo_rechazo}
          </div>

          {!corrigiendo ? (
            <button
              type="button"
              className="boton-panel boton-panel--secundario"
              onClick={() => setCorrigiendo(true)}
            >
              Corregir y reenviar
            </button>
          ) : (
            <form className="formulario-panel formulario-rechazo" onSubmit={handleReenviar}>
              <label>
                Número {cert.tipo === "fitosanitaria" ? "de certificado" : "de declaración/documento"}
                <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} required />
              </label>
              {cert.tipo === "fitosanitaria" && (
                <label>
                  Entidad emisora
                  <input type="text" value={entidad} onChange={(e) => setEntidad(e.target.value)} />
                </label>
              )}
              <label>
                Archivo nuevo (opcional; si no eliges uno se conserva el actual)
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                />
              </label>
              {error && <p className="mensaje-error">{error}</p>}
              <div className="formulario-rechazo__acciones">
                <button type="submit" className="boton-panel" disabled={enviando}>
                  {enviando ? "Reenviando..." : "Reenviar"}
                </button>
                <button
                  type="button"
                  className="boton-panel boton-panel--secundario"
                  onClick={() => {
                    setCorrigiendo(false);
                    setError(null);
                  }}
                  disabled={enviando}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

// Solo aparece en registros de Exportacion (conExtra en routes/exportacion.js
// embebe `certificaciones` en cada registro, las demas etapas ni lo tienen).
function ListaCertificaciones({ registroId, certificaciones, onCorregida }) {
  if (!certificaciones || certificaciones.length === 0) return null;
  return (
    <div>
      {certificaciones.map((c) => (
        <CertificacionExportador key={c.id} registroId={registroId} cert={c} onCorregida={onCorregida} />
      ))}
    </div>
  );
}

// Generico: "mis registros de esta etapa" es el mismo patron para
// Acopio/Procesamiento/Exportacion (Produccion tiene su propia lista,
// ProduccionListaPage.jsx, por las fotos obligatorias).
export function EtapaListaPage({ etapa, titulo, nuevoTo }) {
  const { token } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarRegistrosEtapa(etapa, token, controller.signal)
      .then(({ registros: propios }) => setRegistros(propios))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [token, etapa]);

  async function handleGuardarCorreccion(id, datos) {
    const { registro: actualizado } = await api.editarRegistroEtapa(etapa, token, id, datos);
    setRegistros((actuales) => actuales.map((x) => (x.id === id ? { ...x, ...actualizado } : x)));
  }

  function handleCertificacionCorregida(registroId, certificaciones) {
    setRegistros((actuales) =>
      actuales.map((x) => (x.id === registroId ? { ...x, certificaciones } : x))
    );
  }

  return (
    <PanelLayout>
      <div className="encabezado-panel">
        <h1 className="panel-titulo">{titulo}</h1>
        <Link to={nuevoTo} className="boton-enlace-panel">
          + {CONFIG_ETAPA[etapa].etiquetaAccion}
        </Link>
      </div>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && registros.length === 0 && (
        <div className="estado-vacio-panel">
          <p>Todavía no tienes registros de {CONFIG_ETAPA[etapa].etiqueta.toLowerCase()}.</p>
        </div>
      )}

      <div className="lista-registros-panel">
        {registros.map((r) => {
          const camposMostrar = resolverPorProducto(CONFIG_ETAPA[etapa].camposMostrar, r.lote_tipo_producto, r.lote_ruta);
          return (
          <div key={r.id} className="tarjeta-panel tarjeta-registro-panel">
            <div className="tarjeta-registro-panel__encabezado">
              <strong>{r.lote_codigo_unico}</strong>
              <div className="badge-grupo-estado">
                <span
                  className={`estado-panel estado-panel--${r.rechazado_en ? "rechazado" : r.estado}`}
                >
                  {r.rechazado_en ? "Rechazado" : r.estado === "validado" ? "Validado" : "Borrador"}
                </span>
                {r.estado === "validado" && !r.rechazado_en && (
                  <span
                    className="badge-en-cadena"
                    title="Este evento ya generó su bloque en la cadena hash de este lote"
                  >
                    🔗 En la cadena de bloques
                  </span>
                )}
              </div>
            </div>
            <DescargaQrLote loteId={r.lote_id} tieneQr={r.lote_tiene_qr} />
            {camposMostrar.map(({ key, label, sufijo, traducir }) => (
              <p key={key}>
                {label}: {formatearValor(r[key], sufijo, traducir)}
              </p>
            ))}
            <ListaCertificaciones
              registroId={r.id}
              certificaciones={r.certificaciones}
              onCorregida={(certs) => handleCertificacionCorregida(r.id, certs)}
            />
            {r.estado === "validado" && (
              <p className="texto-tenue-panel">Validado el {r.validado_en}</p>
            )}
            {r.rechazado_en && (
              <>
                <div className="aviso-rechazo">
                  <strong>Rechazado el {r.rechazado_en}.</strong> Motivo: {r.motivo_rechazo}
                </div>
                <FormularioCorreccion
                  registro={r}
                  campos={resolverPorProducto(
                    CONFIG_ETAPA[etapa].camposCorreccion ?? CONFIG_ETAPA[etapa].campos,
                    r.lote_tipo_producto,
                    r.lote_ruta
                  )}
                  onGuardar={(datos) => handleGuardarCorreccion(r.id, datos)}
                />
              </>
            )}
          </div>
          );
        })}
      </div>
    </PanelLayout>
  );
}
