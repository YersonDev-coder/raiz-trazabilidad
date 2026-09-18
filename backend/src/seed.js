import bcrypt from "bcryptjs";
import db from "./db.js";

const SEED_PASSWORD = "Test1234!";

const USUARIOS = [
  { nombre: "Juan Quispe", email: "productor1@raiz.test", rol: "productor" },
  { nombre: "Maria Huaman", email: "productor2@raiz.test", rol: "productor" },

  { nombre: "Cooperativa Alto Huallaga", email: "cooperativa1@raiz.test", rol: "cooperativa" },
  { nombre: "Cooperativa Tingo Maria", email: "cooperativa2@raiz.test", rol: "cooperativa" },

  { nombre: "Planta Procesadora Huanuco", email: "planta1@raiz.test", rol: "planta_procesamiento" },
  { nombre: "Planta Procesadora Leoncio Prado", email: "planta2@raiz.test", rol: "planta_procesamiento" },

  { nombre: "Inspector SENASA Huanuco", email: "senasa1@raiz.test", rol: "senasa" },
  { nombre: "Inspector SENASA Tingo Maria", email: "senasa2@raiz.test", rol: "senasa" },

  { nombre: "Exportadora Andina SAC", email: "exportador1@raiz.test", rol: "exportador" },
  { nombre: "Exportadora Selva Alta SAC", email: "exportador2@raiz.test", rol: "exportador" },

  { nombre: "Agente SUNAT Callao", email: "sunat1@raiz.test", rol: "sunat" },
  { nombre: "Agente SUNAT Huanuco", email: "sunat2@raiz.test", rol: "sunat" },

  { nombre: "Administrador Raiz", email: "admin1@raiz.test", rol: "admin" },
  { nombre: "Administrador Soporte", email: "admin2@raiz.test", rol: "admin" },
];

const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

const insert = db.prepare(`
  INSERT INTO usuarios (nombre, email, password_hash, rol)
  VALUES (@nombre, @email, @password_hash, @rol)
  ON CONFLICT(email) DO NOTHING
`);

let created = 0;
for (const u of USUARIOS) {
  const info = insert.run({ ...u, password_hash: passwordHash });
  if (info.changes > 0) created++;
}

console.log(`Seed completo: ${created} usuario(s) nuevo(s) de ${USUARIOS.length} definidos.`);
console.log(`Password de prueba para todos: "${SEED_PASSWORD}"`);
