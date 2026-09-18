import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelProductorLayout } from "../../components/panelProductor/PanelProductorLayout.jsx";
import { FormularioCorreccion } from "../../components/panelInterno/FormularioCorreccion.jsx";
import { DescargaQrLote } from "../../components/panelInterno/DescargaQrLote.jsx";
import { CONFIG_ETAPA } from "../../constants/etapas.js";

// Registros de produccion viejos (de antes de que la foto fuera obligatoria)
// pueden existir en borrador sin ninguna foto todavia. Mientras sigan en
// borrador se les puede agregar aqui mismo, sin bloquear el sistema por
// datos legacy; una vez validados quedan como excepcion honesta (sin foto).
function AgregarFotosLegacy({ registroId, onSubidas }) {
  const { token } = useAuth();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  async function handleArchivos(e) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (archivos.length === 0) return;

    setError(null);
    setSubiendo(true);
    try {
      const formData = new FormData();
      archivos.forEach((a) => formData.append("fotos", a));
      const { fotos } = await api.subirFotosProduccion(token, registroId, formData);
      onSubidas(fotos);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <p className="texto-tenue-panel">
        Este registro se guardó sin foto de evidencia. Puedes agregarla mientras siga en borrador.
      </p>
      <label className="boton-subir-foto">
        {subiendo ? "Subiendo..." : "+ Agregar foto"}
        <input type="file" accept="image/*" multiple onChange={handleArchivos} disabled={subiendo} hidden />
      </label>
      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export function ProduccionListaPage() {
  const { token } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarRegistrosProduccion(token, controller.signal)
      .then(({ registros: propios }) => setRegistros(propios))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [token]);

  async function handleGuardarCorreccion(id, datos) {
    const { registro: actualizado } = await api.editarRegistroEtapa("produccion", token, id, datos);
    setRegistros((actuales) => actuales.map((x) => (x.id === id ? { ...x, ...actualizado } : x)));
  }

  return (
    <PanelProductorLayout>
      <div className="encabezado-panel">
        <h1 className="panel-titulo">Mis registros de producción</h1>
        <Link to="/produccion/nuevo" className="boton-enlace-panel">
          + Registrar cosecha
        </Link>
      </div>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && registros.length === 0 && (
        <div className="estado-vacio-panel">
          <p>Todavía no tienes registros de producción.</p>
        </div>
      )}

      <div className="lista-registros-panel">
        {registros.map((r) => (
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
            <p>Variedad: {r.variedad}</p>
            <p>Fecha de cosecha: {r.fecha_cosecha}</p>
            <p>Volumen: {r.volumen_kg} kg</p>
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
                  campos={CONFIG_ETAPA.produccion.campos}
                  onGuardar={(datos) => handleGuardarCorreccion(r.id, datos)}
                />
              </>
            )}

            {r.fotos.length > 0 ? (
              <div className="galeria-fotos__grid">
                {r.fotos.map((f) => (
                  <img key={f.id} src={`${API_BASE_URL}${f.url}`} alt="Evidencia de la cosecha" />
                ))}
              </div>
            ) : r.estado === "borrador" ? (
              <AgregarFotosLegacy
                registroId={r.id}
                onSubidas={(fotos) =>
                  setRegistros((actuales) => actuales.map((x) => (x.id === r.id ? { ...x, fotos } : x)))
                }
              />
            ) : (
              <p className="texto-tenue-panel">Registro validado sin foto de evidencia (dato anterior).</p>
            )}
          </div>
        ))}
      </div>
    </PanelProductorLayout>
  );
}
