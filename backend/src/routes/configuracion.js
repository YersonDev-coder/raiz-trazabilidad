import { Router } from "express";
import { obtenerConfiguracion } from "../lib/configuracion.js";

const router = Router();

// Publico, sin autenticacion: la landing lo consume para pintar su nombre
// e imagen de fondo.
router.get("/", (req, res) => {
  res.json({ configuracion: obtenerConfiguracion() });
});

export default router;
