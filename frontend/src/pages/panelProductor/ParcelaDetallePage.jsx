import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelProductorLayout } from "../../components/panelProductor/PanelProductorLayout.jsx";
import { GaleriaFotos } from "../../components/panelProductor/GaleriaFotos.jsx";

const ETIQUETA_CULTIVO = { cafe: "Café", cacao: "Cacao", ambos: "Café y cacao" };
const ETIQUETA_UNIDAD = { ha: "ha", m2: "m²" };

export function ParcelaDetallePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [parcela, setParcela] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listarParcelasMias(token, controller.signal)
      .then(({ parcelas }) => {
        const encontrada = parcelas.find((p) => String(p.id) === id);
        if (!encontrada) throw new Error("Parcela no encontrada");
        setParcela(encontrada);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [token, id]);

  if (cargando) {
    return (
      <PanelProductorLayout>
        <p className="texto-tenue-panel">Cargando...</p>
      </PanelProductorLayout>
    );
  }

  if (error) {
    return (
      <PanelProductorLayout>
        <p className="mensaje-error">{error}</p>
        <Link to="/panel/parcelas" className="boton-enlace-panel">
          Volver a mis parcelas
        </Link>
      </PanelProductorLayout>
    );
  }

  const tieneCoordenadas = parcela.ubicacion_lat != null && parcela.ubicacion_lng != null;

  return (
    <PanelProductorLayout>
      <div className="encabezado-panel">
        <h1 className="panel-titulo">{parcela.nombre_parcela}</h1>
        <Link to="/panel/parcelas" className="boton-enlace-panel">
          ← Mis parcelas
        </Link>
      </div>

      <div className="tarjeta-panel">
        <h2 className="tarjeta-panel__titulo">Datos de la parcela</h2>
        <p>
          <strong>Zona:</strong> {parcela.zona ?? "Sin especificar"}
        </p>
        <p>
          <strong>Tipo de cultivo:</strong>{" "}
          {parcela.tipo_cultivo ? ETIQUETA_CULTIVO[parcela.tipo_cultivo] ?? parcela.tipo_cultivo : "Sin especificar"}
        </p>
        {parcela.extension_valor != null && (
          <p>
            <strong>Extensión:</strong> {parcela.extension_valor} {ETIQUETA_UNIDAD[parcela.extension_unidad] ?? parcela.extension_unidad}
          </p>
        )}
      </div>

      {tieneCoordenadas && (
        <div className="tarjeta-panel">
          <h2 className="tarjeta-panel__titulo">Ubicación</h2>
          <div className="mini-mapa-panel">
            <iframe
              title="Mapa de la parcela"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                parcela.ubicacion_lng - 0.01
              }%2C${parcela.ubicacion_lat - 0.01}%2C${parcela.ubicacion_lng + 0.01}%2C${
                parcela.ubicacion_lat + 0.01
              }&marker=${parcela.ubicacion_lat}%2C${parcela.ubicacion_lng}`}
            />
          </div>
          <p className="texto-tenue-panel">
            Lat {parcela.ubicacion_lat.toFixed(5)}, Lng {parcela.ubicacion_lng.toFixed(5)}
          </p>
        </div>
      )}

      <div className="tarjeta-panel">
        <h2 className="tarjeta-panel__titulo">Fotos</h2>
        <GaleriaFotos
          parcelaId={parcela.id}
          fotos={parcela.fotos}
          onFotoSubida={(foto) =>
            setParcela((actual) => ({ ...actual, fotos: [...actual.fotos, foto] }))
          }
        />
      </div>
    </PanelProductorLayout>
  );
}
