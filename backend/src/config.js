const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-do-not-use-in-production";

if (!process.env.JWT_SECRET) {
  console.warn(
    "JWT_SECRET no esta definido en el entorno. Usando un secreto de desarrollo " +
      "inseguro. Define JWT_SECRET en backend/.env antes de desplegar."
  );
}

export const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// ROLES_REGISTRABLES es el subconjunto de roles que POST /api/auth/register
// puede crear -- ya no incluye 'senasa' ni 'sunat' (eliminados del flujo de
// login, ver routes/auth.js: el Administrador ahora valida directamente lo
// que sube el Exportador, ver routes/certificaciones.js). El CHECK de la
// columna `rol` en la migracion 001_create_usuarios.sql SIGUE incluyendo
// esos dos valores a proposito -- usuarios ya existentes con esos roles
// (desactivados, no borrados, ver migracion 028) conservan su fila tal
// cual, solo se les impide volver a loguearse y no se pueden crear cuentas
// nuevas con esos roles.
export const ROLES_REGISTRABLES = ["productor", "cooperativa", "planta_procesamiento", "exportador", "admin"];
