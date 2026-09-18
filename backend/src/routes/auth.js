import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";
import { JWT_SECRET, JWT_EXPIRES_IN, ROLES_REGISTRABLES } from "../config.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email y password son requeridos" });
  }

  const user = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email);
  // Mismo mensaje generico tanto si el usuario no existe, la contraseña no
  // coincide, o la cuenta esta desactivada (migracion 028) -- no se
  // distingue el motivo para no filtrar informacion sobre que cuentas
  // existen o por que dejaron de poder entrar.
  if (!user || !user.activo || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    token,
    usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
});

router.get("/me", authenticate, (req, res) => {
  res.json({ usuario: req.user });
});

// Solo el Administrador da de alta cuentas nuevas (Productor, Cooperativa, etc.)
router.post("/register", authenticate, authorize("admin"), (req, res) => {
  const { nombre, email, password, rol } = req.body ?? {};
  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: "nombre, email, password y rol son requeridos" });
  }
  if (!ROLES_REGISTRABLES.includes(rol)) {
    return res
      .status(400)
      .json({ error: `rol invalido. Debe ser uno de: ${ROLES_REGISTRABLES.join(", ")}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const existente = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (existente) {
    return res.status(409).json({ error: "Ya existe un usuario con ese email" });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)")
    .run(nombre, email, password_hash, rol);

  // codigo_productor: identificador corto interno (PROD-0001), solo para
  // rol productor -- basado en el id ya asignado, mismo formato que el
  // backfill de la migracion 023 para los productores creados antes de
  // esto. Nunca se expone en ningun endpoint publico (ver
  // routes/trazabilidad.js y GET /:id/actividad-publica en este archivo).
  if (rol === "productor") {
    const codigoProductor = `PROD-${String(info.lastInsertRowid).padStart(4, "0")}`;
    db.prepare("UPDATE usuarios SET codigo_productor = ? WHERE id = ?").run(
      codigoProductor,
      info.lastInsertRowid
    );
  }

  db.prepare(
    "INSERT INTO auditoria (usuario_id, accion, entidad_afectada, entidad_id) VALUES (?, ?, ?, ?)"
  ).run(req.user.id, "crear_usuario", "usuarios", info.lastInsertRowid);

  res.status(201).json({
    usuario: { id: info.lastInsertRowid, nombre, email, rol },
  });
});

export default router;
