import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Permite acceder via el host publico de ngrok (cambia en cada tunel
    // nuevo, asi que no tiene sentido listar uno fijo) -- solo para uso de
    // desarrollo/demo compartido, no en produccion.
    allowedHosts: true,
    // El frontend llama a rutas del backend en el mismo origen (ver
    // api.js, API_BASE_URL vacio) y Vite las reenvia a localhost:4000.
    // Esto permite exponer un unico tunel de ngrok (el del frontend) que
    // sirve tanto la UI como la API, sin necesitar un segundo tunel para
    // el backend.
    proxy: {
      "/api": "http://localhost:4000",
      // /trazabilidad/:codigo es, a proposito, la MISMA ruta en el
      // frontend (pagina React que un QR resuelve) y en el backend
      // (endpoint publico que esa pagina consume via fetch) -- ver
      // docs/CONTEXTO.md. Sin el `bypass`, cualquier navegacion real del
      // navegador a esa URL (no solo el fetch interno) tambien se
      // reenviaba al backend, devolviendo el JSON crudo en vez de la
      // pagina. El bypass deja pasar las navegaciones de pagina (Accept:
      // text/html) para que Vite sirva el SPA, y solo reenvia al backend
      // las llamadas fetch/XHR de la propia pagina.
      "/trazabilidad": {
        target: "http://localhost:4000",
        bypass(req) {
          if (req.headers.accept?.includes("text/html")) return req.url;
        },
      },
      "/catalogo": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
    },
  },
})
