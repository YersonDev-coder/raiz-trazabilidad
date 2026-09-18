import { useState } from "react";

// Etiquetas/iconos propios de esta vista: los tipo_evento de la cadena hash
// no coinciden 1 a 1 con las 4 etapas de la linea de tiempo de arriba (hay
// dos eventos mas, certificacion_senasa y entrega_sunat, que se registran
// al VALIDAR procesamiento/exportacion, no al crear el registro -- ver
// backend/src/routes/procesamiento.js y exportacion.js).
const ETIQUETAS_TIPO_EVENTO = {
  produccion: "Producción registrada",
  acopio: "Acopio validado",
  procesamiento: "Procesamiento registrado",
  certificacion_senasa: "Certificación SENASA",
  exportacion: "Exportación registrada",
  entrega_sunat: "Entrega validada por SUNAT",
};

const ICONOS_TIPO_EVENTO = {
  produccion: "🌱",
  acopio: "⚖️",
  procesamiento: "🔥",
  certificacion_senasa: "🧪",
  exportacion: "🚢",
  entrega_sunat: "📦",
};

// primeros 12 + "..." + ultimos 8: suficiente para reconocer un hash a
// simple vista sin ocupar toda la tarjeta -- el hash completo real (64
// caracteres hex de SHA-256) siempre queda accesible con el boton copiar.
function truncarHash(hash) {
  if (!hash) return "";
  if (hash.length <= 24) return hash;
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

function BotonCopiarHash({ hash }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Clipboard API puede fallar (permiso denegado, contexto no seguro);
      // no hay fallback razonable aqui, el hash completo sigue visible al
      // pasar el mouse/tocar via el atributo title del contenedor.
    }
  }

  return (
    <button
      type="button"
      className="bloque-hash__copiar"
      onClick={copiar}
      aria-label="Copiar hash completo"
    >
      {copiado ? "✓ Copiado" : "Copiar"}
    </button>
  );
}

function FilaHash({ etiqueta, hash }) {
  return (
    <div className="bloque-hash">
      <span className="bloque-hash__etiqueta">{etiqueta}</span>
      <div className="bloque-hash__valor-fila">
        <code className="bloque-hash__valor" title={hash}>
          {truncarHash(hash)}
        </code>
        <BotonCopiarHash hash={hash} />
      </div>
    </div>
  );
}

// Badge de integridad, arriba de toda la seccion: lo primero que se lee,
// antes de entrar al detalle bloque por bloque. `numeroBloqueRoto` es la
// posicion dentro de ESTA lista (1-based), no el id interno de la tabla
// cadena_bloques -- ese id no tiene significado para quien lee la ficha
// publica, la posicion en la cadena de este lote si.
function BadgeIntegridad({ integridad, numeroBloqueRoto }) {
  if (integridad.integro) {
    return (
      <div className="badge-integridad badge-integridad--ok">
        <span className="badge-integridad__icono">✓</span>
        Cadena íntegra — sin alteraciones detectadas
      </div>
    );
  }

  const etiquetaEvento = ETIQUETAS_TIPO_EVENTO[integridad.tipo_evento] ?? integridad.tipo_evento;
  return (
    <div className="badge-integridad badge-integridad--alerta">
      <span className="badge-integridad__icono">⚠</span>
      Alteración detectada en el bloque #{numeroBloqueRoto ?? "?"} ({etiquetaEvento})
    </div>
  );
}

// Tarjeta tipo "block explorer": visualmente distinta de .linea-tiempo__card
// (fondo/borde con el tono --pub-accent-2 en vez de --pub-accent, fuente
// monoespaciada solo en los hashes) para que se note de un vistazo que esto
// es una vista tecnica/blockchain, no una repeticion de la linea de tiempo.
function TarjetaBloque({ bloque, numero, esUltimo }) {
  return (
    <li className="bloque-item">
      <div className="bloque-item__conector" aria-hidden="true">
        <span className="bloque-item__numero">#{numero}</span>
        {!esUltimo && <span className="bloque-item__linea" />}
      </div>

      <div className="bloque-card">
        <div className="bloque-card__encabezado">
          <span className="bloque-card__tipo">
            {ICONOS_TIPO_EVENTO[bloque.tipo_evento] ?? "🔗"}{" "}
            {ETIQUETAS_TIPO_EVENTO[bloque.tipo_evento] ?? bloque.tipo_evento}
          </span>
          <span className="bloque-card__timestamp">{bloque.timestamp}</span>
        </div>

        <FilaHash etiqueta="Hash de este bloque" hash={bloque.hash_actual} />
        <FilaHash etiqueta="Hash del bloque anterior ↑" hash={bloque.hash_anterior} />
      </div>
    </li>
  );
}

// Seccion completa: badge de integridad + lista de bloques en orden
// cronologico (el backend ya los devuelve ORDER BY id ASC, ver
// routes/trazabilidad.js). Se recibe `bloques`/`integridad` ya resueltos
// por la pagina contenedora -- este componente no hace fetch propio.
export function CadenaBloques({ bloques, integridad }) {
  if (bloques.length === 0) return null;

  const indiceRoto = integridad.integro
    ? -1
    : bloques.findIndex((b) => b.id === integridad.bloque_id);
  const numeroBloqueRoto = indiceRoto >= 0 ? indiceRoto + 1 : integridad.bloque_id;

  return (
    <div className="panel-publico panel-cadena-bloques">
      <h2 className="panel-publico__titulo">🔗 Cadena de bloques de este lote</h2>

      <BadgeIntegridad integridad={integridad} numeroBloqueRoto={numeroBloqueRoto} />

      <ol className="bloque-lista">
        {bloques.map((bloque, i) => (
          <TarjetaBloque
            key={bloque.id}
            bloque={bloque}
            numero={i + 1}
            esUltimo={i === bloques.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}
