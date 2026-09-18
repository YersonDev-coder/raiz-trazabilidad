import { Link } from "react-router-dom";
import { API_BASE_URL } from "../../api.js";

const ICONO_PRODUCTO = { cafe: "☕", cacao: "🍫" };
const ETIQUETA_RUTA = { A: "Materia prima", B: "Valor agregado" };

function urlFoto(rutaRelativa) {
  return rutaRelativa.startsWith("http") ? rutaRelativa : `${API_BASE_URL}${rutaRelativa}`;
}

export function TarjetaProducto({ item }) {
  // Prioridad foto_url (armada en el backend, ver routes/catalogo.js):
  // evidencia de cosecha primero, galeria de parcela despues. Sin ninguna
  // de las dos (varios lotes de prueba viejos), cae al icono generico de
  // siempre -- no se rompe el layout, solo pierde la foto.
  return (
    <Link to={`/trazabilidad/${item.codigo}`} className="tarjeta-producto">
      <div
        className={`tarjeta-producto__imagen ${
          !item.foto_url ? `tarjeta-producto__imagen--${item.tipo_producto}` : ""
        }`}
      >
        <span className="tarjeta-producto__sello">Trazabilidad verificada</span>
        {item.foto_url ? (
          <img className="tarjeta-producto__foto" src={urlFoto(item.foto_url)} alt="" />
        ) : (
          ICONO_PRODUCTO[item.tipo_producto] ?? "🌱"
        )}
      </div>
      <div className="tarjeta-producto__cuerpo">
        <div className="tarjeta-producto__encabezado">
          <span className="tarjeta-producto__variedad">{item.variedad}</span>
          {item.ruta && (
            <span className={`badge-ruta badge-ruta--${item.ruta.toLowerCase()}`}>
              {ETIQUETA_RUTA[item.ruta] ?? item.ruta}
            </span>
          )}
        </div>
        <span className="tarjeta-producto__meta">👤 {item.productor_nombre}</span>
        <span className="tarjeta-producto__meta">📍 {item.zona}</span>
        {item.certificaciones_aprobadas > 0 && (
          <span className="tarjeta-producto__certificaciones">
            ✓ {item.certificaciones_aprobadas} certificación(es)
          </span>
        )}
      </div>
      <div className="tarjeta-producto__cta">Ver trazabilidad completa →</div>
    </Link>
  );
}
