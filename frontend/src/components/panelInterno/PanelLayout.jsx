import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useTema } from "../../theme/TemaContext.jsx";
import { NAV_POR_ROL } from "../../constants/panelNav.js";
import { ETIQUETAS_ROL } from "../../constants/catalogos.js";
import { ToggleTema } from "../publico/ToggleTema.jsx";
import "../../styles/panelProductor.css";

// Compartido con las paginas hijas (hoy Mi perfil, para todos los roles)
// para que, al guardar el perfil, el sidebar (nombre/foto) se actualice al
// instante sin esperar a una navegacion que vuelva a montar el layout.
const PerfilContext = createContext(null);

export function usePerfilPanel() {
  const ctx = useContext(PerfilContext);
  if (!ctx) throw new Error("usePerfilPanel debe usarse dentro de PanelLayout");
  return ctx;
}

// Layout unico del panel interno, reutilizado por los 7 roles (sidebar,
// paleta y tipografia identicos -- ver docs/CONTEXTO.md). Lo unico que
// cambia por rol son los items de navegacion (NAV_POR_ROL) y la etiqueta
// del rol mostrada bajo el nombre.
export function PanelLayout({ children }) {
  const { usuario, token, cerrarSesion } = useAuth();
  // Toggle claro/oscuro GLOBAL (ver TemaContext.jsx) -- mismo Context que
  // ya usan la landing y la ficha de trazabilidad, aplicado aqui al unico
  // layout compartido por los 7 roles.
  const { tema } = useTema();
  const location = useLocation();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const navItems = NAV_POR_ROL[usuario.rol] ?? [];

  useEffect(() => {
    // AbortController en vez de una simple bandera booleana: en React
    // StrictMode (dev) este efecto se invoca dos veces al montar, y ambas
    // llamadas a la API SI llegan a salir por la red. Con solo una bandera
    // "vigente" cada respuesta se auto-descartaba correctamente en teoria,
    // pero en la practica se observo una carrera real (ambas resolvian 200,
    // y a veces la que "ganaba" dejaba perfil=null con cargando=false,
    // mostrando el estado de error aunque el fetch funciono). Abortar la
    // peticion de la invocacion anterior elimina la ambiguedad: solo queda
    // una peticion viva.
    const controller = new AbortController();
    api
      .obtenerPerfil(token, controller.signal)
      .then(({ usuario: u }) => setPerfil(u))
      .catch((err) => {
        if (err.name !== "AbortError") {
          /* si falla, el sidebar usa los datos basicos de la sesion */
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoPerfil(false);
      });
    return () => controller.abort();
  }, [token]);

  function handleLogout() {
    cerrarSesion();
    navigate("/login", { replace: true });
  }

  const nombreMostrado = perfil?.nombre_publico || perfil?.nombre || usuario.nombre;
  const inicial = nombreMostrado?.charAt(0)?.toUpperCase() ?? "?";
  const contextoPerfil = useMemo(
    () => ({ perfil, setPerfil, cargandoPerfil }),
    [perfil, cargandoPerfil]
  );

  return (
    <div className="panel-productor" data-tema={tema}>
      <button
        type="button"
        className="panel-productor__hamburguesa"
        onClick={() => setSidebarAbierto(true)}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {sidebarAbierto && (
        <div className="panel-productor__velo" onClick={() => setSidebarAbierto(false)} />
      )}

      <aside className={`panel-productor__sidebar ${sidebarAbierto ? "abierto" : ""}`}>
        <div className="panel-productor__marca-fila">
          <Link to="/" className="panel-productor__marca">
            Raíz
          </Link>
          <div className="panel-productor__marca-acciones">
            <ToggleTema className="panel-productor__tema" />
            <button
              type="button"
              className="panel-productor__cerrar-movil"
              onClick={() => setSidebarAbierto(false)}
              aria-label="Cerrar menú"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="panel-productor__perfil">
          <div className="panel-productor__avatar">
            {cargandoPerfil ? (
              // Estado de carga explicito: mientras no sabemos con certeza
              // si hay foto, no adivinamos renderizando el <span> de
              // inicial (eso es lo que antes causaba un cambio de tipo de
              // nodo -- de <span> a <img> -- apenas llegaba la respuesta).
              <span aria-hidden="true" />
            ) : perfil?.foto_perfil_url ? (
              <img src={`${API_BASE_URL}${perfil.foto_perfil_url}`} alt="" />
            ) : (
              <span>{inicial}</span>
            )}
          </div>
          <div className="panel-productor__perfil-texto">
            <strong>{nombreMostrado}</strong>
            <span>{ETIQUETAS_ROL[usuario.rol] ?? usuario.rol}</span>
          </div>
        </div>

        <nav className="panel-productor__nav">
          {navItems.map((item) => {
            const activo = item.prefijo
              ? location.pathname.startsWith(item.to)
              : location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`panel-productor__nav-item ${activo ? "activo" : ""}`}
                onClick={() => setSidebarAbierto(false)}
              >
                <span className="panel-productor__nav-icono">{item.icono}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button type="button" className="panel-productor__salir" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </aside>

      <main className="panel-productor__contenido">
        <PerfilContext.Provider value={contextoPerfil}>{children}</PerfilContext.Provider>
      </main>
    </div>
  );
}
