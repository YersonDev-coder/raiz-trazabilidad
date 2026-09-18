import crypto from "node:crypto";

const PREFIJO_PRODUCTO = { cafe: "CAF", cacao: "CAC" };

export function generarCodigoLote(tipoProducto) {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sufijo = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RZ-${PREFIJO_PRODUCTO[tipoProducto]}-${fecha}-${sufijo}`;
}
