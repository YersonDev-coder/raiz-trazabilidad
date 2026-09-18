import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR apunta al disco persistente de Render (ver render.yaml); sin
// definir, cae en backend/db como en desarrollo local.
const DB_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, "db") : path.join(__dirname, "..", "db");
const DB_PATH = path.join(DB_DIR, "raiz.sqlite");

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

export default db;
