import { useTema } from "../../theme/TemaContext.jsx";

// Boton de toggle claro/oscuro, compartido entre LandingPage.jsx,
// TrazabilidadPublicaPage.jsx y PanelLayout.jsx (los 7 roles del panel
// interno) -- lee y escribe directo del TemaContext global, siempre la
// misma logica/icono/aria-label. `className` es configurable porque el
// panel interno tiene una barra lateral fija oscura con su propio
// lenguaje visual (no los tokens --pub-*, ver panelProductor.css), asi que
// necesita su propio estilo en vez del pill de .publico-header__tema.
export function ToggleTema({ className = "publico-header__tema" }) {
  const { tema, cambiarTema } = useTema();
  const esOscuro = tema === "oscuro";
  return (
    <button
      type="button"
      className={className}
      onClick={() => cambiarTema(esOscuro ? "claro" : "oscuro")}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
    >
      {esOscuro ? "☀️" : "🌙"}
    </button>
  );
}
