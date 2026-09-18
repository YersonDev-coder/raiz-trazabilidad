import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR apunta al disco persistente de Render (ver render.yaml); sin
// definir, cae en backend/uploads como en desarrollo local.
export const UPLOADS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "uploads")
  : path.join(__dirname, "..", "..", "uploads");

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TIPOS_DOCUMENTO_PERMITIDOS = new Set([...TIPOS_PERMITIDOS, "application/pdf"]);
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

function storageEn(subcarpeta) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const destino = path.join(UPLOADS_DIR, subcarpeta);
      fs.mkdirSync(destino, { recursive: true });
      cb(null, destino);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
    },
  });
}

// Factory: un uploader de imagenes por subcarpeta (parcelas, perfiles, sitio).
// Nombre de archivo aleatorio (evita colisiones y no expone el nombre
// original); valida tipo MIME y tamano maximo.
export function crearUploaderImagen(subcarpeta) {
  return multer({
    storage: storageEn(subcarpeta),
    limits: { fileSize: TAMANO_MAXIMO },
    fileFilter(req, file, cb) {
      if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
        return cb(Object.assign(new Error("Solo se permiten imagenes JPG, PNG, WEBP o GIF"), { status: 400 }));
      }
      cb(null, true);
    },
  });
}

// Mismo mecanismo que crearUploaderImagen (misma storageEn, mismo limite de
// tamano, mismo nombre de archivo aleatorio) -- solo cambia la whitelist de
// tipos MIME para aceptar tambien PDF. Pensado para certificados/documentos
// (fitosanitario, aduanero, ver routes/exportacion.js), que llegan como
// escaneo/foto o como PDF exportado, indistintamente.
export function crearUploaderDocumento(subcarpeta) {
  return multer({
    storage: storageEn(subcarpeta),
    limits: { fileSize: TAMANO_MAXIMO },
    fileFilter(req, file, cb) {
      if (!TIPOS_DOCUMENTO_PERMITIDOS.has(file.mimetype)) {
        return cb(
          Object.assign(new Error("Solo se permiten PDF o imagenes JPG, PNG, WEBP o GIF"), { status: 400 })
        );
      }
      cb(null, true);
    },
  });
}

// Ruta relativa que el frontend antepone a su propio API_BASE_URL (mismo
// criterio que el resto del API: no se guardan URLs absolutas en la BD).
export function urlPublica(subcarpeta, filename) {
  return `/uploads/${subcarpeta}/${filename}`;
}
