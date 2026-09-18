import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelProductorLayout } from "../../components/panelProductor/PanelProductorLayout.jsx";
import {
  VARIEDADES_POR_PRODUCTO,
  VARIEDAD_OTRA,
  ESTADOS_GRANO_POR_PRODUCTO,
  ETIQUETAS_TIPO_COSECHA,
} from "../../constants/catalogos.js";

const MAX_FOTOS = 4;

export function ProduccionNuevoPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [parcelas, setParcelas] = useState([]);
  const [cargandoParcelas, setCargandoParcelas] = useState(true);
  const [parcelaId, setParcelaId] = useState("");

  // tipoProducto solo es editable a mano cuando la parcela elegida no
  // define un cultivo unico (tipo_cultivo NULL o 'ambos') -- ver
  // tipoDerivado mas abajo. Arranca en "cafe" como valor por defecto
  // razonable mientras las parcelas todavia no cargan.
  const [tipoProducto, setTipoProducto] = useState("cafe");
  const [variedad, setVariedad] = useState(VARIEDADES_POR_PRODUCTO.cafe[0]);
  const [variedadOtroTexto, setVariedadOtroTexto] = useState("");
  const [estadoGrano, setEstadoGrano] = useState(ESTADOS_GRANO_POR_PRODUCTO.cafe[0].valor);
  const [tipoCosecha, setTipoCosecha] = useState("selectiva");
  const [fechaCosecha, setFechaCosecha] = useState("");
  const [volumenKg, setVolumenKg] = useState("");

  const [fotos, setFotos] = useState([]);

  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Libera los object URLs de preview al desmontar o al reemplazar la
    // seleccion, para no filtrar memoria mientras el usuario prueba fotos.
    return () => fotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
  }, [fotos]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarParcelasMias(token, controller.signal)
      .then(({ parcelas: propias }) => {
        setParcelas(propias);
        if (propias.length > 0) setParcelaId(String(propias[0].id));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoParcelas(false);
      });
    return () => controller.abort();
  }, [token]);

  const parcelaSeleccionada = parcelas.find((p) => String(p.id) === parcelaId);
  // Solo se puede derivar un producto unico si la parcela tiene un
  // tipo_cultivo definido y no ambiguo -- 'ambos' o NULL (parcela vieja,
  // de antes de que este campo existiera) no alcanzan para decidir por el
  // productor, ahi se le sigue pidiendo que elija a mano.
  const tipoDerivado =
    parcelaSeleccionada?.tipo_cultivo && parcelaSeleccionada.tipo_cultivo !== "ambos"
      ? parcelaSeleccionada.tipo_cultivo
      : null;

  // Cada vez que cambia la parcela elegida (incluida la seleccion inicial
  // automatica de arriba), si esa parcela ya define un cultivo unico, el
  // producto y la variedad se recalculan para coincidir -- pisando
  // cualquier eleccion manual anterior, a proposito: ya no es un dato
  // independiente que el usuario controle, es una consecuencia de la
  // parcela (ver Correccion de logica: cosecha hereda el cultivo de la
  // parcela).
  useEffect(() => {
    if (tipoDerivado) {
      setTipoProducto(tipoDerivado);
      setVariedad(VARIEDADES_POR_PRODUCTO[tipoDerivado][0]);
      setVariedadOtroTexto("");
    }
  }, [tipoDerivado]);

  // estado_grano depende del producto (opciones distintas para cafe/cacao,
  // ver ESTADOS_GRANO_POR_PRODUCTO) -- se resetea al default de ese
  // producto cada vez que tipoProducto cambia, sin importar si cambio por
  // herencia automatica de la parcela o por eleccion manual (parcela
  // ambigua, ver handleTipoProducto), para no dejar seleccionado un estado
  // que ya no aplica al cultivo actual.
  useEffect(() => {
    setEstadoGrano(ESTADOS_GRANO_POR_PRODUCTO[tipoProducto][0].valor);
  }, [tipoProducto]);

  function handleTipoProducto(nuevoTipo) {
    setTipoProducto(nuevoTipo);
    setVariedad(VARIEDADES_POR_PRODUCTO[nuevoTipo][0]);
    setVariedadOtroTexto("");
  }

  function handleVariedad(nuevaVariedad) {
    setVariedad(nuevaVariedad);
    if (nuevaVariedad !== VARIEDAD_OTRA) setVariedadOtroTexto("");
  }

  function handleAgregarFotos(e) {
    const elegidos = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite volver a elegir el mismo archivo si lo quita y lo re-agrega
    if (elegidos.length === 0) return;

    setFotos((actuales) => {
      const espacio = MAX_FOTOS - actuales.length;
      if (espacio <= 0) return actuales;
      const nuevas = elegidos.slice(0, espacio).map((archivo) => ({
        archivo,
        previewUrl: URL.createObjectURL(archivo),
      }));
      return [...actuales, ...nuevas];
    });
  }

  function handleQuitarFoto(index) {
    setFotos((actuales) => actuales.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (fotos.length === 0) {
      setError("Debes agregar al menos 1 foto de evidencia de la cosecha.");
      return;
    }

    if (variedad === VARIEDAD_OTRA && variedadOtroTexto.trim() === "") {
      setError("Especifica la variedad en el campo de texto.");
      return;
    }

    setEnviando(true);
    try {
      const { lote } = await api.crearLote(token, { tipo_producto: tipoProducto });

      const { registro } = await api.crearRegistroProduccion(token, {
        lote_id: lote.id,
        parcela_id: Number(parcelaId),
        variedad: variedad === VARIEDAD_OTRA ? variedadOtroTexto.trim() : variedad,
        fecha_cosecha: fechaCosecha,
        volumen_kg: Number(volumenKg),
        estado_grano: estadoGrano,
        tipo_cosecha: tipoCosecha,
      });

      const formData = new FormData();
      fotos.forEach((f) => formData.append("fotos", f.archivo));
      await api.subirFotosProduccion(token, registro.id, formData);

      navigate("/produccion", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PanelProductorLayout>
      <h1 className="panel-titulo">Registrar cosecha</h1>

      {cargandoParcelas ? (
        <p className="texto-tenue-panel">Cargando...</p>
      ) : parcelas.length === 0 ? (
        <div className="estado-vacio-panel">
          <p>Todavía no tienes parcelas registradas.</p>
          <Link to="/panel/parcelas/nueva" className="boton-enlace-panel">
            Registrar mi primera parcela
          </Link>
        </div>
      ) : (
        <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Parcela</legend>
            <label>
              ¿De qué parcela es esta cosecha?
              <select value={parcelaId} onChange={(e) => setParcelaId(e.target.value)} required>
                {parcelas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_parcela}
                    {p.zona ? ` — ${p.zona}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset>
            <legend>Cosecha</legend>

            <label>
              Producto
              {tipoDerivado ? (
                <div className="campo-derivado-panel">
                  <span className="badge-cultivo">
                    {tipoDerivado === "cafe" ? "☕ Café" : "🍫 Cacao"}
                  </span>
                  <span className="texto-tenue-panel">
                    Definido por el cultivo de la parcela elegida arriba.
                  </span>
                </div>
              ) : (
                <>
                  <select value={tipoProducto} onChange={(e) => handleTipoProducto(e.target.value)}>
                    <option value="cafe">Café</option>
                    <option value="cacao">Cacao</option>
                  </select>
                  <span className="texto-tenue-panel">
                    Esta parcela no tiene un cultivo único definido; elige el producto de esta
                    cosecha.
                  </span>
                </>
              )}
            </label>

            <label>
              Variedad
              <select value={variedad} onChange={(e) => handleVariedad(e.target.value)} required>
                {VARIEDADES_POR_PRODUCTO[tipoProducto].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            {variedad === VARIEDAD_OTRA && (
              <label>
                Especifica la variedad
                <input
                  type="text"
                  value={variedadOtroTexto}
                  onChange={(e) => setVariedadOtroTexto(e.target.value)}
                  placeholder="Ej. Geisha"
                  required
                />
              </label>
            )}

            <label>
              Estado del grano
              <select value={estadoGrano} onChange={(e) => setEstadoGrano(e.target.value)} required>
                {ESTADOS_GRANO_POR_PRODUCTO[tipoProducto].map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo de cosecha
              <select value={tipoCosecha} onChange={(e) => setTipoCosecha(e.target.value)} required>
                {Object.entries(ETIQUETAS_TIPO_COSECHA).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha de cosecha
              <input
                type="date"
                value={fechaCosecha}
                onChange={(e) => setFechaCosecha(e.target.value)}
                required
              />
            </label>

            <label>
              Volumen (kg)
              <input
                type="number"
                min="0"
                step="0.1"
                value={volumenKg}
                onChange={(e) => setVolumenKg(e.target.value)}
                required
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Evidencia fotográfica</legend>
            <p className="texto-tenue-panel">
              Al menos 1 foto de la cosecha (hasta {MAX_FOTOS}). El comprador final podrá verla en la
              trazabilidad pública de este lote.
            </p>

            {fotos.length > 0 && (
              <div className="galeria-fotos__grid">
                {fotos.map((f, i) => (
                  <div key={f.previewUrl} className="foto-preview-panel">
                    <img src={f.previewUrl} alt={`Foto de evidencia ${i + 1}`} />
                    <button
                      type="button"
                      className="foto-preview-panel__quitar"
                      onClick={() => handleQuitarFoto(i)}
                      aria-label="Quitar esta foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {fotos.length < MAX_FOTOS && (
              <label className="boton-subir-foto">
                + Agregar foto
                <input type="file" accept="image/*" multiple onChange={handleAgregarFotos} hidden />
              </label>
            )}
          </fieldset>

          {error && <p className="mensaje-error">{error}</p>}

          <button type="submit" className="boton-panel" disabled={enviando || fotos.length === 0}>
            {enviando ? "Guardando..." : "Registrar cosecha"}
          </button>
        </form>
      )}
    </PanelProductorLayout>
  );
}
