import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        TEXT PRIMARY KEY,
    applied_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const applied = new Set(
  db.prepare("SELECT name FROM schema_migrations").all().map((row) => row.name)
);

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log("No hay migraciones pendientes.");
} else {
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(file);
      db.exec("COMMIT");
      console.log(`Aplicada: ${file}`);
    } catch (err) {
      db.exec("ROLLBACK");
      console.error(`Fallo aplicando ${file}:`, err.message);
      process.exit(1);
    }
  }
  console.log(`${pending.length} migracion(es) aplicada(s).`);
}
