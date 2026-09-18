// Items de sidebar por rol para el panel interno (mismo layout visual para
// todos los roles, ver components/panelInterno/PanelLayout.jsx). `prefijo:
// true` marca items cuya ruta activa debe resaltarse tambien en subrutas
// (p.ej. /panel/parcelas/nueva resalta "Mis parcelas").
export const NAV_POR_ROL = {
  productor: [
    { to: "/panel/perfil", icono: "👤", label: "Mi perfil" },
    { to: "/panel/parcelas", icono: "🌱", label: "Mis parcelas", prefijo: true },
    { to: "/produccion/nuevo", icono: "📝", label: "Registrar cosecha" },
    { to: "/produccion", icono: "📋", label: "Mis registros" },
    { to: "/panel/seguimiento", icono: "📍", label: "Seguimiento de mi cosecha" },
  ],
  cooperativa: [
    { to: "/panel/perfil", icono: "👤", label: "Mi perfil" },
    { to: "/produccion/validar", icono: "✅", label: "Validar productores" },
    { to: "/acopio/nuevo", icono: "⚖️", label: "Registrar acopio" },
    { to: "/acopio", icono: "📋", label: "Mis registros de acopio" },
  ],
  planta_procesamiento: [
    { to: "/panel/perfil", icono: "👤", label: "Mi perfil" },
    { to: "/acopio/validar", icono: "✅", label: "Validar acopio" },
    { to: "/procesamiento/nuevo", icono: "🔥", label: "Registrar procesamiento" },
    { to: "/procesamiento", icono: "📋", label: "Mis registros de procesamiento" },
  ],
  exportador: [
    { to: "/panel/perfil", icono: "👤", label: "Mi perfil" },
    { to: "/exportacion/nuevo", icono: "🚢", label: "Registrar exportación" },
    { to: "/exportacion", icono: "📋", label: "Mis registros de exportación" },
  ],
  // senasa/sunat ya no son roles con login (ver backend/src/routes/auth.js)
  // -- lo que hacian se reparte entre Administrador (confirmar el trabajo
  // de Planta, y validar certificaciones) y ya no hay panel propio para
  // esos roles.
  admin: [
    { to: "/panel/perfil", icono: "👤", label: "Mi perfil" },
    { to: "/panel/usuarios/nuevo", icono: "➕", label: "Crear usuario" },
    { to: "/procesamiento/validar", icono: "✅", label: "Validar procesamiento" },
    { to: "/certificaciones/validar", icono: "📑", label: "Validar certificaciones" },
    { to: "/panel/configuracion", icono: "⚙️", label: "Configuración del sitio" },
  ],
};
