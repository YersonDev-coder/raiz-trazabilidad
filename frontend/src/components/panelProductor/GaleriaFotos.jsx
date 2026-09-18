import { useState } from "react";
import { api, API_BASE_URL } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.jsx";

export function GaleriaFotos({ parcelaId, fotos, onFotoSubida }) {
  const { token } = useAuth();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  async function handleArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("foto", archivo);
      const { foto } = await api.subirFotoParcela(token, parcelaId, formData);
      onFotoSubida(foto);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  return (
    <div className="galeria-fotos">
      {fotos.length === 0 ? (
        <p className="texto-tenue-panel">Todavía no hay fotos en esta parcela.</p>
      ) : (
        <div className="galeria-fotos__grid">
          {fotos.map((f) => (
            <img key={f.id} src={`${API_BASE_URL}${f.url}`} alt="Foto de la parcela" />
          ))}
        </div>
      )}

      <label className="boton-subir-foto">
        {subiendo ? "Subiendo..." : "+ Agregar foto"}
        <input type="file" accept="image/*" onChange={handleArchivo} disabled={subiendo} hidden />
      </label>

      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}
