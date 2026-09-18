import db from "../db.js";

const DEFAULTS = {
  nombre_plataforma: "Raíz",
  imagen_fondo_landing_url: null,
};

export function obtenerConfiguracion() {
  const filas = db.prepare("SELECT clave, valor FROM configuracion_sitio").all();
  const mapa = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  return {
    nombre_plataforma: mapa.nombre_plataforma ?? DEFAULTS.nombre_plataforma,
    imagen_fondo_landing_url: mapa.imagen_fondo_landing_url ?? DEFAULTS.imagen_fondo_landing_url,
  };
}
