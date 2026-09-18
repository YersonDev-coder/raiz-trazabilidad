import { useState } from "react";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import {
  PanelProductorLayout,
  usePerfilPanel,
} from "../../components/panelProductor/PanelProductorLayout.jsx";
import { ETIQUETAS_GENERACION, ETIQUETAS_PRACTICA_AGRICOLA } from "../../constants/catalogos.js";

const HISTORIA_MAX = 500;

// Recibe `perfil` ya resuelto (nunca null) como prop: este componente solo
// se monta una vez que ContenidoPerfil confirmo que los datos llegaron, asi
// que no necesita manejar un estado intermedio "puede que no haya foto
// todavia porque no se cual es la respuesta" -- la decision entre <img> y
// <span> se toma una sola vez, con el dato final.
// Los campos de "historia pública" (año de inicio, generación familiar,
// historia, asociación, prácticas agrícolas) se pensaron para el
// Productor (son los que arma su tarjeta de actor en la ficha pública,
// ver TrazabilidadPublicaPage.jsx) -- pero como PerfilPage.jsx es un
// componente unico compartido por CUALQUIER rol autenticado (ver
// App.jsx, ruta /panel/perfil sin restriccion de rol), se renderizaban
// igual para los 4 roles no-productor (confirmado: Cooperativa, Planta,
// Exportador, Administrador). Se muestran solo si el rol es 'productor'
// -- en vez de una lista de exclusion por rol, para que ningun rol
// nuevo que se agregue a futuro los herede por descuido.
function FormularioPerfil({ perfil }) {
  const { token, usuario } = useAuth();
  const { setPerfil } = usePerfilPanel();
  const mostrarHistoriaPublica = usuario.rol === "productor";

  const [nombrePublico, setNombrePublico] = useState(perfil.nombre_publico ?? "");
  const [anioInicio, setAnioInicio] = useState(perfil.anio_inicio_actividad ?? "");
  const [generacion, setGeneracion] = useState(perfil.generacion_familiar ?? "");
  const [historia, setHistoria] = useState(perfil.historia ?? "");
  const [asociacion, setAsociacion] = useState(perfil.asociacion_cooperativa ?? "");
  const [practicas, setPracticas] = useState(perfil.practicas_agricolas ?? "");
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  function handleArchivo(e) {
    const archivo = e.target.files?.[0];
    setArchivoFoto(archivo ?? null);
    setPrevisualizacion(archivo ? URL.createObjectURL(archivo) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setExito(false);
    setGuardando(true);
    try {
      const formData = new FormData();
      formData.append("nombre_publico", nombrePublico);
      // Si el formulario no muestra estos campos (Cooperativa), no se
      // mandan -- el backend solo toca lo que llega en el body (ver
      // PUT /api/usuarios/perfil), asi que omitirlos deja esos valores
      // tal como estaban (siempre NULL para Cooperativa, nunca se pudo
      // cargar nada ahi).
      if (mostrarHistoriaPublica) {
        formData.append("anio_inicio_actividad", anioInicio);
        formData.append("generacion_familiar", generacion);
        formData.append("historia", historia);
        formData.append("asociacion_cooperativa", asociacion);
        formData.append("practicas_agricolas", practicas);
      }
      if (archivoFoto) formData.append("foto", archivoFoto);

      // setPerfil viene del contexto compartido con el sidebar: al
      // actualizar aqui, el avatar/nombre del menu lateral cambia al
      // instante, sin esperar una navegacion.
      const { usuario: actualizado } = await api.actualizarPerfil(token, formData);
      setPerfil(actualizado);
      setNombrePublico(actualizado.nombre_publico ?? "");
      setAnioInicio(actualizado.anio_inicio_actividad ?? "");
      setGeneracion(actualizado.generacion_familiar ?? "");
      setHistoria(actualizado.historia ?? "");
      setAsociacion(actualizado.asociacion_cooperativa ?? "");
      setPracticas(actualizado.practicas_agricolas ?? "");
      setArchivoFoto(null);
      setPrevisualizacion(null);
      setExito(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
      <div className="perfil-avatar-editor">
        <div className="perfil-avatar-editor__actual">
          {previsualizacion ? (
            <img src={previsualizacion} alt="" />
          ) : perfil.foto_perfil_url ? (
            <img src={`${API_BASE_URL}${perfil.foto_perfil_url}`} alt="" />
          ) : (
            <span>{(nombrePublico || usuario.nombre).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <label className="boton-subir-foto">
          Cambiar foto
          <input type="file" accept="image/*" onChange={handleArchivo} hidden />
        </label>
      </div>

      <label>
        Nombre público
        <input
          type="text"
          value={nombrePublico}
          onChange={(e) => setNombrePublico(e.target.value)}
          placeholder={perfil.nombre}
        />
      </label>

      <p className="texto-tenue-panel">Email de acceso: {perfil.email} (no editable)</p>
      {perfil.codigo_productor && (
        <p className="texto-tenue-panel">
          Código de productor: <strong>{perfil.codigo_productor}</strong> (uso interno, no se muestra
          en tu ficha pública)
        </p>
      )}

      {mostrarHistoriaPublica && (
        <>
          <hr className="separador-panel" />
          <p className="subtitulo-panel">
            Todo lo de aquí abajo es opcional y público: se muestra en la ficha de trazabilidad de
            tus lotes.
          </p>

          <label>
            Año de inicio en la actividad
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={anioInicio}
              onChange={(e) => setAnioInicio(e.target.value)}
              placeholder="Ej. 1998"
            />
          </label>

          <label>
            Generación familiar
            <select value={generacion} onChange={(e) => setGeneracion(e.target.value)}>
              <option value="">Sin especificar</option>
              {Object.entries(ETIQUETAS_GENERACION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label>
            Breve historia
            <textarea
              value={historia}
              onChange={(e) => setHistoria(e.target.value.slice(0, HISTORIA_MAX))}
              maxLength={HISTORIA_MAX}
              rows={4}
              placeholder="Cuéntanos brevemente tu historia con el café/cacao"
            />
            <span className="texto-tenue-panel">{historia.length}/{HISTORIA_MAX}</span>
          </label>

          <label>
            Asociación o cooperativa
            <input
              type="text"
              value={asociacion}
              onChange={(e) => setAsociacion(e.target.value)}
              placeholder="Ej. Cooperativa Agraria Divisoria"
            />
          </label>

          <hr className="separador-panel" />
          <p className="subtitulo-panel">
            Esto es solo para uso interno de la plataforma: no se muestra en tu ficha pública.
          </p>

          <label>
            Prácticas agrícolas
            <select value={practicas} onChange={(e) => setPracticas(e.target.value)}>
              <option value="">Sin especificar</option>
              {Object.entries(ETIQUETAS_PRACTICA_AGRICOLA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="mensaje-error">{error}</p>}
      {exito && <p className="texto-exito-panel">Perfil actualizado ✓</p>}

      <button type="submit" className="boton-panel" disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

// Debe renderizarse COMO HIJO de <PanelProductorLayout> (no al mismo nivel
// que la llama) para que usePerfilPanel() encuentre el Context.Provider,
// que vive adentro del layout envolviendo a `children`.
function ContenidoPerfil() {
  const { perfil, cargandoPerfil } = usePerfilPanel();

  if (cargandoPerfil) {
    return <p className="texto-tenue-panel">Cargando...</p>;
  }

  if (!perfil) {
    return <p className="mensaje-error">No se pudo cargar tu perfil. Intenta recargar la página.</p>;
  }

  return <FormularioPerfil perfil={perfil} />;
}

export function PerfilPage() {
  return (
    <PanelProductorLayout>
      <h1 className="panel-titulo">Mi perfil</h1>
      <p className="subtitulo-panel">
        Este nombre y foto son los que verá el comprador final en la ficha de trazabilidad de tus
        lotes.
      </p>
      <ContenidoPerfil />
    </PanelProductorLayout>
  );
}
