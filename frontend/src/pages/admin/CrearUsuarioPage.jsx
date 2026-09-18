import { useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";
import { ETIQUETAS_ROL } from "../../constants/catalogos.js";

const VALORES_INICIALES = { nombre: "", email: "", rol: "productor", password: "" };

export function CrearUsuarioPage() {
  const { token } = useAuth();
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);
  const [creado, setCreado] = useState(null);

  function handleCampo(campo, valor) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setCreado(null);
    setCreando(true);
    try {
      const { usuario } = await api.crearUsuario(token, valores);
      setCreado(usuario);
      setValores(VALORES_INICIALES);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <PanelLayout>
      <h1 className="panel-titulo">Crear usuario</h1>
      <p className="subtitulo-panel">
        Da de alta una cuenta nueva para cualquiera de los actores de la cadena. Queda activa de
        inmediato, sin verificación por correo.
      </p>

      <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Datos de la cuenta</legend>
          <label>
            Nombre
            <input
              type="text"
              value={valores.nombre}
              onChange={(e) => handleCampo("nombre", e.target.value)}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={valores.email}
              onChange={(e) => handleCampo("email", e.target.value)}
              required
            />
          </label>
          <label>
            Rol
            <select value={valores.rol} onChange={(e) => handleCampo("rol", e.target.value)} required>
              {Object.entries(ETIQUETAS_ROL).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={valores.password}
              onChange={(e) => handleCampo("password", e.target.value)}
              minLength={8}
              required
            />
          </label>
        </fieldset>

        {error && <p className="mensaje-error">{error}</p>}
        {creado && (
          <p className="texto-exito-panel">
            Usuario creado: {creado.email} como {ETIQUETAS_ROL[creado.rol] ?? creado.rol}
          </p>
        )}

        <button type="submit" className="boton-panel" disabled={creando}>
          {creando ? "Creando..." : "Crear usuario"}
        </button>
      </form>
    </PanelLayout>
  );
}
