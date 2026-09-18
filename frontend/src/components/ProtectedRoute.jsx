import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function ProtectedRoute({ rolesPermitidos, children }) {
  const { token, usuario } = useAuth();

  if (!token || !usuario) return <Navigate to="/login" replace />;

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/panel" replace />;
  }

  return children;
}
