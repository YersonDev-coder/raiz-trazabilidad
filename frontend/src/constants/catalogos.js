export const VARIEDADES_POR_PRODUCTO = {
  cafe: ["Catimor", "Caturra", "Typica", "Bourbon", "Pache", "Costa Rica", "Otra"],
  cacao: ["CCN-51", "Criollo", "Forastero", "Trinitario", "Blanco de Huánuco", "Otra"],
};

export const VARIEDAD_OTRA = "Otra";

export const ETIQUETAS_PRACTICA_AGRICOLA = {
  convencional: "Convencional",
  organico: "Orgánico",
  agroecologico: "Agroecológico / en transición",
};

export const ETIQUETAS_SISTEMA_CULTIVO = {
  monocultivo: "Monocultivo",
  agroforestal: "Sistema agroforestal (con árboles de sombra)",
};

// estado_grano: 2 opciones por cultivo, la primera es el default sugerido
// al heredar el tipo de producto de la parcela (ver ProduccionNuevoPage.jsx).
export const ESTADOS_GRANO_POR_PRODUCTO = {
  cafe: [
    { valor: "cereza_fresca", etiqueta: "Cereza fresca" },
    { valor: "cereza_sobremadura", etiqueta: "Cereza sobremadura" },
  ],
  cacao: [
    { valor: "mazorca", etiqueta: "Mazorca" },
    { valor: "mazorca_partida", etiqueta: "Mazorca partida (en baba)" },
  ],
};

export const ETIQUETAS_ESTADO_GRANO = {
  cereza_fresca: "Cereza fresca",
  cereza_sobremadura: "Cereza sobremadura",
  mazorca: "Mazorca",
  mazorca_partida: "Mazorca partida (en baba)",
};

export const ETIQUETAS_TIPO_COSECHA = {
  selectiva: "Selectiva (solo grano maduro)",
  general: "General / deslije",
};

// Acopio: metodo_fermentacion es exclusivo de cafe, metodo_secado es
// compartido por cafe y cacao (mismas 2 opciones para ambos, ver
// migracion 030 y routes/acopio.js).
export const ETIQUETAS_METODO_FERMENTACION = {
  lavado: "Con agua (lavado)",
  seco: "En seco",
};

export const ETIQUETAS_METODO_SECADO = {
  natural_sol: "Natural al sol",
  mecanico: "Mecánico",
};

// Procesamiento: clasificacion_calidad es exclusiva de cafe (informativa,
// no fragmenta el lote), molienda_tipo es exclusiva de cacao Ruta B (ver
// migracion 031 y routes/procesamiento.js).
export const ETIQUETAS_CLASIFICACION_CALIDAD = {
  excelso: "Café excelso",
  consumo: "Café consumo",
  pasilla: "Café pasilla",
  mezcla_variable: "Mezcla variable",
};

export const ETIQUETAS_MOLIENDA_TIPO = {
  licor: "Licor de cacao",
  manteca: "Manteca de cacao",
  polvo: "Polvo de cacao",
};

export const ZONAS = [
  "Tingo María",
  "Leoncio Prado",
  "Pachitea",
  "Huánuco (Amarilis/Pillco Marca)",
  "Marañón",
  "Puerto Inca",
];

export const ETIQUETAS_GENERACION = {
  "1ra": "1ra generación",
  "2da": "2da generación",
  "3ra_o_mas": "3ra generación o más",
};

// senasa/sunat ya no son roles con login (ver backend/src/routes/auth.js) --
// se quitan de aca tambien, asi CrearUsuarioPage.jsx (que arma su <select>
// de rol a partir de este objeto) ya no los ofrece. Los pocos lugares que
// muestran ETIQUETAS_ROL[actor.rol] para un usuario historico con ese rol
// (lotes ya 'entregado' de antes de este cambio) tienen fallback `?? rol`,
// asi que en el peor caso muestran el texto crudo "senasa"/"sunat" en vez
// de la etiqueta bonita -- aceptable para datos historicos de un rol que
// ya no existe.
export const ETIQUETAS_ROL = {
  productor: "Productor",
  cooperativa: "Cooperativa",
  planta_procesamiento: "Planta de Procesamiento",
  exportador: "Exportador",
  admin: "Administrador",
};
