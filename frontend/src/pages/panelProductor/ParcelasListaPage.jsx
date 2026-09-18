import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelProductorLayout } from "../../components/panelProductor/PanelProductorLayout.jsx";

const ETIQUETA_CULTIVO = { cafe: "Café", cacao: "Cacao", ambos: "Café y cacao" };

export function ParcelasListaPage() {
  const { token } = useAuth();
  const [parcelas, setParcelas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // AbortController: evita que una invocacion duplicada del efecto
    // (React StrictMode en dev) deje una respuesta obsoleta pisando el
    // estado despues de que la mas reciente ya actualizo.
    const controller = new AbortController();
    api
      .listarParcelasMias(token, controller.signal)
      .then(({ parcelas: propias }) => setParcelas(propias))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [token]);

  return (
    <PanelProductorLayout>
      <div className="encabezado-panel">
        <h1 className="panel-titulo">Mis parcelas</h1>
        <Link to="/panel/parcelas/nueva" className="boton-enlace-panel">
          + Registrar nueva parcela
        </Link>
      </div>

      {cargando && <p className="texto-tenue-panel">Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}

      {!cargando && parcelas.length === 0 && (
        <div className="estado-vacio-panel">
          <p>Todavía no tienes parcelas registradas.</p>
        </div>
      )}

      <div className="grid-parcelas">
        {parcelas.map((p) => (
          <Link key={p.id} to={`/panel/parcelas/${p.id}`} className="tarjeta-parcela">
            <div className="tarjeta-parcela__foto">
              {p.fotos.length > 0 ? (
                <img src={`${API_BASE_URL}${p.fotos[0].url}`} alt="" />
              ) : (
                <span>🌿</span>
              )}
            </div>
            <div className="tarjeta-parcela__cuerpo">
              <strong>{p.nombre_parcela}</strong>
              <span className="texto-tenue-panel">{p.zona ?? "Zona sin especificar"}</span>
              {p.tipo_cultivo && (
                <span className="badge-cultivo">{ETIQUETA_CULTIVO[p.tipo_cultivo] ?? p.tipo_cultivo}</span>
              )}
              <span className="texto-tenue-panel">
                {p.fotos.length} foto{p.fotos.length === 1 ? "" : "s"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </PanelProductorLayout>
  );
}
