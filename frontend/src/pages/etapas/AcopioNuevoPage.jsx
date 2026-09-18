import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelLayout } from "../../components/panelInterno/PanelLayout.jsx";

const RUTA_OPCIONES = [
  { value: "A", label: "A — Materia prima (grano/almendra sin transformar)" },
  { value: "B", label: "B — Valor agregado (tostado/chocolate terminado)" },
];
const METODO_FERMENTACION_OPCIONES = [
  { value: "lavado", label: "Con agua (lavado)" },
  { value: "seco", label: "En seco" },
];
const METODO_SECADO_OPCIONES = [
  { value: "natural_sol", label: "Natural al sol" },
  { value: "mecanico", label: "Mecánico" },
];

// Pagina dedicada (no la generica EtapaNuevoPage.jsx) porque los campos de
// Acopio dependen del producto heredado del lote (cafe/cacao, ver migracion
// 030 y routes/acopio.js) -- el producto NO se elige aca, se deriva del
// lote seleccionado, mismo criterio que ProduccionNuevoPage.jsx deriva
// tipo_producto/variedad del cultivo de la parcela.
export function AcopioNuevoPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [lotes, setLotes] = useState([]);
  const [cargandoLotes, setCargandoLotes] = useState(true);
  const [loteId, setLoteId] = useState("");

  const [ruta, setRuta] = useState("A");
  const [fechaRecepcion, setFechaRecepcion] = useState("");

  // Comunes a ambos productos (peso de entrada + secado/salida).
  const [pesoKg, setPesoKg] = useState("");
  const [diasSecado, setDiasSecado] = useState("");
  const [metodoSecado, setMetodoSecado] = useState(METODO_SECADO_OPCIONES[0].value);
  const [pesoSalidaKg, setPesoSalidaKg] = useState("");

  // Solo cafe.
  const [fechaHoraDespulpado, setFechaHoraDespulpado] = useState("");
  const [metodoFermentacion, setMetodoFermentacion] = useState(METODO_FERMENTACION_OPCIONES[0].value);
  const [horasFermentacion, setHorasFermentacion] = useState("");
  const [pesoPergaminoHumedoKg, setPesoPergaminoHumedoKg] = useState("");

  // Solo cacao.
  const [diasFermentacion, setDiasFermentacion] = useState("");
  const [humedadPct, setHumedadPct] = useState("");

  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarLotes(token, "acopio")
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
  // La ruta ya puede estar fijada por un registro de acopio anterior sobre
  // este mismo lote (ver antesDeCrear en routes/acopio.js: es inmutable una
  // vez definida) -- si es asi, se muestra como dato fijo en vez de select.
  const rutaYaFijada = loteSeleccionado?.ruta ?? null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const datos = {
        lote_id: Number(loteId),
        ruta: rutaYaFijada ?? ruta,
        fecha_recepcion: fechaRecepcion,
        peso_kg: Number(pesoKg),
        dias_secado: Number(diasSecado),
        metodo_secado: metodoSecado,
        peso_salida_kg: Number(pesoSalidaKg),
      };
      if (tipoProducto === "cafe") {
        datos.fecha_hora_despulpado = fechaHoraDespulpado;
        datos.metodo_fermentacion = metodoFermentacion;
        datos.horas_fermentacion = Number(horasFermentacion);
        datos.peso_pergamino_humedo_kg = Number(pesoPergaminoHumedoKg);
      } else if (tipoProducto === "cacao") {
        datos.dias_fermentacion = Number(diasFermentacion);
        datos.humedad_pct = Number(humedadPct);
      }

      await api.crearRegistroEtapa("acopio", token, datos);
      navigate("/acopio", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PanelLayout>
      <h1 className="panel-titulo">Registrar acopio</h1>

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
                    {l.codigo_unico} ({l.tipo_producto === "cafe" ? "Café" : "Cacao"})
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

            <label>
              Ruta de exportación
              {rutaYaFijada ? (
                <div className="campo-derivado-panel">
                  <span className="badge-cultivo">
                    {rutaYaFijada === "A" ? "A — Materia prima" : "B — Valor agregado"}
                  </span>
                  <span className="texto-tenue-panel">
                    Ya fue definida para este lote y no se puede cambiar.
                  </span>
                </div>
              ) : (
                <select value={ruta} onChange={(e) => setRuta(e.target.value)} required>
                  {RUTA_OPCIONES.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label>
              Fecha de recepción
              <input
                type="date"
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
                required
              />
            </label>
          </fieldset>

          {tipoProducto === "cafe" && (
            <fieldset>
              <legend>Recepción y despulpado</legend>
              <label>
                Peso recibido (café cereza, kg)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={pesoKg}
                  onChange={(e) => setPesoKg(e.target.value)}
                  required
                />
              </label>
              <label>
                Fecha/hora de despulpado
                <input
                  type="datetime-local"
                  value={fechaHoraDespulpado}
                  onChange={(e) => setFechaHoraDespulpado(e.target.value)}
                  required
                />
              </label>
            </fieldset>
          )}

          {tipoProducto === "cafe" && (
            <fieldset>
              <legend>Fermentación y lavado</legend>
              <label>
                Método de fermentación
                <select
                  value={metodoFermentacion}
                  onChange={(e) => setMetodoFermentacion(e.target.value)}
                  required
                >
                  {METODO_FERMENTACION_OPCIONES.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Horas de fermentación
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="ej. 18"
                  value={horasFermentacion}
                  onChange={(e) => setHorasFermentacion(e.target.value)}
                  required
                />
                <span className="texto-tenue-panel">Típico 14–24 h.</span>
              </label>
              <label>
                Peso resultante tras lavado (café pergamino húmedo, kg)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={pesoPergaminoHumedoKg}
                  onChange={(e) => setPesoPergaminoHumedoKg(e.target.value)}
                  required
                />
              </label>
            </fieldset>
          )}

          {tipoProducto === "cacao" && (
            <fieldset>
              <legend>Recepción y fermentación</legend>
              <label>
                Peso recibido (cacao en baba, kg)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={pesoKg}
                  onChange={(e) => setPesoKg(e.target.value)}
                  required
                />
              </label>
              <label>
                Días de fermentación
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={diasFermentacion}
                  onChange={(e) => setDiasFermentacion(e.target.value)}
                  required
                />
              </label>
            </fieldset>
          )}

          {tipoProducto && (
            <fieldset>
              <legend>Secado</legend>
              <label>
                Días de secado
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={diasSecado}
                  onChange={(e) => setDiasSecado(e.target.value)}
                  required
                />
              </label>
              <label>
                Método de secado
                <select value={metodoSecado} onChange={(e) => setMetodoSecado(e.target.value)} required>
                  {METODO_SECADO_OPCIONES.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </label>
              {tipoProducto === "cacao" && (
                <label>
                  % Humedad final
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="máx. sugerido 8%"
                    value={humedadPct}
                    onChange={(e) => setHumedadPct(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                Peso final entregado (
                {tipoProducto === "cafe" ? "café pergamino seco" : "cacao en grano seco"}, kg)
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
          )}

          {error && <p className="mensaje-error">{error}</p>}

          <button type="submit" className="boton-panel" disabled={enviando}>
            {enviando ? "Guardando..." : "Registrar acopio"}
          </button>
        </form>
      )}
    </PanelLayout>
  );
}
