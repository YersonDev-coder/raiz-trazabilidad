import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";

const CLASIFICACION_OPCIONES = [
  { value: "excelso", label: "Café excelso" },
  { value: "consumo", label: "Café consumo" },
  { value: "pasilla", label: "Café pasilla" },
  { value: "mezcla_variable", label: "Mezcla variable" },
];
const MOLIENDA_OPCIONES = [
  { value: "licor", label: "Licor de cacao" },
  { value: "manteca", label: "Manteca de cacao" },
  { value: "polvo", label: "Polvo de cacao" },
];

// Pagina dedicada (no la generica EtapaNuevoPage.jsx) porque los campos de
// Procesamiento dependen del producto heredado del lote (cafe/cacao, ver
// migracion 031 y routes/procesamiento.js) y, ademas, de la ruta (A/B) del
// lote para los opcionales de valor agregado -- mismo criterio que
// AcopioNuevoPage.jsx: el producto NO se elige aca, se deriva del lote
// seleccionado.
export function ProcesamientoNuevoPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [lotes, setLotes] = useState([]);
  const [cargandoLotes, setCargandoLotes] = useState(true);
  const [loteId, setLoteId] = useState("");

  const [pesoEntradaKg, setPesoEntradaKg] = useState("");
  const [pesoSalidaKg, setPesoSalidaKg] = useState("");

  // Solo cafe.
  const [clasificacionCalidad, setClasificacionCalidad] = useState(CLASIFICACION_OPCIONES[0].value);
  const [molido, setMolido] = useState(false);

  // Solo cacao (tueste/descascarillado son de cacao siempre; en cafe el
  // tueste solo existe si Ruta B, ver mas abajo).
  const [descascarillado, setDescascarillado] = useState(false);
  const [nibsPesoKg, setNibsPesoKg] = useState("");
  const [moliendaTipo, setMoliendaTipo] = useState(MOLIENDA_OPCIONES[0].value);

  // Tueste: comun a cafe (solo Ruta B) y cacao (siempre).
  const [tuesteTemperatura, setTuesteTemperatura] = useState("");
  const [tuesteTiempo, setTuesteTiempo] = useState("");

  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarLotes(token, "procesamiento")
      .then(({ lotes: disponibles }) => {
        setLotes(disponibles);
        if (disponibles.length > 0) setLoteId(String(disponibles[0].id));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoLotes(false);
      });
    return () => controller.abort();
  }, [token]);

  const loteSeleccionado = lotes.find((l) => String(l.id) === loteId);
  const tipoProducto = loteSeleccionado?.tipo_producto ?? null;
  const ruta = loteSeleccionado?.ruta ?? null;
  // Cafe: tostar/moler solo tiene sentido si el lote sigue hasta valor
  // agregado (Ruta B) -- Ruta A exporta cafe verde sin tostar. Cacao: el
  // tueste es parte del beneficio estandar sin importar la ruta.
  const mostrarTueste = tipoProducto === "cacao" || (tipoProducto === "cafe" && ruta === "B");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const datos = {
        lote_id: Number(loteId),
        peso_entrada_kg: Number(pesoEntradaKg),
        peso_salida_kg: Number(pesoSalidaKg),
      };
      if (tipoProducto === "cafe") {
        datos.clasificacion_calidad = clasificacionCalidad;
        if (ruta === "B") {
          // Tueste/molido son opcionales en cafe (a diferencia de cacao,
          // donde el tueste es siempre obligatorio) -- solo se manda si el
          // usuario efectivamente lo lleno, para no forzar un 0 falso.
          if (tuesteTemperatura !== "") datos.tueste_temperatura = Number(tuesteTemperatura);
          if (tuesteTiempo !== "") datos.tueste_tiempo = Number(tuesteTiempo);
          datos.molido = molido;
        }
      } else if (tipoProducto === "cacao") {
        datos.tueste_temperatura = Number(tuesteTemperatura);
        datos.tueste_tiempo = Number(tuesteTiempo);
        datos.descascarillado = descascarillado;
        if (ruta === "B") {
          datos.nibs_peso_kg = Number(nibsPesoKg);
          datos.molienda_tipo = moliendaTipo;
        }
      }

      await api.crearRegistroEtapa("procesamiento", token, datos);
      navigate("/procesamiento", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PanelLayout>
      <h1 className="panel-titulo">Registrar procesamiento</h1>

      {cargandoLotes ? (
        <p className="texto-tenue-panel">Cargando...</p>
      ) : lotes.length === 0 ? (
        <div className="estado-vacio-panel">
          <p>No hay lotes esperando esta etapa por ahora.</p>
        </div>
      ) : (
        <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Lote</legend>
            <label>
              ¿Sobre qué lote es este registro?
              <select value={loteId} onChange={(e) => setLoteId(e.target.value)} required>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.codigo_unico} ({l.tipo_producto === "cafe" ? "Café" : "Cacao"} · Ruta {l.ruta})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Producto
              <div className="campo-derivado-panel">
                <span className="badge-cultivo">
                  {tipoProducto === "cafe" ? "☕ Café" : "🍫 Cacao"}
                </span>
                <span className="texto-tenue-panel">Definido por el lote elegido arriba.</span>
              </div>
            </label>
          </fieldset>

          <fieldset>
            <legend>Peso</legend>
            <label>
              Peso de entrada ({tipoProducto === "cafe" ? "café pergamino seco" : "cacao en grano seco"}, kg)
              <input
                type="number"
                step="0.1"
                min="0"
                value={pesoEntradaKg}
                onChange={(e) => setPesoEntradaKg(e.target.value)}
                required
              />
            </label>
          </fieldset>

          {tipoProducto === "cafe" && (
            <fieldset>
              <legend>Clasificación</legend>
              <label>
                Clasificación de calidad
                <select
                  value={clasificacionCalidad}
                  onChange={(e) => setClasificacionCalidad(e.target.value)}
                  required
                >
                  {CLASIFICACION_OPCIONES.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <span className="texto-tenue-panel">Informativa: no fragmenta el lote.</span>
              </label>
            </fieldset>
          )}

          {tipoProducto === "cacao" && (
            <fieldset>
              <legend>Descascarillado</legend>
              <label className="opcion-checkbox-panel">
                <input
                  type="checkbox"
                  checked={descascarillado}
                  onChange={(e) => setDescascarillado(e.target.checked)}
                />
                Descascarillado (winnowing) realizado
              </label>
            </fieldset>
          )}

          {mostrarTueste && (
            <fieldset>
              <legend>Tueste{tipoProducto === "cafe" ? " (Ruta B, opcional)" : ""}</legend>
              <label>
                Temperatura de tueste (°C)
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={tuesteTemperatura}
                  onChange={(e) => setTuesteTemperatura(e.target.value)}
                  required={tipoProducto === "cacao"}
                />
              </label>
              <label>
                Tiempo de tueste (minutos)
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={tuesteTiempo}
                  onChange={(e) => setTuesteTiempo(e.target.value)}
                  required={tipoProducto === "cacao"}
                />
              </label>
              {tipoProducto === "cafe" && (
                <label className="opcion-checkbox-panel">
                  <input type="checkbox" checked={molido} onChange={(e) => setMolido(e.target.checked)} />
                  Molido
                </label>
              )}
            </fieldset>
          )}

          {tipoProducto === "cacao" && ruta === "B" && (
            <fieldset>
              <legend>Nibs y molienda (Ruta B)</legend>
              <label>
                Nibs de cacao — peso resultante (kg)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={nibsPesoKg}
                  onChange={(e) => setNibsPesoKg(e.target.value)}
                  required
                />
              </label>
              <label>
                Molienda
                <select value={moliendaTipo} onChange={(e) => setMoliendaTipo(e.target.value)} required>
                  {MOLIENDA_OPCIONES.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}

          <fieldset>
            <legend>Salida</legend>
            <label>
              Peso de salida (
              {tipoProducto === "cafe" ? "café verde/oro" : "peso final de cacao"}, kg)
              <input
                type="number"
                step="0.1"
                min="0"
                value={pesoSalidaKg}
                onChange={(e) => setPesoSalidaKg(e.target.value)}
                required
              />
            </label>
          </fieldset>

          {error && <p className="mensaje-error">{error}</p>}

          <button type="submit" className="boton-panel" disabled={enviando}>
            {enviando ? "Guardando..." : "Registrar procesamiento"}
          </button>
        </form>
      )}
    </PanelLayout>
  );
}
