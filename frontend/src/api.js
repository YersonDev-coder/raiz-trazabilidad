// En dev, mismo origen que el frontend: Vite (ver vite.config.js,
// server.proxy) reenvia /api, /trazabilidad, /catalogo y /uploads a
// localhost:4000. En produccion (Vercel + Render, ver render.yaml y
// vercel.json) el backend vive en otro dominio, asi que VITE_API_URL
// (definida como env var en Vercel) apunta ahi; sin definirla cae en el
// mismo origen, igual que antes.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function request(path, { method = "GET", token, body, signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let cuerpoFinal;
  if (body instanceof FormData) {
    // No fijar Content-Type: el navegador arma el boundary multipart solo.
    cuerpoFinal = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    cuerpoFinal = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: cuerpoFinal,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),

  crearParcela: (token, datos) => request("/api/parcelas", { method: "POST", token, body: datos }),
  listarParcelasMias: (token, signal) => request("/api/parcelas/mias", { token, signal }),
  subirFotoParcela: (token, parcelaId, formData) =>
    request(`/api/parcelas/${parcelaId}/fotos`, { method: "POST", token, body: formData }),

  crearLote: (token, datos) => request("/api/lotes", { method: "POST", token, body: datos }),
  listarLotes: (token, estadoMacro) =>
    request(`/api/lotes${estadoMacro ? `?estado_macro=${estadoMacro}` : ""}`, { token }),
  obtenerLotesMiosEstado: (token, signal) => request("/api/lotes/mios/estado", { token, signal }),
  // Mismo shape que obtenerTrazabilidad (ficha publica) pero autenticado y
  // sin el gate de certificacion aprobada -- usado por el boton "Descargar
  // PDF" de los paneles internos (ver lib/fichaPdf.js), que necesita
  // funcionar en cualquier etapa del lote, no solo cuando ya es publico.
  obtenerFichaLote: (token, loteId, signal) => request(`/api/lotes/${loteId}/ficha`, { token, signal }),

  crearRegistroProduccion: (token, datos) =>
    request("/api/registros/produccion", { method: "POST", token, body: datos }),
  listarRegistrosProduccion: (token, signal) =>
    request("/api/registros/produccion", { token, signal }),
  listarProduccionPendientes: (token) => request("/api/registros/produccion/pendientes", { token }),
  validarProduccion: (token, id) =>
    request(`/api/registros/produccion/${id}/validar`, { method: "POST", token }),
  subirFotosProduccion: (token, registroId, formData) =>
    request(`/api/registros/produccion/${registroId}/fotos`, { method: "POST", token, body: formData }),
  obtenerFotosProduccion: (token, registroId, signal) =>
    request(`/api/registros/produccion/${registroId}/fotos`, { token, signal }),

  crearRegistroAcopio: (token, datos) =>
    request("/api/registros/acopio", { method: "POST", token, body: datos }),
  listarRegistrosAcopio: (token) => request("/api/registros/acopio", { token }),

  // Genericos por etapa ("acopio" | "procesamiento" | "exportacion"):
  // reutilizados por las paginas genericas de Planta/SENASA/Exportador/SUNAT
  // (ver pages/etapas/), ya que el backend expone el mismo patron de rutas
  // para las 4 etapas (ver lib/etapaRouter.js). Produccion y Acopio ya
  // tenian metodos propios (arriba) usados por paginas hechas a mano antes
  // de que existiera este patron generico; se dejan tal cual para no
  // tocar codigo ya probado.
  listarRegistrosEtapa: (etapa, token, signal) => request(`/api/registros/${etapa}`, { token, signal }),
  listarPendientesEtapa: (etapa, token) => request(`/api/registros/${etapa}/pendientes`, { token }),
  crearRegistroEtapa: (etapa, token, datos) =>
    request(`/api/registros/${etapa}`, { method: "POST", token, body: datos }),
  // Generico para las 4 etapas (incluida "produccion": misma URL que sus
  // metodos dedicados de arriba, el backend lo sirve igual para las 4).
  // Usado por FormularioCorreccion para corregir y reenviar un rechazado.
  editarRegistroEtapa: (etapa, token, id, datos) =>
    request(`/api/registros/${etapa}/${id}`, { method: "PUT", token, body: datos }),
  validarRegistroEtapa: (etapa, token, id) =>
    request(`/api/registros/${etapa}/${id}/validar`, { method: "POST", token }),
  rechazarRegistroEtapa: (etapa, token, id, motivo) =>
    request(`/api/registros/${etapa}/${id}/rechazar`, { method: "POST", token, body: { motivo } }),

  // Certificacion fitosanitaria + documentacion aduanera del lote, subidas
  // por el Exportador junto con el registro de exportacion (mismo
  // mecanismo de subida que subirFotosProduccion, solo que aca acepta PDF
  // ademas de imagen -- ver lib/uploads.js).
  subirCertificacionesExportacion: (token, registroId, formData) =>
    request(`/api/registros/exportacion/${registroId}/certificaciones`, {
      method: "POST",
      token,
      body: formData,
    }),
  obtenerCertificacionesExportacion: (token, registroId, signal) =>
    request(`/api/registros/exportacion/${registroId}/certificaciones`, { token, signal }),
  // Corrige y reenvia UNA certificacion rechazada (tipo: "fitosanitaria" |
  // "aduanera") -- ver PUT /:id/certificaciones/:tipo en routes/exportacion.js.
  corregirCertificacionExportacion: (token, registroId, tipo, formData) =>
    request(`/api/registros/exportacion/${registroId}/certificaciones/${tipo}`, {
      method: "PUT",
      token,
      body: formData,
    }),

  // Reemplaza lo que antes hacian SENASA/SUNAT por separado -- ver
  // routes/certificaciones.js (Administrador aprueba/rechaza cada
  // certificacion de un lote de forma independiente).
  listarCertificacionesPendientes: (token, signal) =>
    request("/api/certificaciones/pendientes", { token, signal }),
  aprobarCertificacion: (token, loteId, tipo) =>
    request(`/api/certificaciones/${loteId}/${tipo}/aprobar`, { method: "POST", token }),
  rechazarCertificacion: (token, loteId, tipo, motivo) =>
    request(`/api/certificaciones/${loteId}/${tipo}/rechazar`, { method: "POST", token, body: { motivo } }),

  obtenerPerfil: (token, signal) => request("/api/usuarios/perfil", { token, signal }),
  actualizarPerfil: (token, formData) =>
    request("/api/usuarios/perfil", { method: "PUT", token, body: formData }),

  // Publico, sin token: tarjeta de perfil al hacer click en un actor de la
  // linea de tiempo de /trazabilidad/:codigo.
  obtenerActividadPublica: (usuarioId, signal) =>
    request(`/api/usuarios/${usuarioId}/actividad-publica`, { signal }),

  actualizarConfiguracionSitio: (token, formData) =>
    request("/api/admin/configuracion", { method: "PUT", token, body: formData }),

  // Solo Administrador (ver authorize("admin") en routes/auth.js). El
  // endpoint ya existia en el backend, sin usar desde ningun frontend.
  crearUsuario: (token, datos) =>
    request("/api/auth/register", { method: "POST", token, body: datos }),

  // Publicos: sin token, consumidos por la landing y la pagina de trazabilidad.
  obtenerCatalogo: (filtros = {}, signal) => {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
    ).toString();
    return request(`/catalogo${params ? `?${params}` : ""}`, { signal });
  },
  obtenerTrazabilidad: (codigo, signal) =>
    request(`/trazabilidad/${encodeURIComponent(codigo)}`, { signal }),
  obtenerCadenaLote: (codigo, signal) =>
    request(`/trazabilidad/${encodeURIComponent(codigo)}/cadena`, { signal }),
  obtenerConfiguracion: (signal) => request("/api/configuracion", { signal }),
};
