import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useTema } from "../theme/TemaContext.jsx";
import { ToggleTema } from "../components/publico/ToggleTema.jsx";

export function LoginPage() {
  const { token, iniciarSesion } = useAuth();
  // Toggle claro/oscuro GLOBAL (ver TemaContext.jsx) -- mismo Context que
  // ya comparten landing, ficha publica y panel interno.
  const { tema } = useTema();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  if (token) return <Navigate to="/panel" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { token: nuevoToken, usuario } = await api.login(email, password);
      iniciarSesion(nuevoToken, usuario);
      navigate("/panel", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pantalla-centrada" data-tema={tema}>
      <div className="tarjeta">
        <div className="login-encabezado">
          <h1 className="marca-login">Raíz</h1>
          <ToggleTema />
        </div>
        <p className="subtitulo">Trazabilidad de café y cacao — Huánuco</p>

        <form className="formulario" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="mensaje-error">{error}</p>}

          <button type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>

          <Link to="/" className="enlace-volver">
            ← Volver al catálogo público
          </Link>
        </form>
      </div>
    </div>
  );
}
