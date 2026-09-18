import { useState } from "react";

// Formulario inline minimo para corregir y reenviar un registro rechazado
// (PUT /api/registros/<etapa>/:id, que ya limpia el rechazo al guardar --
// ver backend/src/lib/etapaRouter.js). Reusa la misma lista de `campos`
// que ya define CONFIG_ETAPA para el formulario de creacion de cada etapa
// (constants/etapas.js), para no mantener dos definiciones de los mismos
// campos. Solo se muestra cuando un registro tiene rechazado_en (ver
// EtapaListaPage.jsx / ProduccionListaPage.jsx), nunca para un borrador
// recien creado -- ese flujo de creacion ya tiene su propia pagina.
export function FormularioCorreccion({ registro, campos, onGuardar, onCancelar }) {
  const [valores, setValores] = useState(() =>
    Object.fromEntries(campos.map((c) => [c.name, registro[c.name] ?? ""]))
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function handleCampo(name, valor) {
    setValores((actuales) => ({ ...actuales, [name]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const datos = {};
      for (const c of campos) {
        datos[c.name] = c.type === "number" ? Number(valores[c.name]) : valores[c.name];
      }
      await onGuardar(datos);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="formulario-panel formulario-rechazo" onSubmit={handleSubmit}>
      {campos.map((c) => (
        <label key={c.name}>
          {c.label}
          {c.type === "select" ? (
            <select value={valores[c.name]} onChange={(e) => handleCampo(c.name, e.target.value)} required>
              {c.options.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={c.type}
              step={c.step}
              min={c.min}
              max={c.max}
              value={valores[c.name]}
              onChange={(e) => handleCampo(c.name, e.target.value)}
              required
            />
          )}
        </label>
      ))}
      {error && <p className="mensaje-error">{error}</p>}
      <div className="formulario-rechazo__acciones">
        <button type="submit" className="boton-panel" disabled={guardando}>
          {guardando ? "Guardando..." : "Corregir y reenviar"}
        </button>
        {onCancelar && (
          <button
            type="button"
            className="boton-panel boton-panel--secundario"
            onClick={onCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
