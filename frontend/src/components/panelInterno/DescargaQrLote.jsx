import { useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { descargarFichaPdf } from "../../lib/fichaPdf.js";

// Badge "QR emitido" + boton "Descargar PDF", reutilizado en cada panel
// interno donde se lista o muestra el detalle de un lote (Productor,
// Cooperativa, Planta, Exportador, Administrador) -- mismo componente en
// los 5 roles a proposito, para que tamaño/texto/ubicacion sean
// consistentes en toda la plataforma en vez de una version distinta por
// rol. El PDF se arma con lib/fichaPdf.js (misma logica que ya usa la
// ficha publica) a partir de GET /api/lotes/:id/ficha (ver
// backend/src/lib/fichaLote.js) -- funciona en cualquier etapa del lote,
// no solo cuando ya es publico.
//
// Si el lote no tiene QR emitido todavia (caso raro: solo lotes de antes
// de que el QR se emitiera al crear el lote, ver lib/codigosQr.js), no
// renderiza nada -- mismo patron de "omitir limpiamente" que ya usa la
// ficha publica para secciones sin datos.
export function DescargaQrLote({ loteId, tieneQr }) {
  const { token } = useAuth();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  if (!tieneQr) return null;

  async function handleDescargar() {
    setError(null);
    setGenerando(true);
    try {
      const datos = await api.obtenerFichaLote(token, loteId);
      await descargarFichaPdf(datos);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="descarga-qr-panel">
      <span className="badge-exportado">📱 QR emitido</span>
      <button
        type="button"
        className="boton-panel boton-panel--secundario"
        onClick={handleDescargar}
        disabled={generando}
      >
        {generando ? "Generando..." : "Descargar PDF"}
      </button>
      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}
