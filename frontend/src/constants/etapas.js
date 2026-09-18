// Config de campos por etapa, consumida por las paginas de listar/validar
// (pages/etapas/EtapaListaPage.jsx, EtapaValidarPage.jsx) y por
// FormularioCorreccion.jsx. Ya no existe una pagina generica de CREACION
// por `campos` (existio EtapaNuevoPage.jsx, eliminada): Produccion, Acopio,
// Procesamiento y Exportacion tienen cada una su propia pagina de
// creacion hecha a mano, porque en las 4 los campos dependen de datos que
// un formulario generico no puede resolver bien (parcela+fotos en
// Produccion; producto/ruta heredados del lote en Acopio/Procesamiento;
// certificaciones con archivo en Exportacion). `campos`/`camposCorreccion`
// siguen aqui solo para reenviar un registro rechazado.
export const CONFIG_ETAPA = {
  // Solo camposMostrar: Produccion tiene su propia pagina de creacion (con
  // selector de parcela y fotos obligatorias, ver
  // pages/produccion/ProduccionNuevoPage.jsx) -- pero Cooperativa SI puede
  // reusar EtapaValidarPage generica para validarla, de ahi que necesite
  // aparecer aqui aunque sea sin `campos`/`etiquetaAccion`.
  produccion: {
    etiqueta: "Producción",
    // Sin `etiquetaAccion`: Produccion crea registros con su propia pagina
    // (selector de parcela + fotos obligatorias, ver
    // pages/produccion/ProduccionNuevoPage.jsx). Este
    // `campos` es solo para corregir y reenviar un registro ya rechazado
    // (ver FormularioCorreccion.jsx) -- no incluye parcela_id a proposito,
    // porque re-elegir la parcela de una cosecha ya en curso es un caso
    // raro que no vale la pena resolver en este formulario minimo.
    campos: [
      { name: "variedad", label: "Variedad", type: "text" },
      { name: "fecha_cosecha", label: "Fecha de cosecha", type: "date" },
      { name: "volumen_kg", label: "Volumen (kg)", type: "number", step: "0.1", min: "0" },
    ],
    camposMostrar: [
      { key: "variedad", label: "Variedad" },
      { key: "fecha_cosecha", label: "Fecha de cosecha" },
      { key: "volumen_kg", label: "Volumen", sufijo: " kg" },
    ],
  },
  acopio: {
    etiqueta: "Acopio",
    // Registrar acopio ya no usa EtapaNuevoPage generica -- tiene su propia
    // pagina (pages/etapas/AcopioNuevoPage.jsx) porque los campos dependen
    // del producto heredado del lote (cafe/cacao, ver migracion 030 y
    // routes/acopio.js), algo que el formulario generico dirigido por
    // `campos` no puede expresar (mismo motivo que Produccion/Exportacion
    // ya tienen paginas propias). `campos` ya no existe aca.
    etiquetaAccion: "Registrar acopio",
    // camposCorreccion/camposMostrar son funciones de tipoProducto (no
    // arrays planos como en las demas etapas) porque los campos de Acopio
    // son distintos para cafe y cacao -- EtapaListaPage/EtapaValidarPage
    // las invocan con `r.lote_tipo_producto` de cada registro.
    camposCorreccion(tipoProducto) {
      const comunes = [
        { name: "fecha_recepcion", label: "Fecha de recepción", type: "date" },
      ];
      const secado = [
        { name: "dias_secado", label: "Días de secado", type: "number", step: "1", min: "0" },
        {
          name: "metodo_secado",
          label: "Método de secado",
          type: "select",
          options: [
            { value: "natural_sol", label: "Natural al sol" },
            { value: "mecanico", label: "Mecánico" },
          ],
        },
      ];
      if (tipoProducto === "cacao") {
        return [
          ...comunes,
          { name: "peso_kg", label: "Peso recibido (cacao en baba, kg)", type: "number", step: "0.1", min: "0" },
          { name: "dias_fermentacion", label: "Días de fermentación", type: "number", step: "1", min: "0" },
          ...secado,
          { name: "humedad_pct", label: "Humedad final (%)", type: "number", step: "0.1", min: "0", max: "100" },
          { name: "peso_salida_kg", label: "Peso final entregado (cacao en grano seco, kg)", type: "number", step: "0.1", min: "0" },
        ];
      }
      return [
        ...comunes,
        { name: "peso_kg", label: "Peso recibido (café cereza, kg)", type: "number", step: "0.1", min: "0" },
        { name: "fecha_hora_despulpado", label: "Fecha y hora de despulpado", type: "datetime-local" },
        {
          name: "metodo_fermentacion",
          label: "Método de fermentación",
          type: "select",
          options: [
            { value: "lavado", label: "Con agua (lavado)" },
            { value: "seco", label: "En seco" },
          ],
        },
        { name: "horas_fermentacion", label: "Horas de fermentación", type: "number", step: "0.5", min: "0" },
        { name: "peso_pergamino_humedo_kg", label: "Peso pergamino húmedo (kg)", type: "number", step: "0.1", min: "0" },
        ...secado,
        { name: "peso_salida_kg", label: "Peso final entregado (café pergamino seco, kg)", type: "number", step: "0.1", min: "0" },
      ];
    },
    camposMostrar(tipoProducto) {
      const TRADUCIR_METODO_SECADO = { natural_sol: "Natural al sol", mecanico: "Mecánico" };
      const comunes = [{ key: "fecha_recepcion", label: "Fecha de recepción" }];
      const secado = [
        { key: "dias_secado", label: "Días de secado", sufijo: " días" },
        { key: "metodo_secado", label: "Método de secado", traducir: (v) => TRADUCIR_METODO_SECADO[v] ?? v },
      ];
      if (tipoProducto === "cacao") {
        return [
          ...comunes,
          { key: "peso_kg", label: "Peso recibido (cacao en baba)", sufijo: " kg" },
          { key: "dias_fermentacion", label: "Días de fermentación", sufijo: " días" },
          ...secado,
          { key: "humedad_pct", label: "Humedad final", sufijo: "%" },
          { key: "peso_salida_kg", label: "Peso final (cacao en grano seco)", sufijo: " kg" },
        ];
      }
      const TRADUCIR_FERMENTACION = { lavado: "Con agua (lavado)", seco: "En seco" };
      return [
        ...comunes,
        { key: "peso_kg", label: "Peso recibido (café cereza)", sufijo: " kg" },
        { key: "fecha_hora_despulpado", label: "Despulpado" },
        { key: "metodo_fermentacion", label: "Método de fermentación", traducir: (v) => TRADUCIR_FERMENTACION[v] ?? v },
        { key: "horas_fermentacion", label: "Horas de fermentación", sufijo: " h" },
        { key: "peso_pergamino_humedo_kg", label: "Peso pergamino húmedo", sufijo: " kg" },
        ...secado,
        { key: "peso_salida_kg", label: "Peso final (café pergamino seco)", sufijo: " kg" },
      ];
    },
  },
  procesamiento: {
    etiqueta: "Procesamiento",
    // Registrar procesamiento ya no usa EtapaNuevoPage generica -- tiene su
    // propia pagina (pages/etapas/ProcesamientoNuevoPage.jsx) por el mismo
    // motivo que Acopio: los campos dependen del producto heredado del
    // lote y, ademas, de la ruta (A/B) para los opcionales de valor
    // agregado (ver migracion 031 y routes/procesamiento.js). `campos` ya
    // no existe aca.
    etiquetaAccion: "Registrar procesamiento",
    // camposMostrar/camposCorreccion son funciones de (tipoProducto, ruta)
    // -- mismo patron que Acopio, ver EtapaListaPage.jsx/EtapaValidarPage.jsx
    // -- porque ademas del producto, los opcionales de valor agregado
    // (tueste/molido en cafe, nibs/molienda en cacao) solo aplican en
    // Ruta B.
    camposMostrar(tipoProducto) {
      const TRADUCIR_SI_NO = { 1: "Sí", 0: "No" };
      if (tipoProducto === "cacao") {
        return [
          { key: "peso_entrada_kg", label: "Peso de entrada (cacao en grano seco)", sufijo: " kg" },
          { key: "peso_salida_kg", label: "Peso de salida final", sufijo: " kg" },
          { key: "tueste_temperatura", label: "Temperatura de tueste", sufijo: "°C" },
          { key: "tueste_tiempo", label: "Tiempo de tueste", sufijo: " min" },
          { key: "descascarillado", label: "Descascarillado", traducir: (v) => TRADUCIR_SI_NO[v] ?? v },
          { key: "nibs_peso_kg", label: "Peso de nibs", sufijo: " kg" },
          {
            key: "molienda_tipo",
            label: "Molienda",
            traducir: (v) => ({ licor: "Licor de cacao", manteca: "Manteca de cacao", polvo: "Polvo de cacao" }[v] ?? v),
          },
        ];
      }
      return [
        { key: "peso_entrada_kg", label: "Peso de entrada (café pergamino seco)", sufijo: " kg" },
        { key: "peso_salida_kg", label: "Peso de salida (café verde/oro)", sufijo: " kg" },
        {
          key: "clasificacion_calidad",
          label: "Clasificación de calidad",
          traducir: (v) =>
            ({ excelso: "Café excelso", consumo: "Café consumo", pasilla: "Café pasilla", mezcla_variable: "Mezcla variable" }[v] ?? v),
        },
        { key: "tueste_temperatura", label: "Temperatura de tueste", sufijo: "°C" },
        { key: "tueste_tiempo", label: "Tiempo de tueste", sufijo: " min" },
        { key: "molido", label: "Molido", traducir: (v) => TRADUCIR_SI_NO[v] ?? v },
      ];
    },
    camposCorreccion(tipoProducto, ruta) {
      const comunes = [
        { name: "peso_entrada_kg", label: "Peso de entrada (kg)", type: "number", step: "0.1", min: "0" },
        { name: "peso_salida_kg", label: "Peso de salida (kg)", type: "number", step: "0.1", min: "0" },
      ];
      const tueste = [
        { name: "tueste_temperatura", label: "Temperatura de tueste (°C)", type: "number", step: "1", min: "0" },
        { name: "tueste_tiempo", label: "Tiempo de tueste (min)", type: "number", step: "1", min: "0" },
      ];
      const SI_NO = [
        { value: "1", label: "Sí" },
        { value: "0", label: "No" },
      ];
      if (tipoProducto === "cacao") {
        const campos = [
          ...comunes,
          ...tueste,
          { name: "descascarillado", label: "Descascarillado", type: "select", options: SI_NO },
        ];
        if (ruta === "B") {
          campos.push(
            { name: "nibs_peso_kg", label: "Peso de nibs (kg)", type: "number", step: "0.1", min: "0" },
            {
              name: "molienda_tipo",
              label: "Molienda",
              type: "select",
              options: [
                { value: "licor", label: "Licor de cacao" },
                { value: "manteca", label: "Manteca de cacao" },
                { value: "polvo", label: "Polvo de cacao" },
              ],
            }
          );
        }
        return campos;
      }
      const campos = [
        ...comunes,
        {
          name: "clasificacion_calidad",
          label: "Clasificación de calidad",
          type: "select",
          options: [
            { value: "excelso", label: "Café excelso" },
            { value: "consumo", label: "Café consumo" },
            { value: "pasilla", label: "Café pasilla" },
            { value: "mezcla_variable", label: "Mezcla variable" },
          ],
        },
      ];
      if (ruta === "B") {
        campos.push(...tueste, { name: "molido", label: "Molido", type: "select", options: SI_NO });
      }
      return campos;
    },
  },
  exportacion: {
    etiqueta: "Exportación",
    etiquetaAccion: "Registrar exportación",
    campos: [
      { name: "puerto", label: "Puerto", type: "text" },
      { name: "destino", label: "Destino", type: "text" },
      { name: "contenedor", label: "Contenedor", type: "text" },
    ],
    camposMostrar: [
      { key: "puerto", label: "Puerto" },
      { key: "destino", label: "Destino" },
      { key: "contenedor", label: "Contenedor" },
    ],
  },
};
