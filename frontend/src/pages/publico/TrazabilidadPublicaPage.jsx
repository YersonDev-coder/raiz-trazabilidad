import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { api, API_BASE_URL } from "../../api.js";
import { descargarFichaPdf } from "../../lib/fichaPdf.js";
import {
  ETIQUETAS_ROL,
  ETIQUETAS_GENERACION,
  ETIQUETAS_ESTADO_GRANO,
  ETIQUETAS_TIPO_COSECHA,
  ETIQUETAS_SISTEMA_CULTIVO,
  ETIQUETAS_METODO_FERMENTACION,
  ETIQUETAS_METODO_SECADO,
  ETIQUETAS_CLASIFICACION_CALIDAD,
  ETIQUETAS_MOLIENDA_TIPO,
} from "../../constants/catalogos.js";
import { TarjetaPerfilActor } from "../../components/publico/TarjetaPerfilActor.jsx";
import { CadenaBloques } from "../../components/publico/CadenaBloques.jsx";
import { ToggleTema } from "../../components/publico/ToggleTema.jsx";
import { useTema } from "../../theme/TemaContext.jsx";
import "../../styles/publico.css";

const ETIQUETAS_ETAPA = {
  produccion: "Producción",
  acopio: "Acopio",
  procesamiento: "Procesamiento",
  exportacion: "Exportación",
};

const ICONOS_ETAPA = {
  produccion: "🌱",
  acopio: "⚖️",
  procesamiento: "🔥",
  exportacion: "🚢",
};

const ETIQUETAS_CAMPO = {
  variedad: "Variedad",
  fecha_cosecha: "Fecha de cosecha",
  volumen_kg: "Volumen (kg, en fresco)",
  estado_grano: "Estado del grano",
  tipo_cosecha: "Tipo de cosecha",
  fecha_recepcion: "Fecha de recepción",
  // peso_kg/peso_salida_kg/humedad_pct son especificas de la etapa de
  // Acopio (ver migracion 030) y su etiqueta cambia segun el producto del
  // lote (cafe/cacao) -- estos 3 valores son el fallback generico; el
  // override real ocurre en etiquetasCampoPara() mas abajo, indexado por
  // tipoProducto.
  peso_kg: "Peso recibido (kg)",
  peso_salida_kg: "Peso final entregado (kg)",
  humedad_pct: "Humedad (%)",
  dias_secado: "Días de secado",
  metodo_secado: "Método de secado",
  fecha_hora_despulpado: "Fecha y hora de despulpado",
  metodo_fermentacion: "Método de fermentación",
  horas_fermentacion: "Horas de fermentación",
  peso_pergamino_humedo_kg: "Peso pergamino húmedo (kg)",
  dias_fermentacion: "Días de fermentación",
  metodo_beneficio: "Método de beneficio",
  tipo_secado: "Tipo de secado",
  detalles_json: "Detalles",
  tipo_transformacion: "Tipo de transformación",
  puerto: "Puerto",
  destino: "Destino",
  contenedor: "Contenedor",
  // Procesamiento (ver migracion 031) -- peso_entrada_kg/clasificacion_calidad/
  // tueste_*/molido/descascarillado/nibs_peso_kg/molienda_tipo.
  peso_entrada_kg: "Peso de entrada (kg)",
  clasificacion_calidad: "Clasificación de calidad",
  tueste_temperatura: "Temperatura de tueste (°C)",
  tueste_tiempo: "Tiempo de tueste (min)",
  molido: "Molido",
  descascarillado: "Descascarillado",
  nibs_peso_kg: "Peso de nibs (kg)",
  molienda_tipo: "Molienda",
};

// Override de etiquetas de ETIQUETAS_CAMPO segun la ETAPA + producto del
// lote -- necesario porque el mismo nombre de columna ("peso_salida_kg")
// existe en mas de una tabla de registro (Acopio Y Procesamiento, ver
// migraciones 030/031) con un significado distinto en cada una; indexar
// solo por producto (sin etapa) haria que el override de Acopio se filtre
// tambien dentro de la tarjeta de Procesamiento. Cualquier campo no
// listado aca usa el generico de ETIQUETAS_CAMPO tal cual.
const ETIQUETAS_CAMPO_POR_ETAPA_PRODUCTO = {
  acopio: {
    cafe: {
      peso_kg: "Peso recibido (café cereza, kg)",
      peso_salida_kg: "Peso final entregado (café pergamino seco, kg)",
    },
    cacao: {
      peso_kg: "Peso recibido (cacao en baba, kg)",
      peso_salida_kg: "Peso final entregado (cacao en grano seco, kg)",
      humedad_pct: "Humedad final (%)",
    },
  },
  procesamiento: {
    cafe: {
      peso_entrada_kg: "Peso de entrada (café pergamino seco, kg)",
      peso_salida_kg: "Peso de salida (café verde/oro, kg)",
    },
    cacao: {
      peso_entrada_kg: "Peso de entrada (cacao en grano seco, kg)",
      peso_salida_kg: "Peso de salida final (kg)",
    },
  },
};

function etiquetaCampoPara(campo, tipoProducto, etapa) {
  return (
    ETIQUETAS_CAMPO_POR_ETAPA_PRODUCTO[etapa]?.[tipoProducto]?.[campo] ?? ETIQUETAS_CAMPO[campo] ?? campo
  );
}

// Valores en bruto que llegan de la BD (enums tipo "cereza_fresca", o
// booleanos 0/1) y que necesitan traduccion a texto legible -- a diferencia
// de la mayoria de campos de DetalleEtapa, que ya vienen como texto o
// numero listo para mostrar tal cual.
const TRADUCIR_SI_NO = { 1: "Sí", 0: "No" };
const FORMATEADORES_VALOR = {
  estado_grano: (v) => ETIQUETAS_ESTADO_GRANO[v] ?? v,
  tipo_cosecha: (v) => ETIQUETAS_TIPO_COSECHA[v] ?? v,
  metodo_fermentacion: (v) => ETIQUETAS_METODO_FERMENTACION[v] ?? v,
  metodo_secado: (v) => ETIQUETAS_METODO_SECADO[v] ?? v,
  clasificacion_calidad: (v) => ETIQUETAS_CLASIFICACION_CALIDAD[v] ?? v,
  molienda_tipo: (v) => ETIQUETAS_MOLIENDA_TIPO[v] ?? v,
  molido: (v) => TRADUCIR_SI_NO[v] ?? v,
  descascarillado: (v) => TRADUCIR_SI_NO[v] ?? v,
};

const ETIQUETA_RUTA = { A: "Materia prima", B: "Valor agregado" };
const ETIQUETA_ESTADO_CERT = { aprobado: "Aprobado", pendiente: "Pendiente", rechazado: "Rechazado" };
const ICONO_ESTADO_CERT = { aprobado: "✓", pendiente: "…", rechazado: "✕" };
const ETIQUETA_TIPO_CERT = {
  fitosanitaria: "Certificación fitosanitaria (SENASA)",
  aduanera: "Documentación aduanera (SUNAT)",
};
const ETIQUETA_UNIDAD_EXTENSION = { ha: "ha", m2: "m²" };

function urlArchivo(rutaRelativa) {
  return rutaRelativa.startsWith("http") ? rutaRelativa : `${API_BASE_URL}${rutaRelativa}`;
}

// Lightbox simple (no habia ninguno en el proyecto todavia): fondo oscuro a
// pantalla completa + imagen centrada, cierra con click afuera, la X, o
// Escape. Reutilizado tanto por las fotos de evidencia de cosecha como por
// la galeria institucional de la parcela -- misma interaccion para ambas.
function Lightbox({ foto, onCerrar }) {
  useEffect(() => {
    function alPresionarTecla(e) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alPresionarTecla);
    return () => document.removeEventListener("keydown", alPresionarTecla);
  }, [onCerrar]);

  return (
    <div className="lightbox-velo" onClick={onCerrar}>
      <button type="button" className="lightbox-cerrar" onClick={onCerrar} aria-label="Cerrar imagen">
        ✕
      </button>
      <img
        className="lightbox-imagen"
        src={foto.url}
        alt={foto.alt}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Grid de miniaturas clickeables (evidencia de cosecha o galeria de
// parcela) -- mismo componente para ambas, solo cambia el `alt` y la clase
// de titulo que le pasa el llamador.
function GaleriaMiniaturas({ fotos, alt, onAmpliar }) {
  return (
    <div className="linea-tiempo__fotos">
      {fotos.map((f) => (
        <img
          key={f.id}
          src={urlArchivo(f.url)}
          alt={alt}
          onClick={() => onAmpliar({ url: urlArchivo(f.url), alt })}
        />
      ))}
    </div>
  );
}

// Antes era texto corrido con negritas sueltas ("Variedad: Caturra   Fecha
// de cosecha: ..."); ahora cada dato es su propio bloque etiqueta/valor en
// una grilla, mas facil de escanear de un vistazo (misma info, mejor
// jerarquia visual -- ver docs de la sesion de rediseño).
function DetalleEtapa({ detalle, tipoProducto, etapa }) {
  const entradas = Object.entries(detalle).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entradas.length === 0) return null;
  return (
    <dl className="linea-tiempo__detalle">
      {entradas.map(([campo, valor]) => {
        const formateador = FORMATEADORES_VALOR[campo];
        const valorMostrado = formateador
          ? formateador(valor)
          : typeof valor === "object"
          ? JSON.stringify(valor)
          : String(valor);
        return (
          <div key={campo} className="linea-tiempo__dato">
            <dt>{etiquetaCampoPara(campo, tipoProducto, etapa)}</dt>
            <dd>{valorMostrado}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// Identidad de un actor (quien registró o quien validó una etapa): foto si
// existe, si no un círculo con su inicial -- mismo criterio de fallback que
// el avatar del sidebar del panel interno (PanelLayout.jsx), para que se
// sienta consistente en toda la plataforma.
function Avatar({ persona, tamano = 44 }) {
  const nombreMostrado = persona.nombre_publico || persona.nombre;
  const inicial = nombreMostrado.charAt(0).toUpperCase();
  const estilo = { width: tamano, height: tamano };
  return persona.foto_perfil_url ? (
    <img
      className="linea-tiempo__avatar"
      style={estilo}
      src={urlArchivo(persona.foto_perfil_url)}
      alt=""
    />
  ) : (
    <span className="linea-tiempo__avatar linea-tiempo__avatar--inicial" style={estilo}>
      {inicial}
    </span>
  );
}

// "3ra generación de productores · desde 1998" -- perfil extendido
// (migracion 020), opcional, solo relevante para Productor. Cualquiera de
// los dos datos puede faltar por separado (ambos opcionales, sin relacion
// entre si), de ahi el join condicional en vez de asumir que llegan juntos.
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

// El actor (quien registró la etapa: el Productor que cosechó, la
// Cooperativa que pesó, etc.) es el dato que más le importa al comprador
// final -- "¿quién hizo esto?" -- así que recibe el tratamiento visual
// principal (avatar grande, nombre destacado). Quien validó la etapa se
// muestra aparte, más discreto (ver .linea-tiempo__validador). Ambos son
// clickeables: abren la misma tarjeta de perfil flotante (ver
// TarjetaPerfilActor) con sus parcelas/lotes públicos.
function ActorEtapa({ actor, onAbrir }) {
  if (!actor) return null;
  const nombreMostrado = actor.nombre_publico || actor.nombre;
  const subtitulo = subtituloGeneracional(actor);
  return (
    <button
      type="button"
      className="linea-tiempo__actor linea-tiempo__actor--clickeable"
      onClick={(e) => onAbrir(actor, e.currentTarget)}
    >
      <Avatar persona={actor} />
      <div>
        <div className="linea-tiempo__actor-nombre">{nombreMostrado}</div>
        <span className="linea-tiempo__actor-rol">{ETIQUETAS_ROL[actor.rol] ?? actor.rol}</span>
        {subtitulo && <span className="linea-tiempo__actor-generacion">{subtitulo}</span>}
      </div>
    </button>
  );
}

export function TrazabilidadPublicaPage() {
  const { codigo } = useParams();
  // Toggle claro/oscuro GLOBAL (ver TemaContext.jsx) -- mismo Context que
  // la landing, ya persistido en localStorage y compartido entre paginas.
  const { tema } = useTema();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [cadena, setCadena] = useState(null);

  function abrirPerfil(actor, elementoAncla) {
    setPerfilAbierto({ actor, rect: elementoAncla.getBoundingClientRect() });
  }

  function cerrarPerfil() {
    setPerfilAbierto(null);
  }

  useEffect(() => {
    setCargando(true);
    setError(null);
    setDatos(null);
    setPerfilAbierto(null);
    api
      .obtenerTrazabilidad(codigo)
      .then(setDatos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [codigo]);

  useEffect(() => {
    // Independiente de la carga principal de arriba: si esta falla (o el
    // lote todavia no es publico), el explorador de cadena de bloques
    // simplemente no se muestra (mismo gate que /trazabilidad/:codigo, ver
    // routes/trazabilidad.js), sin bloquear el resto de la ficha.
    setCadena(null);
    api
      .obtenerCadenaLote(codigo)
      .then(setCadena)
      .catch(() => setCadena(null));
  }, [codigo]);

  useEffect(() => {
    // El QR solo se renderiza si el evento ya existe (qr_generado_en no
    // nulo, ver backend/src/lib/codigosQr.js) -- antes de eso no hay nada
    // que escanear todavia, aunque la ficha en si ya sea publica.
    if (!datos || !datos.qr_generado_en) {
      setQrDataUrl(null);
      return;
    }
    const url = `${window.location.origin}/trazabilidad/${datos.codigo_consultado}`;
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#3b2415", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [datos]);

  async function handleDescargarPdf() {
    if (!datos || !qrDataUrl) return;
    setGenerandoPdf(true);
    try {
      await descargarFichaPdf(datos);
    } finally {
      setGenerandoPdf(false);
    }
  }

  if (cargando) {
    return (
      <div className="publico" data-tema={tema}>
        <p className="publico-cargando">Cargando ficha de trazabilidad...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="publico" data-tema={tema}>
        <header className="publico-header">
          <Link to="/" className="publico-header__marca">
            Raíz
          </Link>
          <ToggleTema />
        </header>
        <p className="publico-error">{error}</p>
      </div>
    );
  }

  const { lote, parcela, linea_tiempo: lineaTiempo, certificaciones, transformacion } = datos;
  const tieneCoordenadas = parcela && parcela.ubicacion_lat != null && parcela.ubicacion_lng != null;

  // Mejor foto disponible para el hero: prioridad a la galeria de la
  // parcela (imagen institucional, mas probable que sea una toma amplia y
  // vistosa de la finca) sobre la evidencia de cosecha (foto puntual del
  // evento, no siempre tan fotogenica). Si no hay ninguna de las dos, no
  // hay hero -- el layout cae al header de texto plano de siempre.
  const pasoProduccion = lineaTiempo.find((p) => p.etapa === "produccion");
  const fotoHeroUrl = parcela?.fotos?.[0]?.url ?? pasoProduccion?.fotos?.[0]?.url ?? null;

  const contenidoHero = (
    <>
      <p className="trazabilidad-hero__codigo">{lote.codigo_unico}</p>
      <h1 className="trazabilidad-hero__titulo">
        {lote.tipo_producto === "cafe" ? "Café" : "Cacao"} de Huánuco
      </h1>
      <div className="trazabilidad-hero__meta">
        {lote.ruta && (
          <span className={`badge-ruta badge-ruta--${lote.ruta.toLowerCase()}`}>
            {ETIQUETA_RUTA[lote.ruta]}
          </span>
        )}
        <span>Estado actual: {lote.estado_macro}</span>
        {parcela && <span>Zona: {parcela.zona}</span>}
      </div>
    </>
  );

  return (
    <div className="publico" data-tema={tema}>
      <header className={`publico-header ${fotoHeroUrl ? "publico-header--flotante" : ""}`}>
        <Link to="/" className="publico-header__marca">
          Raíz
        </Link>
        <div className="publico-header__acciones">
          <ToggleTema />
          <Link to="/" className="publico-header__acceso">
            ← Volver al catálogo
          </Link>
        </div>
      </header>

      {fotoHeroUrl ? (
        <div
          className="trazabilidad-hero-foto"
          style={{ backgroundImage: `url("${urlArchivo(fotoHeroUrl)}")` }}
        >
          <div className="trazabilidad-hero-foto__velo" />
          <div className="trazabilidad-hero-foto__contenido">{contenidoHero}</div>
        </div>
      ) : (
        <div className="trazabilidad-hero">{contenidoHero}</div>
      )}

      <div className="trazabilidad-grid">
        <div>
          <div className="panel-publico">
            <h2 className="panel-publico__titulo">Línea de tiempo</h2>
            <ol className="linea-tiempo">
              {lineaTiempo.map((paso) => (
                <li key={paso.etapa} className="linea-tiempo__item">
                  <span className="linea-tiempo__punto">{ICONOS_ETAPA[paso.etapa] ?? "•"}</span>

                  <div className="linea-tiempo__card">
                    <div className="linea-tiempo__card-encabezado">
                      <span className="linea-tiempo__etapa">
                        {ETIQUETAS_ETAPA[paso.etapa] ?? paso.etapa}
                      </span>
                      <span className="linea-tiempo__fecha">Validado el {paso.fecha_validacion}</span>
                    </div>

                    <ActorEtapa actor={paso.actor} onAbrir={abrirPerfil} />

                    <DetalleEtapa detalle={paso.detalle} tipoProducto={lote.tipo_producto} etapa={paso.etapa} />

                    {paso.etapa === "produccion" && paso.detalle.volumen_kg != null && (
                      <p className="linea-tiempo__nota-peso">
                        ⓘ El peso indicado es en fresco, tal como se registró en la cosecha. El peso
                        post-proceso (después de fermentación/secado) se registra en la etapa de
                        Acopio.
                      </p>
                    )}

                    {paso.fotos.length > 0 && (
                      <div className="linea-tiempo__galeria-bloque">
                        <p className="linea-tiempo__subtitulo">📸 Evidencia de esta cosecha</p>
                        <GaleriaMiniaturas
                          fotos={paso.fotos}
                          alt="Evidencia de la cosecha"
                          onAmpliar={setFotoAmpliada}
                        />
                      </div>
                    )}

                    {paso.etapa === "produccion" && parcela?.fotos?.length > 0 && (
                      <div className="linea-tiempo__galeria-bloque">
                        <p className="linea-tiempo__subtitulo">🌄 Galería de la parcela</p>
                        <GaleriaMiniaturas
                          fotos={parcela.fotos}
                          alt={`Foto de ${parcela.nombre_parcela}`}
                          onAmpliar={setFotoAmpliada}
                        />
                      </div>
                    )}

                    {paso.etapa === "produccion" && tieneCoordenadas && (
                      <div className="linea-tiempo__mapa">
                        <iframe
                          title="Mapa de la parcela"
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                            parcela.ubicacion_lng - 0.01
                          }%2C${parcela.ubicacion_lat - 0.01}%2C${parcela.ubicacion_lng + 0.01}%2C${
                            parcela.ubicacion_lat + 0.01
                          }&marker=${parcela.ubicacion_lat}%2C${parcela.ubicacion_lng}`}
                        />
                        <div className="linea-tiempo__mapa-pie">
                          <span className="linea-tiempo__mapa-ubicacion">
                            📍 {parcela.nombre_parcela}
                            {parcela.zona && <span className="badge-zona-mapa">{parcela.zona}</span>}
                          </span>
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${parcela.ubicacion_lat}&mlon=${parcela.ubicacion_lng}#map=15/${parcela.ubicacion_lat}/${parcela.ubicacion_lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver mapa completo ↗
                          </a>
                        </div>
                      </div>
                    )}

                    {paso.etapa === "produccion" &&
                      parcela &&
                      (parcela.extension_valor != null ||
                        parcela.altitud_msnm != null ||
                        parcela.sistema_cultivo) && (
                        <div className="linea-tiempo__parcela-datos">
                          {parcela.extension_valor != null && (
                            <span className="chip-dato-parcela">
                              📐 {parcela.extension_valor}{" "}
                              {ETIQUETA_UNIDAD_EXTENSION[parcela.extension_unidad] ?? parcela.extension_unidad}
                            </span>
                          )}
                          {parcela.altitud_msnm != null && (
                            <span className="chip-dato-parcela">⛰️ {parcela.altitud_msnm} msnm</span>
                          )}
                          {parcela.sistema_cultivo && (
                            <span className="chip-dato-parcela">
                              🌳 {ETIQUETAS_SISTEMA_CULTIVO[parcela.sistema_cultivo] ?? parcela.sistema_cultivo}
                            </span>
                          )}
                        </div>
                      )}

                    {paso.validado_por && (
                      <button
                        type="button"
                        className="linea-tiempo__validador linea-tiempo__validador--clickeable"
                        onClick={(e) => abrirPerfil(paso.validado_por, e.currentTarget)}
                      >
                        ✓ Validado por {paso.validado_por.nombre_publico || paso.validado_por.nombre}
                        {" · "}
                        {ETIQUETAS_ROL[paso.validado_por.rol] ?? paso.validado_por.rol}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {transformacion && (
              <div className="transformacion-bloque">
                <div className="linea-tiempo__etapa">Transformación (Ruta B)</div>
                <div className="linea-tiempo__fecha">Validado el {transformacion.fecha_validacion}</div>
                <DetalleEtapa detalle={transformacion.detalle} />
              </div>
            )}
          </div>

          {cadena && <CadenaBloques bloques={cadena.bloques} integridad={cadena.integridad} />}
        </div>

        <div>
          <div className="panel-publico tarjeta-qr">
            <h2 className="panel-publico__titulo">Código QR de esta ficha</h2>
            {datos.qr_generado_en ? (
              <>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`Código QR de ${lote.codigo_unico}`} />
                ) : (
                  <p className="texto-vacio-suave">Generando código...</p>
                )}
                <p className="texto-vacio-suave">Emitido el {datos.qr_generado_en}</p>
                <button
                  type="button"
                  className="tarjeta-qr__boton"
                  onClick={handleDescargarPdf}
                  disabled={!qrDataUrl || generandoPdf}
                >
                  {generandoPdf ? "Generando PDF..." : "Descargar ficha en PDF"}
                </button>
              </>
            ) : (
              // El QR ahora se emite desde el registro de cosecha (ver
              // lib/codigosQr.js), asi que practicamente todo lote visible
              // aqui ya lo tiene -- esto solo aparece para lotes muy
              // viejos, de antes de ese cambio, que se quedaron sin fila en
              // codigos_qr. Ya no prometemos "la siguiente etapa" porque
              // ese ya no es el momento en que se genera.
              <p className="texto-vacio-suave">QR no disponible para este lote.</p>
            )}
          </div>

          <div className="panel-publico">
            <h2 className="panel-publico__titulo">Certificaciones</h2>
            {certificaciones.length === 0 ? (
              // En la practica esto no deberia pasar: la ficha publica exige
              // que la certificacion fitosanitaria ya este aprobada por el
              // Administrador para existir (ver loteEsPublico() en
              // routes/trazabilidad.js), asi que siempre viene incluida.
              // Se deja este mensaje, en el mismo patron que "QR pendiente
              // de emision", por si ese gate cambia mas adelante.
              <p className="texto-vacio-suave">
                Certificación fitosanitaria pendiente — se emitirá cuando el Administrador la
                apruebe.
              </p>
            ) : (
              <ul className="lista-certificaciones">
                {certificaciones.map((c, i) => (
                  <li key={i}>
                    <span className={`certificacion-icono certificacion-icono--${c.estado}`}>
                      {ICONO_ESTADO_CERT[c.estado] ?? "?"}
                    </span>
                    <span>
                      {ETIQUETA_TIPO_CERT[c.tipo] ?? c.tipo} — {ETIQUETA_ESTADO_CERT[c.estado] ?? c.estado}
                      {c.fecha_validacion && ` · ${c.fecha_validacion}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {perfilAbierto && (
        <TarjetaPerfilActor
          actor={perfilAbierto.actor}
          anchorRect={perfilAbierto.rect}
          onCerrar={cerrarPerfil}
        />
      )}

      {fotoAmpliada && <Lightbox foto={fotoAmpliada} onCerrar={() => setFotoAmpliada(null)} />}
    </div>
  );
}
