import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_BASE_URL } from "../../api.js";
import { ETIQUETAS_ROL, ETIQUETAS_GENERACION } from "../../constants/catalogos.js";

const ETIQUETA_RUTA = { A: "Materia prima", B: "Valor agregado" };
const ETIQUETA_CULTIVO = { cafe: "Café", cacao: "Cacao", ambos: "Café y cacao" };
const HISTORIA_COLAPSADA_LARGO = 180;

// Mismo criterio que subtituloGeneracional() en TrazabilidadPublicaPage.jsx
// -- duplicado a proposito, no importado desde ahi (ver el comentario de
// Avatar mas abajo: este componente no arrastra esa pagina como dependencia).
function subtituloGeneracional(actor) {
  if (actor.rol !== "productor") return null;
  const partes = [];
  if (actor.generacion_familiar) {
    partes.push(`${ETIQUETAS_GENERACION[actor.generacion_familiar] ?? actor.generacion_familiar} de productores`);
  }
  if (actor.anio_inicio_actividad) {
    partes.push(`desde ${actor.anio_inicio_actividad}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

// Historia libre del productor: colapsada a un par de lineas si es larga,
// con boton para expandir/contraer -- evita que un texto de hasta 500
// caracteres (ver HISTORIA_MAX en backend/routes/usuarios.js) infle la
// tarjeta de entrada.
function HistoriaProductor({ texto }) {
  const [expandido, setExpandido] = useState(false);
  const esLarga = texto.length > HISTORIA_COLAPSADA_LARGO;

  return (
    <div className="tarjeta-actor__seccion">
      <h3>Su historia</h3>
      <p className={`tarjeta-actor__historia ${!expandido && esLarga ? "tarjeta-actor__historia--colapsada" : ""}`}>
        {texto}
      </p>
      {esLarga && (
        <button type="button" className="tarjeta-actor__historia-toggle" onClick={() => setExpandido((v) => !v)}>
          {expandido ? "Ver menos ▲" : "Ver más ▼"}
        </button>
      )}
    </div>
  );
}

// Asociacion/cooperativa (migracion 023): opcional, mismo criterio que
// subtituloGeneracional -- si no esta presente, la seccion entera se omite.
// Esta tarjeta tambien mostro "certificaciones" autodeclaradas por el
// productor (mismo campo, migracion 023), pero se elimino (migracion 026):
// una certificacion la otorga un tercero auditor, no el propio productor
// marcandose casillas -- ver el paso de Certificacion dentro de
// Procesamiento para el flujo real.
function AsociacionProductor({ usuario }) {
  if (!usuario.asociacion_cooperativa) return null;

  return (
    <div className="tarjeta-actor__seccion">
      <h3>Asociación</h3>
      <p className="tarjeta-actor__asociacion">🤝 {usuario.asociacion_cooperativa}</p>
    </div>
  );
}

function urlArchivo(rutaRelativa) {
  if (!rutaRelativa) return null;
  return rutaRelativa.startsWith("http") ? rutaRelativa : `${API_BASE_URL}${rutaRelativa}`;
}

const MARGEN = 12;
const ANCHO = 340;
const ALTO_MAX_DESEADO = 460;

// Calcula donde poner la tarjeta relativa al elemento en el que se hizo
// click: preferentemente debajo, pegada al borde izquierdo -- si no hay
// espacio abajo (el actor esta cerca del pie de pantalla) se voltea hacia
// arriba, y siempre se recorta al ancho/alto visible en vez de salirse de
// la ventana.
function calcularPosicion(anchorRect) {
  let left = anchorRect.left;
  left = Math.min(left, window.innerWidth - ANCHO - MARGEN);
  left = Math.max(left, MARGEN);

  const espacioAbajo = window.innerHeight - anchorRect.bottom - MARGEN;
  const espacioArriba = anchorRect.top - MARGEN;

  let top;
  let maxHeight;
  if (espacioAbajo >= 220 || espacioAbajo >= espacioArriba) {
    top = anchorRect.bottom + MARGEN;
    maxHeight = Math.max(Math.min(ALTO_MAX_DESEADO, espacioAbajo), 160);
  } else {
    maxHeight = Math.max(Math.min(ALTO_MAX_DESEADO, espacioArriba), 160);
    top = anchorRect.top - MARGEN - maxHeight;
  }
  return { left, top, maxHeight };
}

// Avatar duplicado a proposito (en vez de importar el de
// TrazabilidadPublicaPage.jsx): este componente puede reutilizarse en
// cualquier contexto publico futuro sin arrastrar esa pagina como
// dependencia. Mismo criterio de fallback (foto o inicial) en toda la app.
function Avatar({ persona, tamano }) {
  const nombreMostrado = persona.nombre_publico || persona.nombre;
  const inicial = nombreMostrado.charAt(0).toUpperCase();
  const url = urlArchivo(persona.foto_perfil_url);
  const estilo = { width: tamano, height: tamano };
  return url ? (
    <img className="tarjeta-actor__avatar" style={estilo} src={url} alt="" />
  ) : (
    <span className="tarjeta-actor__avatar tarjeta-actor__avatar--inicial" style={estilo}>
      {inicial}
    </span>
  );
}

// Tarjeta flotante estilo "hovercard" (similar a la vista previa de perfil
// de Facebook) que aparece al hacer click en cualquier actor de la linea
// de tiempo -- tanto quien registro la etapa como quien la valido.
// Consume GET /api/usuarios/:id/actividad-publica (publico, sin login).
export function TarjetaPerfilActor({ actor, anchorRect, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const posicion = calcularPosicion(anchorRect);

  useEffect(() => {
    setCargando(true);
    setError(null);
    setDatos(null);
    const controller = new AbortController();
    api
      .obtenerActividadPublica(actor.id, controller.signal)
      .then(setDatos)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [actor.id]);

  useEffect(() => {
    function alHacerClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) onCerrar();
    }
    function alPresionarTecla(e) {
      if (e.key === "Escape") onCerrar();
    }
    // Cerrar al hacer scroll DE LA PAGINA (mas simple y predecible que
    // reposicionar la tarjeta en vivo mientras la pagina se mueve debajo
    // de ella) -- pero no si el scroll ocurre DENTRO de la propia tarjeta
    // (su cuerpo tiene overflow-y:auto para listas largas de parcelas/
    // lotes). Con {capture:true} en window, el evento de scroll interno
    // tambien llega aqui primero, asi que hay que descartarlo explicitamente.
    function alHacerScroll(e) {
      if (ref.current && ref.current.contains(e.target)) return;
      onCerrar();
    }
    document.addEventListener("mousedown", alHacerClickFuera);
    document.addEventListener("keydown", alPresionarTecla);
    window.addEventListener("scroll", alHacerScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", alHacerClickFuera);
      document.removeEventListener("keydown", alPresionarTecla);
      window.removeEventListener("scroll", alHacerScroll, { capture: true });
    };
  }, [onCerrar]);

  const nombreMostrado = actor.nombre_publico || actor.nombre;
  const subtitulo = subtituloGeneracional(actor);
  const sinActividad = datos && datos.parcelas.length === 0 && datos.lotes.length === 0;

  return (
    <div
      ref={ref}
      className="tarjeta-actor"
      style={{ left: posicion.left, top: posicion.top, maxHeight: posicion.maxHeight }}
      role="dialog"
      aria-label={`Perfil público de ${nombreMostrado}`}
    >
      <button type="button" className="tarjeta-actor__cerrar" onClick={onCerrar} aria-label="Cerrar">
        ✕
      </button>

      <div className="tarjeta-actor__header">
        <Avatar persona={actor} tamano={60} />
        <div>
          <div className="tarjeta-actor__nombre">{nombreMostrado}</div>
          <span className="tarjeta-actor__rol">{ETIQUETAS_ROL[actor.rol] ?? actor.rol}</span>
          {subtitulo && <span className="tarjeta-actor__generacion">{subtitulo}</span>}
        </div>
      </div>

      <div className="tarjeta-actor__cuerpo">
        {cargando && <p className="texto-tenue-panel">Cargando...</p>}
        {error && <p className="mensaje-error">{error}</p>}

        {datos && (
          <>
            {datos.usuario.historia && <HistoriaProductor texto={datos.usuario.historia} />}

            <AsociacionProductor usuario={datos.usuario} />

            {datos.parcelas.length > 0 && (
              <div className="tarjeta-actor__seccion">
                <h3>Parcelas</h3>
                <div className="tarjeta-actor__parcelas">
                  {datos.parcelas.map((p) => (
                    <div key={p.id} className="tarjeta-actor__parcela">
                      <div className="tarjeta-actor__parcela-foto">
                        {p.foto ? <img src={urlArchivo(p.foto)} alt="" /> : <span>🌿</span>}
                      </div>
                      <div>
                        <strong>{p.nombre_parcela}</strong>
                        <span>
                          {p.zona ?? "Zona sin especificar"}
                          {p.tipo_cultivo ? ` · ${ETIQUETA_CULTIVO[p.tipo_cultivo]}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {datos.lotes.length > 0 && (
              <div className="tarjeta-actor__seccion">
                <h3>Cafés y cacaos con trazabilidad pública</h3>
                <ul className="tarjeta-actor__lotes">
                  {datos.lotes.map((l) => (
                    <li key={l.id}>
                      <Link to={`/trazabilidad/${l.codigo_unico}`} onClick={onCerrar}>
                        <span className="tarjeta-actor__lote-icono">
                          {l.tipo_producto === "cafe" ? "☕" : "🍫"}
                        </span>
                        <span className="tarjeta-actor__lote-variedad">
                          {l.variedad || (l.tipo_producto === "cafe" ? "Café" : "Cacao")}
                        </span>
                        {l.ruta && (
                          <span className={`badge-ruta badge-ruta--${l.ruta.toLowerCase()}`}>
                            {ETIQUETA_RUTA[l.ruta]}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sinActividad && (
              <p className="texto-vacio-suave">Sin actividad pública todavía.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
