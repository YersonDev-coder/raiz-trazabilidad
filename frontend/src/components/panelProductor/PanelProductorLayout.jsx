// El panel de Productor fue el primero en construirse (ver
// docs/CONTEXTO.md), pero el layout en si ya no es especifico de un rol:
// se generalizo a components/panelInterno/PanelLayout.jsx para poder
// replicarlo a Cooperativa/Planta/SENASA/Exportador/SUNAT/Admin sin
// duplicar codigo. Este archivo se mantiene como re-export para no tener
// que tocar los imports de las paginas de Productor ya construidas.
export { PanelLayout as PanelProductorLayout, usePerfilPanel } from "../panelInterno/PanelLayout.jsx";
