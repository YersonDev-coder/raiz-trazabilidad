import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TemaProvider } from "./theme/TemaContext.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ProduccionNuevoPage } from "./pages/produccion/ProduccionNuevoPage.jsx";
import { ProduccionListaPage } from "./pages/produccion/ProduccionListaPage.jsx";
import { LandingPage } from "./pages/publico/LandingPage.jsx";
import { TrazabilidadPublicaPage } from "./pages/publico/TrazabilidadPublicaPage.jsx";
import { PerfilPage } from "./pages/panelProductor/PerfilPage.jsx";
import { ParcelasListaPage } from "./pages/panelProductor/ParcelasListaPage.jsx";
import { ParcelaNuevaPage } from "./pages/panelProductor/ParcelaNuevaPage.jsx";
import { ParcelaDetallePage } from "./pages/panelProductor/ParcelaDetallePage.jsx";
import { SeguimientoPage } from "./pages/panelProductor/SeguimientoPage.jsx";
import { EtapaValidarPage } from "./pages/etapas/EtapaValidarPage.jsx";
import { EtapaListaPage } from "./pages/etapas/EtapaListaPage.jsx";
import { AcopioNuevoPage } from "./pages/etapas/AcopioNuevoPage.jsx";
import { ProcesamientoNuevoPage } from "./pages/etapas/ProcesamientoNuevoPage.jsx";
import { ExportacionNuevoPage } from "./pages/etapas/ExportacionNuevoPage.jsx";
import { ConfiguracionSitioPage } from "./pages/admin/ConfiguracionSitioPage.jsx";
import { CrearUsuarioPage } from "./pages/admin/CrearUsuarioPage.jsx";
import { ValidarCertificacionesPage } from "./pages/admin/ValidarCertificacionesPage.jsx";
import "./App.css";

function App() {
  return (
    <TemaProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Publicas, sin login: catalogo/landing y ficha de trazabilidad */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/trazabilidad/:codigo" element={<TrazabilidadPublicaPage />} />

            <Route path="/login" element={<LoginPage />} />

            {/* Panel interno: requiere sesion */}
            <Route
              path="/panel"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Mi perfil: comun a cualquier rol autenticado (ver PanelLayout) */}
            <Route
              path="/panel/perfil"
              element={
                <ProtectedRoute>
                  <PerfilPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/panel/parcelas"
              element={
                <ProtectedRoute rolesPermitidos={["productor"]}>
                  <ParcelasListaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/panel/parcelas/nueva"
              element={
                <ProtectedRoute rolesPermitidos={["productor"]}>
                  <ParcelaNuevaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/panel/parcelas/:id"
              element={
                <ProtectedRoute rolesPermitidos={["productor"]}>
                  <ParcelaDetallePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/panel/seguimiento"
              element={
                <ProtectedRoute rolesPermitidos={["productor"]}>
                  <SeguimientoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/produccion/nuevo"
              element={
                <ProtectedRoute rolesPermitidos={["productor"]}>
                  <ProduccionNuevoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/produccion"
              element={
                <ProtectedRoute rolesPermitidos={["productor"]}>
                  <ProduccionListaPage />
                </ProtectedRoute>
              }
            />

            {/* Cooperativa: valida Produccion, registra Acopio */}
            <Route
              path="/produccion/validar"
              element={
                <ProtectedRoute rolesPermitidos={["cooperativa"]}>
                  <EtapaValidarPage
                    etapa="produccion"
                    titulo="Validar productores"
                    subtitulo="Registros de producción pendientes de aprobación"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acopio/nuevo"
              element={
                <ProtectedRoute rolesPermitidos={["cooperativa"]}>
                  <AcopioNuevoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acopio"
              element={
                <ProtectedRoute rolesPermitidos={["cooperativa"]}>
                  <EtapaListaPage etapa="acopio" titulo="Mis registros de acopio" nuevoTo="/acopio/nuevo" />
                </ProtectedRoute>
              }
            />

            {/* Planta de Procesamiento: valida Acopio, registra Procesamiento
                (decide ruta A/B, ver CONFIG_ETAPA.procesamiento) */}
            <Route
              path="/acopio/validar"
              element={
                <ProtectedRoute rolesPermitidos={["planta_procesamiento"]}>
                  <EtapaValidarPage
                    etapa="acopio"
                    titulo="Validar acopio"
                    subtitulo="Registros de acopio pendientes de aprobación"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/procesamiento/nuevo"
              element={
                <ProtectedRoute rolesPermitidos={["planta_procesamiento"]}>
                  <ProcesamientoNuevoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/procesamiento"
              element={
                <ProtectedRoute rolesPermitidos={["planta_procesamiento"]}>
                  <EtapaListaPage
                    etapa="procesamiento"
                    titulo="Mis registros de procesamiento"
                    nuevoTo="/procesamiento/nuevo"
                  />
                </ProtectedRoute>
              }
            />

            {/* Administrador: confirma que el trabajo de Planta (Procesamiento)
                quedo correcto antes de que el lote pase a Exportacion.
                Antes esto lo hacia SENASA (ver routes/procesamiento.js en
                el backend) -- la certificacion fitosanitaria en si ya NO se
                resuelve aca, se aprueba por separado en
                /certificaciones/validar, mas abajo. */}
            <Route
              path="/procesamiento/validar"
              element={
                <ProtectedRoute rolesPermitidos={["admin"]}>
                  <EtapaValidarPage
                    etapa="procesamiento"
                    titulo="Validar procesamiento"
                    subtitulo="Confirma el trabajo de Planta antes de que el lote pase a Exportación"
                  />
                </ProtectedRoute>
              }
            />

            {/* Exportador: registra Exportacion sobre lotes ya procesados */}
            <Route
              path="/exportacion/nuevo"
              element={
                <ProtectedRoute rolesPermitidos={["exportador"]}>
                  <ExportacionNuevoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exportacion"
              element={
                <ProtectedRoute rolesPermitidos={["exportador"]}>
                  <EtapaListaPage
                    etapa="exportacion"
                    titulo="Mis registros de exportación"
                    nuevoTo="/exportacion/nuevo"
                  />
                </ProtectedRoute>
              }
            />

            {/* Administrador: aprueba/rechaza la certificacion fitosanitaria y
                la documentacion aduanera que subio el Exportador -- antes
                esto lo hacian SENASA y SUNAT por separado (POST
                /:id/validar en routes/exportacion.js, ya inalcanzable a
                proposito, ver comentario ahi). Al aprobar ambas, el lote
                pasa a 'entregado'. */}
            <Route
              path="/certificaciones/validar"
              element={
                <ProtectedRoute rolesPermitidos={["admin"]}>
                  <ValidarCertificacionesPage />
                </ProtectedRoute>
              }
            />

            {/* Administrador: crear usuario nuevo (POST /api/auth/register,
                ya existia en el backend sin ningun frontend que lo usara) */}
            <Route
              path="/panel/usuarios/nuevo"
              element={
                <ProtectedRoute rolesPermitidos={["admin"]}>
                  <CrearUsuarioPage />
                </ProtectedRoute>
              }
            />

            {/* Administrador: configuracion del sitio (nombre + imagen del
                hero de la landing) */}
            <Route
              path="/panel/configuracion"
              element={
                <ProtectedRoute rolesPermitidos={["admin"]}>
                  <ConfiguracionSitioPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TemaProvider>
  );
}

export default App;
