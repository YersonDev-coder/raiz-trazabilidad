import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_TOKEN = "raiz_token";
const STORAGE_USUARIO = "raiz_usuario";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_TOKEN));
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem(STORAGE_USUARIO);
    return guardado ? JSON.parse(guardado) : null;
  });

  const value = useMemo(
    () => ({
      token,
      usuario,
      iniciarSesion(nuevoToken, nuevoUsuario) {
        localStorage.setItem(STORAGE_TOKEN, nuevoToken);
        localStorage.setItem(STORAGE_USUARIO, JSON.stringify(nuevoUsuario));
        setToken(nuevoToken);
        setUsuario(nuevoUsuario);
      },
      cerrarSesion() {
        localStorage.removeItem(STORAGE_TOKEN);
        localStorage.removeItem(STORAGE_USUARIO);
        setToken(null);
        setUsuario(null);
      },
    }),
    [token, usuario]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
