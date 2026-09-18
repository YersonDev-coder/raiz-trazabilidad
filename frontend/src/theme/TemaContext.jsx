import { createContext, useContext, useMemo, useState } from "react";

const TemaContext = createContext(null);

const STORAGE_TEMA = "raiz_tema";
const TEMAS_VALIDOS = ["claro", "oscuro"];

// localStorage puede fallar (Safari/Firefox en modo incognito lo bloquean
// por completo, o la cuota puede estar llena) -- cada acceso va envuelto
// en try/catch para que un fallo ahi nunca tumbe la app. Si falla, el
// toggle sigue funcionando en memoria durante la sesion, simplemente no
// persiste a la proxima visita (mismo criterio que pide la tarea).
function leerTemaGuardado() {
  try {
    const guardado = localStorage.getItem(STORAGE_TEMA);
    return TEMAS_VALIDOS.includes(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

function guardarTema(tema) {
  try {
    localStorage.setItem(STORAGE_TEMA, tema);
  } catch {
    // Sin persistencia para esta sesion -- setTema (estado en memoria) ya
    // se aplico independientemente de esto, el toggle sigue respondiendo.
  }
}

// Modo claro/oscuro GLOBAL: hoy aplicado a landing + ficha publica de
// trazabilidad (ambas bajo la clase `.publico`, ver paleta.css --
// `.publico[data-tema="claro"|"oscuro"]`), paneles internos quedan para un
// paso posterior (usan una paleta distinta, --panel-* / App.css, no
// --pub-*). Sin preferencia guardada todavia (primera visita, o
// localStorage bloqueado) arranca en oscuro -- nunca hereda
// prefers-color-scheme del sistema, es una decision explicita del usuario
// dentro de la app.
export function TemaProvider({ children }) {
  const [tema, setTema] = useState(() => leerTemaGuardado() ?? "oscuro");

  const value = useMemo(
    () => ({
      tema,
      cambiarTema(nuevoTema) {
        setTema(nuevoTema);
        guardarTema(nuevoTema);
      },
    }),
    [tema]
  );

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema debe usarse dentro de <TemaProvider>");
  return ctx;
}
