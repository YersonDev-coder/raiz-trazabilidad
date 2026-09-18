import express from "express";
import cors from "cors";
import db from "./db.js";
import { UPLOADS_DIR } from "./lib/uploads.js";
import authRouter from "./routes/auth.js";
import lotesRouter from "./routes/lotes.js";
import parcelasRouter from "./routes/parcelas.js";
import produccionRouter from "./routes/produccion.js";
import acopioRouter from "./routes/acopio.js";
import procesamientoRouter from "./routes/procesamiento.js";
import exportacionRouter from "./routes/exportacion.js";
import correccionesRouter from "./routes/correcciones.js";
import certificacionesRouter from "./routes/certificaciones.js";
import trazabilidadRouter from "./routes/trazabilidad.js";
import catalogoRouter from "./routes/catalogo.js";
import usuariosRouter from "./routes/usuarios.js";
import adminRouter from "./routes/admin.js";
import configuracionRouter from "./routes/configuracion.js";

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";

// FRONTEND_URL admite una o varias origenes separadas por coma (util para
// tener a la vez el dominio de produccion de Vercel y sus preview deploys).
// Sin definir, cae en cors() abierto (comportamiento previo, solo para dev).
const origenesPermitidos = process.env.FRONTEND_URL?.split(",").map((s) => s.trim());
app.use(cors(origenesPermitidos ? { origin: origenesPermitidos } : undefined));
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (req, res) => {
  const row = db.prepare("SELECT 1 AS ok").get();
  res.json({ status: "ok", db: row.ok === 1 });
});

app.use("/api/auth", authRouter);
app.use("/api/lotes", lotesRouter);
app.use("/api/parcelas", parcelasRouter);
app.use("/api/registros/produccion", produccionRouter);
app.use("/api/registros/acopio", acopioRouter);
app.use("/api/registros/procesamiento", procesamientoRouter);
app.use("/api/registros/exportacion", exportacionRouter);
app.use("/api/correcciones", correccionesRouter);
app.use("/api/certificaciones", certificacionesRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/admin", adminRouter);

// Publico, sin autenticacion: es la URL que resuelve el QR.
app.use("/trazabilidad", trazabilidadRouter);
app.use("/catalogo", catalogoRouter);
app.use("/api/configuracion", configuracionRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "Error interno";
  if (err.code === "LIMIT_FILE_SIZE") status = 400;
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    status = 400;
    message = "Demasiados archivos: supera el maximo permitido";
  }
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(PORT, HOST, () => {
  console.log(`Raiz backend escuchando en el puerto ${PORT}`);
});
