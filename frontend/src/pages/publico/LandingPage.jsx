import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_BASE_URL } from "../../api.js";
import { ZONAS } from "../../constants/catalogos.js";
import { TarjetaProducto } from "../../components/publico/TarjetaProducto.jsx";
import { ToggleTema } from "../../components/publico/ToggleTema.jsx";
import { useTema } from "../../theme/TemaContext.jsx";
import "../../styles/publico.css";

// Placeholder TEMPORAL mientras el Administrador no suba una imagen propia
// via PUT /api/admin/configuracion. Foto libre de derechos (Unsplash,
// licencia Unsplash: uso comercial permitido, sin atribucion requerida) --
// plantacion de cafe en Buenavista, Quindio, Colombia, por David Restrepo.
// Reemplazar por una imagen propia de Huanuco en cuanto se tenga.
const IMAGEN_FONDO_RESPALDO =
  "https://images.unsplash.com/photo-1672851612794-6687bf0bf1a3?auto=format&fit=crop&w=1920&q=80";

const CADENA = [
  { icono: "🌱", etiqueta: "Producción" },
  { icono: "⚖️", etiqueta: "Acopio" },
  { icono: "🔥", etiqueta: "Procesamiento" },
  { icono: "🚢", etiqueta: "Exportación" },
];

// No hay ninguna libreria de iconos en el proyecto (icons.svg en /public
// es un sobrante de la plantilla base de Vite, sin usar en ningun lado de
// src/) -- SVG simple e inline en vez de un emoji, para que se lea como un
// icono real de WhatsApp y no como texto.
function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.043 2C6.514 2 2.03 6.483 2.03 12.012c0 1.98.573 3.827 1.562 5.383L2 22l4.746-1.554a9.94 9.94 0 0 0 5.297 1.519h.004c5.53 0 10.013-4.483 10.013-10.012 0-2.674-1.04-5.186-2.933-7.078A9.943 9.943 0 0 0 12.043 2zm0 18.09h-.003a8.06 8.06 0 0 1-4.1-1.122l-.294-.175-3.048.998.998-3.052-.192-.303a8.05 8.05 0 0 1-1.245-4.323c0-4.456 3.63-8.086 8.088-8.086 2.16 0 4.19.84 5.717 2.368a8.03 8.03 0 0 1 2.367 5.72c0 4.456-3.63 8.086-8.088 8.086z" />
    </svg>
  );
}

// Fade-in + leve desplazamiento vertical al entrar en el viewport, con
// IntersectionObserver nativo (sin libreria externa). Se revela una sola
// vez por elemento -- una vez visible, se desconecta el observer, no vuelve
// a ocultarse al scrollear hacia arriba. `delayMs` habilita el stagger de
// las tarjetas del catalogo (ver mas abajo). Si el sistema tiene
// prefers-reduced-motion activado, se muestra visible de entrada y no se
// observa nada -- la animacion queda completamente desactivada (ver
// tambien el override en publico.css, que cubre el instante antes de que
// este efecto corra).
function Revelador({ children, className = "", delayMs = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal--visible" : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function urlImagen(rutaRelativa) {
  if (!rutaRelativa) return IMAGEN_FONDO_RESPALDO;
  return rutaRelativa.startsWith("http") ? rutaRelativa : `${API_BASE_URL}${rutaRelativa}`;
}

// Foto real de la galeria institucional de una parcela ya cargada
// (fotos_parcela, parcela_id=1 "Parcela El Mirador") -- no un placeholder.
// Se eligio esta entre las 6 fotos que existen hoy en la base porque es la
// unica centrada en personas cosechando, no otra toma aerea de hileras
// (esa ya es protagonista en el hero de /trazabilidad/:codigo de esta
// misma parcela, mejor variar aqui). Hardcodeada a proposito: esta seccion
// es institucional/fija, no depende de un lote o parcela especifica que el
// usuario elija.
const FOTO_PORQUE = "/uploads/parcelas/7c65832781bf201ca65f01b03bd0627d.png";

const STATS_PORQUE = [
  "6 actores validan cada lote",
  "Trazabilidad pública, sin registro",
  "Huánuco: Tingo María, Leoncio Prado, Pachitea",
  "Cadena de bloques verificable",
];

export function LandingPage() {
  const [config, setConfig] = useState({ nombre_plataforma: "Raíz", imagen_fondo_landing_url: null });

  // Toggle claro/oscuro GLOBAL (ver TemaContext.jsx) -- persiste en
  // localStorage y se comparte con la ficha de trazabilidad.
  const { tema } = useTema();

  const [tipoProducto, setTipoProducto] = useState("");
  const [ruta, setRuta] = useState("");
  const [zona, setZona] = useState("");

  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Si la foto hardcodeada de "Por que existe Raiz" alguna vez se borra del
  // disco (404), el <img> dispara onError y esto oculta la columna de foto
  // en vez de dejar un icono de imagen rota -- mismo criterio de "omitir
  // limpio si falta" que ya se uso en la ficha de trazabilidad.
  const [fotoPorqueOk, setFotoPorqueOk] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api
      .obtenerConfiguracion(controller.signal)
      .then(({ configuracion }) => setConfig(configuracion))
      .catch(() => {
        /* si falla, se queda con los valores por defecto (nombre + respaldo) */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setCargando(true);
    const controller = new AbortController();
    api
      .obtenerCatalogo({ tipo_producto: tipoProducto, ruta, zona }, controller.signal)
      .then(({ items: encontrados }) => setItems(encontrados))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [tipoProducto, ruta, zona]);

  return (
    <div className="publico" data-tema={tema}>
      <header className="publico-header publico-header--flotante">
        <span className="publico-header__marca">{config.nombre_plataforma}</span>
        <div className="publico-header__acciones">
          <ToggleTema />
          <a
            href="https://wa.me/51954477750?text=Hola%2C%20quiero%20registrar%20mi%20parcela%20en%20Ra%C3%ADz"
            target="_blank"
            rel="noopener noreferrer"
            className="publico-header__whatsapp"
          >
            <IconoWhatsApp />
            WhatsApp
          </a>
          <Link to="/login" className="publico-header__acceso">
            Acceso interno
          </Link>
        </div>
      </header>

      <section className="hero">
        <div
          className="hero__fondo"
          style={{ backgroundImage: `url("${urlImagen(config.imagen_fondo_landing_url)}")` }}
        />
        <div className="hero__velo" />
        <div className="hero__contenido">
          <span className="hero__eyebrow">Trazabilidad de café y cacao · Huánuco, Perú</span>
          <h1 className="hero__marca">{config.nombre_plataforma}</h1>
          <p className="hero__tagline">
            De la parcela huanuqueña a tu taza: el origen de cada lote, verificado paso a paso.
          </p>
          <a
            href="#catalogo"
            className="hero__cta"
            onClick={(e) => {
              const destino = document.getElementById("catalogo");
              if (!destino) return;
              e.preventDefault();
              const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              destino.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "start" });
            }}
          >
            Explorar catálogo ↓
          </a>
          <div className="hero__confianza">
            <span>Origen certificado, Huánuco</span>
            <span>Validado por cada actor de la cadena</span>
            <span>Trazabilidad pública, sin registro</span>
          </div>
        </div>
      </section>

      <section className={`seccion-porque ${fotoPorqueOk ? "" : "seccion-porque--sin-foto"}`}>
        <Revelador className="seccion-porque__inner">
          {fotoPorqueOk && (
            <div className="seccion-porque__foto">
              <img
                src={`${API_BASE_URL}${FOTO_PORQUE}`}
                alt="Cosecha de café en una parcela de Huánuco"
                onError={() => setFotoPorqueOk(false)}
              />
            </div>
          )}
          <div className="seccion-porque__texto">
            <span className="seccion-eyebrow">Nuestra razón de ser</span>
            <h2 className="seccion-porque__titulo">Por qué existe Raíz</h2>
            <p>
              En Huánuco, cada lote de café o cacao recorre un camino largo: del productor a la
              cooperativa, de ahí a la planta de procesamiento, luego a SENASA para su
              certificación, y finalmente al exportador. En el camino tradicional, esa información
              se dispersa entre cuadernos, mensajes sueltos y memorias de cada actor — y cuando un
              comprador en el extranjero pregunta de dónde viene su café, la respuesta rara vez es
              completa.
            </p>
            <p>
              Raíz conecta cada etapa de esa cadena en un solo lugar. Cada actor registra su parte
              del proceso, cada validación queda con fecha y responsable, y el resultado es un
              historial que cualquiera puede consultar — sin necesidad de una cuenta ni de confiar
              en la palabra de un intermediario.
            </p>
            <p>
              No reemplazamos el trabajo del productor, la cooperativa o el exportador. Solo
              hacemos que lo que ya hacen bien quede visible, en orden, y disponible para quien lo
              necesite ver. Cada validación queda registrada en una cadena de bloques con huella
              criptográfica propia — si algo se altera después, el sistema lo detecta.
            </p>
            <div className="seccion-porque__stats">
              {STATS_PORQUE.map((stat) => (
                <span key={stat}>{stat}</span>
              ))}
            </div>
          </div>
        </Revelador>
      </section>

      <section className="seccion-institucional">
        <Revelador className="seccion-institucional__inner">
          <div className="seccion-institucional__texto">
            <span className="seccion-eyebrow">Quiénes somos · Qué hacemos</span>
            <h2 className="seccion-institucional__titulo">
              Conectamos toda la cadena productiva del café y el cacao de Huánuco
            </h2>
            <p>
              {config.nombre_plataforma} conecta a productores, cooperativas, plantas de
              procesamiento y exportadores de Huánuco en un mismo registro de trazabilidad. Cada
              lote que ves en el catálogo pasó por validaciones reales de cada actor de la cadena
              — desde la cosecha hasta la exportación — para que puedas conocer exactamente de
              dónde viene tu café o cacao.
            </p>
          </div>
          <div className="seccion-institucional__cadena">
            {CADENA.map((paso, i) => (
              <div key={paso.etiqueta} className="cadena-paso">
                <span className="cadena-paso__icono">{paso.icono}</span>
                <span className="cadena-paso__etiqueta">{paso.etiqueta}</span>
                {i < CADENA.length - 1 && <span className="cadena-paso__flecha">→</span>}
              </div>
            ))}
          </div>
        </Revelador>
      </section>

      <section id="catalogo" className="seccion-catalogo">
        <span className="seccion-eyebrow">Catálogo verificado</span>
        <h2 className="seccion-catalogo__titulo">Lotes con trazabilidad completa</h2>
        <p className="seccion-catalogo__subtitulo">
          Solo se muestran lotes que ya completaron su procesamiento y validación.
        </p>

        <div className="catalogo-filtros">
          <div className="filtro-grupo">
            <span className="filtro-grupo__etiqueta">Producto</span>
            <div className="filtro-chips">
              {[
                { valor: "", etiqueta: "Todos" },
                { valor: "cafe", etiqueta: "Café" },
                { valor: "cacao", etiqueta: "Cacao" },
              ].map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  className={`filtro-chip ${tipoProducto === op.valor ? "activo" : ""}`}
                  onClick={() => setTipoProducto(op.valor)}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="filtro-grupo">
            <span className="filtro-grupo__etiqueta">Ruta</span>
            <div className="filtro-chips">
              {[
                { valor: "", etiqueta: "Todas" },
                { valor: "A", etiqueta: "Materia prima" },
                { valor: "B", etiqueta: "Valor agregado" },
              ].map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  className={`filtro-chip ${ruta === op.valor ? "activo" : ""}`}
                  onClick={() => setRuta(op.valor)}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="filtro-grupo">
            <span className="filtro-grupo__etiqueta">Zona</span>
            <select className="filtro-select" value={zona} onChange={(e) => setZona(e.target.value)}>
              <option value="">Todas las zonas</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>

        {cargando && <p className="texto-vacio-suave">Cargando catálogo...</p>}
        {error && <p className="mensaje-error">{error}</p>}

        {!cargando && !error && items.length === 0 && (
          <div className="estado-vacio">
            <p>No hay lotes que coincidan con estos filtros todavía.</p>
          </div>
        )}

        {!cargando && items.length > 0 && (
          <div className="grid-catalogo">
            {items.map((item, i) => (
              // Stagger limitado a las primeras 8 tarjetas (las que
              // tipicamente ya estan visibles al llegar a esta seccion) --
              // de ahi en mas, delayMs=0: cada una revela apenas entra en
              // el viewport al scrollear, sin retraso acumulado extra por
              // catalogos largos (ver Revelador arriba).
              <Revelador key={item.codigo} delayMs={i < 8 ? i * 60 : 0}>
                <TarjetaProducto item={item} />
              </Revelador>
            ))}
          </div>
        )}
      </section>

      <footer className="publico-footer">
        <span>
          {config.nombre_plataforma} · Trazabilidad de café y cacao · Huánuco, Perú
        </span>
      </footer>
    </div>
  );
}
