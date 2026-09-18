import { Navigate } from "react-router-dom";

// Punto de entrada tras el login (ver LoginPage, que navega a /panel).
// Todos los roles tienen su propio panel con sidebar (ver PanelLayout) que
// arranca en "Mi perfil" -- este componente solo enruta, nunca se ve.
export function DashboardPage() {
  return <Navigate to="/panel/perfil" replace />;
}
