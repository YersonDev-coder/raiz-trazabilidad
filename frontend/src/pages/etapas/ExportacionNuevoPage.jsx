import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";

const ENTIDAD_EMISORA_DEFAULT = "SENASA";

// Pagina dedicada (no la generica EtapaNuevoPage.jsx) porque Exportacion ya
// no es solo puerto/destino/contenedor: el Exportador ahora sube en el
// mismo formulario la certificacion fitosanitaria y la documentacion
// aduanera (numero + archivo opcional), algo que la pagina generica no
// sabe manejar (no soporta subida de archivos). Mismo criterio que
// ProduccionNuevoPage.jsx, que tampoco usa la generica por una razon
// parecida (selector de parcela + fotos obligatorias).
export function ExportacionNuevoPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [lotes, setLotes] = useState([]);
  const [cargandoLotes, setCargandoLotes] = useState(true);
  const [loteId, setLoteId] = useState("");

  const [puerto, setPuerto] = useState("");
  const [destino, setDestino] = useState("");
  const [contenedor, setContenedor] = useState("");

  const [fitosanitariaNumero, setFitosanitariaNumero] = useState("");
  const [fitosanitariaEntidad, setFitosanitariaEntidad] = useState(ENTIDAD_EMISORA_DEFAULT);
  const [fitosanitariaArchivo, setFitosanitariaArchivo] = useState(null);

  const [aduaneraNumero, setAduaneraNumero] = useState("");
  const [aduaneraArchivo, setAduaneraArchivo] = useState(null);

  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarLotes(token, "exportacion")
      .then(({ lotes: disponibles }) => {
        setLotes(disponibles);
        if (disponibles.length > 0) setLoteId(String(disponibles[0].id));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoLotes(false);
      });
    return () => controller.abort();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      // 1) El registro de exportacion en si (igual que antes).
      const { registro } = await api.crearRegistroEtapa("exportacion", token, {
        lote_id: Number(loteId),
        puerto,
        destino,
        contenedor,
      });

      // 2) Certificaciones sobre ESE registro, en la misma accion de
      // "Registrar exportación" (mismo mecanismo de subida que las fotos
      // de evidencia de cosecha, ver api.subirFotosProduccion).
      const formData = new FormData();
      formData.append("fitosanitaria_numero", fitosanitariaNumero);
      formData.append("fitosanitaria_entidad", fitosanitariaEntidad);
      if (fitosanitariaArchivo) formData.append("fitosanitaria_archivo", fitosanitariaArchivo);
      formData.append("aduanera_numero", aduaneraNumero);
      if (aduaneraArchivo) formData.append("aduanera_archivo", aduaneraArchivo);
      await api.subirCertificacionesExportacion(token, registro.id, formData);

      navigate("/exportacion", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PanelLayout>
      <h1 className="panel-titulo">Registrar exportación</h1>

      {cargandoLotes ? (
        <p className="texto-tenue-panel">Cargando...</p>
      ) : lotes.length === 0 ? (
        <div className="estado-vacio-panel">
          <p>No hay lotes esperando esta etapa por ahora.</p>
        </div>
      ) : (
        <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Lote</legend>
            <label>
              ¿Sobre qué lote es este registro?
              <select value={loteId} onChange={(e) => setLoteId(e.target.value)} required>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.codigo_unico} ({l.tipo_producto})
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset>
            <legend>Datos de exportación</legend>
            <label>
              Puerto
              <input type="text" value={puerto} onChange={(e) => setPuerto(e.target.value)} required />
            </label>
            <label>
              Destino
              <input type="text" value={destino} onChange={(e) => setDestino(e.target.value)} required />
            </label>
            <label>
              Contenedor
              <input
                type="text"
                value={contenedor}
                onChange={(e) => setContenedor(e.target.value)}
                required
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Certificación fitosanitaria</legend>
            <label>
              Número de certificado
              <input
                type="text"
                value={fitosanitariaNumero}
                onChange={(e) => setFitosanitariaNumero(e.target.value)}
                required
              />
            </label>
            <label>
              Entidad emisora
              <input
                type="text"
                value={fitosanitariaEntidad}
                onChange={(e) => setFitosanitariaEntidad(e.target.value)}
              />
            </label>
            <label>
              Archivo adjunto (PDF o imagen, opcional)
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFitosanitariaArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Documentación aduanera</legend>
            <label>
              Número de declaración/documento
              <input
                type="text"
                value={aduaneraNumero}
                onChange={(e) => setAduaneraNumero(e.target.value)}
                required
              />
            </label>
            <label>
              Archivo adjunto (PDF o imagen, opcional)
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAduaneraArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </fieldset>

          {error && <p className="mensaje-error">{error}</p>}

          <button type="submit" className="boton-panel" disabled={enviando}>
            {enviando ? "Guardando..." : "Registrar exportación"}
          </button>
        </form>
      )}
    </PanelLayout>
  );
}
