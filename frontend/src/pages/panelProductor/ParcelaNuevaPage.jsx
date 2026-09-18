import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { PanelProductorLayout } from "../../components/panelProductor/PanelProductorLayout.jsx";
import { GaleriaFotos } from "../../components/panelProductor/GaleriaFotos.jsx";
import { ZONAS, ETIQUETAS_SISTEMA_CULTIVO } from "../../constants/catalogos.js";

const OPCIONES_CULTIVO = [
  { valor: "cafe", etiqueta: "Café" },
  { valor: "cacao", etiqueta: "Cacao" },
  { valor: "ambos", etiqueta: "Café y cacao" },
];

export function ParcelaNuevaPage() {
  const { token } = useAuth();

  const [nombreParcela, setNombreParcela] = useState("");
  const [zona, setZona] = useState(ZONAS[0]);
  const [tipoCultivo, setTipoCultivo] = useState("cafe");
  const [extensionValor, setExtensionValor] = useState("");
  const [extensionUnidad, setExtensionUnidad] = useState("ha");
  const [ubicacion, setUbicacion] = useState(null);
  const [errorUbicacion, setErrorUbicacion] = useState(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [altitud, setAltitud] = useState("");
  const [altitudAutomatica, setAltitudAutomatica] = useState(false);
  const [anioEstablecimiento, setAnioEstablecimiento] = useState("");
  const [sistemaCultivo, setSistemaCultivo] = useState("");

  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [parcelaCreada, setParcelaCreada] = useState(null);

  function capturarUbicacion() {
    setErrorUbicacion(null);
    if (!navigator.geolocation) {
      setErrorUbicacion("Este navegador no soporta geolocalización");
      return;
    }
    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicacion({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
        // El navegador solo entrega altitude cuando el dispositivo la mide
        // de verdad (GPS con hardware de altimetro/barometro); en desktop o
        // con geolocalizacion por IP/wifi casi siempre viene null -- en ese
        // caso se deja el campo manual editable en vez de mostrar un dato
        // poco confiable como si fuera automatico.
        if (posicion.coords.altitude != null) {
          setAltitud(String(Math.round(posicion.coords.altitude)));
          setAltitudAutomatica(true);
        } else {
          setAltitudAutomatica(false);
        }
        setBuscandoUbicacion(false);
      },
      (err) => {
        setErrorUbicacion(err.message);
        setBuscandoUbicacion(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!ubicacion) {
      setError("Captura la ubicación GPS de la parcela antes de continuar");
      return;
    }

    setGuardando(true);
    try {
      const { parcela } = await api.crearParcela(token, {
        nombre_parcela: nombreParcela,
        zona,
        tipo_cultivo: tipoCultivo,
        ubicacion_lat: ubicacion.lat,
        ubicacion_lng: ubicacion.lng,
        extension_valor: extensionValor === "" ? null : Number(extensionValor),
        extension_unidad: extensionUnidad,
        altitud_msnm: altitud === "" ? null : Number(altitud),
        anio_establecimiento: anioEstablecimiento === "" ? null : Number(anioEstablecimiento),
        sistema_cultivo: sistemaCultivo === "" ? null : sistemaCultivo,
      });
      setParcelaCreada(parcela);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (parcelaCreada) {
    return (
      <PanelProductorLayout>
        <h1 className="panel-titulo">Parcela registrada</h1>
        <p className="texto-exito-panel">"{parcelaCreada.nombre_parcela}" se guardó correctamente ✓</p>

        <div className="tarjeta-panel">
          <h2 className="tarjeta-panel__titulo">Fotos de la parcela (opcional)</h2>
          <GaleriaFotos
            parcelaId={parcelaCreada.id}
            fotos={parcelaCreada.fotos ?? []}
            onFotoSubida={(foto) =>
              setParcelaCreada((actual) => ({ ...actual, fotos: [...actual.fotos, foto] }))
            }
          />
        </div>

        <Link to="/panel/parcelas" className="boton-enlace-panel">
          Ir a mis parcelas
        </Link>
      </PanelProductorLayout>
    );
  }

  return (
    <PanelProductorLayout>
      <h1 className="panel-titulo">Registrar nueva parcela</h1>
      <p className="subtitulo-panel">
        Regístrala una sola vez; luego podrás elegirla directamente al registrar cada cosecha.
      </p>

      <form className="tarjeta-panel formulario-panel" onSubmit={handleSubmit}>
        <label>
          Nombre de la parcela
          <input
            type="text"
            value={nombreParcela}
            onChange={(e) => setNombreParcela(e.target.value)}
            required
          />
        </label>

        <label>
          Zona
          <select value={zona} onChange={(e) => setZona(e.target.value)} required>
            {ZONAS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de cultivo
          <select value={tipoCultivo} onChange={(e) => setTipoCultivo(e.target.value)} required>
            {OPCIONES_CULTIVO.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label>
          Extensión de la parcela (opcional)
          <div className="campo-extension-panel">
            <input
              type="number"
              min="0"
              step="0.01"
              value={extensionValor}
              onChange={(e) => setExtensionValor(e.target.value)}
              placeholder="Ej. 2.5"
            />
            <select value={extensionUnidad} onChange={(e) => setExtensionUnidad(e.target.value)}>
              <option value="ha">Hectáreas</option>
              <option value="m2">m²</option>
            </select>
          </div>
        </label>

        <div className="campo-ubicacion-panel">
          <button type="button" onClick={capturarUbicacion} disabled={buscandoUbicacion}>
            {buscandoUbicacion ? "Obteniendo ubicación..." : "Usar mi ubicación GPS actual"}
          </button>
          {ubicacion && (
            <p className="texto-tenue-panel">
              Lat {ubicacion.lat.toFixed(5)}, Lng {ubicacion.lng.toFixed(5)}
            </p>
          )}
          {errorUbicacion && <p className="mensaje-error">{errorUbicacion}</p>}
        </div>

        <label>
          Altitud (msnm, opcional)
          {altitudAutomatica ? (
            <div className="campo-derivado-panel">
              <span className="badge-cultivo">📍 {altitud} msnm</span>
              <span className="texto-tenue-panel">Detectada automáticamente por el GPS.</span>
            </div>
          ) : (
            <input
              type="number"
              min="0"
              value={altitud}
              onChange={(e) => setAltitud(e.target.value)}
              placeholder="ej. 1450"
            />
          )}
        </label>

        <label>
          Año de establecimiento de la parcela (opcional)
          <input
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            value={anioEstablecimiento}
            onChange={(e) => setAnioEstablecimiento(e.target.value)}
            placeholder="Ej. 2005"
          />
        </label>

        <label>
          Sistema de cultivo (opcional)
          <select value={sistemaCultivo} onChange={(e) => setSistemaCultivo(e.target.value)}>
            <option value="">Sin especificar</option>
            {Object.entries(ETIQUETAS_SISTEMA_CULTIVO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" className="boton-panel" disabled={guardando}>
          {guardando ? "Guardando..." : "Registrar parcela"}
        </button>
      </form>
    </PanelProductorLayout>
  );
}
