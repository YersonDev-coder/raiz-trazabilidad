import { useEffect, useState } from "react";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";

export function ConfiguracionSitioPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [nombrePlataforma, setNombrePlataforma] = useState("");
  const [archivoImagen, setArchivoImagen] = useState(null);
  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .obtenerConfiguracion(controller.signal)
      .then(({ configuracion }) => {
        setConfig(configuracion);
        setNombrePlataforma(configuracion.nombre_plataforma ?? "");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, []);

  function handleArchivo(e) {
    const archivo = e.target.files?.[0];
    setArchivoImagen(archivo ?? null);
    setPrevisualizacion(archivo ? URL.createObjectURL(archivo) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setExito(false);
    setGuardando(true);
    try {
      const formData = new FormData();
      formData.append("nombre_plataforma", nombrePlataforma);
      if (archivoImagen) formData.append("imagen_fondo", archivoImagen);

      const { configuracion } = await api.actualizarConfiguracionSitio(token, formData);
      setConfig(configuracion);
      setArchivoImagen(null);
      setPrevisualizacion(null);
      setExito(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const imagenActualUrl = config?.imagen_fondo_landing_url
    ? config.imagen_fondo_landing_url.startsWith("http")
      ? config.imagen_fondo_landing_url
      : `${API_BASE_URL}${config.imagen_fondo_landing_url}`
    : null;

  return (
    <PanelLayout>
      <h1 className="panel-titulo">Configuración del sitio</h1>
      <p className="subtitulo-panel">
        Nombre de la plataforma e imagen de fondo del hero de la landing pública.
      </p>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}

      {!cargando && (
        <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Identidad</legend>
            <label>
              Nombre de la plataforma
              <input
                type="text"
                value={nombrePlataforma}
                onChange={(e) => setNombrePlataforma(e.target.value)}
                required
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Imagen de fondo del hero</legend>

            {(previsualizacion || imagenActualUrl) && (
              <img
                src={previsualizacion || imagenActualUrl}
                alt="Imagen de fondo actual del hero"
                className="configuracion-sitio__preview"
              />
            )}

            <label className="boton-subir-foto">
              {archivoImagen ? "Cambiar selección" : "Subir nueva imagen"}
              <input type="file" accept="image/*" onChange={handleArchivo} hidden />
            </label>
          </fieldset>

          {error && <p className="mensaje-error">{error}</p>}
          {exito && <p className="texto-exito-panel">Configuración actualizada ✓</p>}

          <button type="submit" className="boton-panel" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      )}
    </PanelLayout>
  );
}
