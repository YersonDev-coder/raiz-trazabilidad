# Raíz — Contexto del Proyecto

Plataforma web de trazabilidad de café y cacao para la región Huánuco, Perú.
Proyecto de tesis universitaria.

Este documento existe para que cualquier sesión futura (humana o de IA) pueda
recuperar el contexto completo del sistema sin que el usuario tenga que
repetirlo.

## Contexto general del sistema

Es un sistema **convencional** (NO blockchain, NO smart contracts, NO
hash-chain). La inmutabilidad se logra con **reglas de negocio normales**, no
con criptografía.

## Actores (roles y permisos distintos)

1. **Productor** — registra cosecha de su parcela.
2. **Cooperativa / Centro de Acopio** — recibe y pesa el lote, valida al
   Productor.
3. **Planta de Procesamiento** — transforma el producto, valida a la
   Cooperativa.
4. **SENASA** — valida certificación fitosanitaria de la Planta (NO registra
   documentos propios, solo aprueba/rechaza lo que sube la Planta).
5. **Exportador** — registra embarque y documentación.
6. **SUNAT** — valida documentación aduanera del Exportador (NO registra
   documentos propios, solo aprueba/rechaza).
7. **Administrador** — gestión total, puede ver/intervenir todo.
8. **Comprador / público general** — solo consulta de lectura, sin login, vía
   código QR o catálogo web.

## Modelo de estados (núcleo del sistema)

### Nivel MACRO — estado del lote completo

Avanza de forma **secuencial y estricta**, no se puede saltar etapas:

```
Producción → Acopio → Procesamiento → Certificación Sanitaria → Exportación → Entregado
```

### Nivel MICRO — estado de cada registro individual dentro de una etapa

```
Borrador (editable SOLO por quien lo creó) → Validado (se congela, nadie lo edita, ni su creador)
```

### Manejo de errores post-validación

Si después de "Validado" se descubre un error, **NO se edita el registro
original**. Se crea un registro de **"Corrección"** nuevo:

- Enlazado al original por una referencia (ID).
- Con motivo y autor de la corrección.
- El original **nunca se borra ni se sobreescribe**.

Esto reemplaza la inmutabilidad que blockchain daría automáticamente.

### Tabla de quién valida a quién

| Etapa (rol que registra)         | Rol que valida            |
|-----------------------------------|----------------------------|
| Producción (Productor)            | Cooperativa                |
| Acopio (Cooperativa)               | Planta de Procesamiento    |
| Procesamiento (Planta)             | SENASA                     |
| Exportación (Exportador)           | SUNAT                      |

## Dos rutas de exportación

La decisión de ruta se toma en la **Planta de Procesamiento**, no antes, no
después.

### Ruta A — Materia prima

El lote sale de Perú como grano/almendra sin transformar (café verde en
sacos, cacao en almendra seca en sacos).

- El **QR se genera AL FINAL**, en la etapa de **Exportador**.
- Uno por **lote/contenedor**.

### Ruta B — Valor agregado

La Planta de Procesamiento transforma el producto hasta unidad de consumo
(café tostado y envasado en bolsas, o cacao hasta chocolate de barra
terminado).

- El **QR se genera EN LA PLANTA DE PROCESAMIENTO**, al momento del envasado.
- **Uno por cada unidad individual** (no por lote).
- El Exportador en esta ruta **NO genera QR nuevos**, solo asocia los que ya
  existen al envío.

## Stack técnico

- **Backend:** Node.js + Express, puerto 4000, escuchando en `0.0.0.0`.
- **Frontend:** Vite + React, puerto 5173, con `--host` para acceso desde
  celular en la misma red.
- **Base de datos:** SQLite (usando el módulo nativo `node:sqlite`,
  disponible en Node 22.5+/24, sin dependencias nativas externas).
- El frontend detecta `window.location.hostname` dinámicamente para que
  funcione tanto desde `localhost` como desde la IP local (celular).

## Estado actual del proyecto

- Esqueleto de backend (Express) y frontend (Vite+React) corriendo.
- **Modelo de datos completo en SQLite** (`backend/db/migrations/*.sql`,
  12 tablas: usuarios, parcelas, lotes, registros_produccion,
  registros_acopio, registros_procesamiento, registros_transformacion,
  registros_exportacion, certificaciones, correcciones, codigos_qr,
  auditoria). Runner de migraciones casero en `backend/src/migrate.js`
  (tabla `schema_migrations` para trackear qué se aplicó). Seed de 14
  usuarios de prueba (2 por rol, password `Test1234!`) en
  `backend/src/seed.js`. Comandos: `npm run migrate`, `npm run seed`
  (ambos idempotentes).
- **Autenticación implementada**: login con email/password devuelve JWT
  (`POST /api/auth/login`), endpoint `GET /api/auth/me` para inspeccionar el
  token, y `POST /api/auth/register` restringido a rol `admin` para dar de
  alta cuentas nuevas. Middleware RBAC en
  `backend/src/middleware/auth.js` (`authenticate` + `authorize(...roles)`)
  reutilizable por cualquier endpoint futuro. Config de JWT en
  `backend/src/config.js`, secreto en `backend/.env` (gitignored, ver
  `.env.example`).
- **Endpoints de negocio implementados** (`backend/src/routes/`):
  - `POST /api/lotes` (Productor) — genera `codigo_unico`, `estado_macro`
    arranca en `produccion`, `ruta` queda NULL hasta Procesamiento.
  - `POST /api/parcelas` (Productor) — mínimo necesario para poder crear
    `registros_produccion` (no estaba pedido explícitamente, pero es
    requisito de la FK).
  - `POST /api/registros/{produccion,acopio,procesamiento,exportacion}` —
    crea en `borrador`, solo si `lotes.estado_macro` ya está en esa etapa.
  - `PUT /api/registros/<etapa>/:id` — solo si `estado='borrador'` y el
    usuario es el `actor_id` que lo creó.
  - `POST /api/registros/<etapa>/:id/validar` — solo el rol validador de la
    tabla "quién valida a quién"; al validar, avanza `lotes.estado_macro` a
    la siguiente etapa (esto es lo que bloquea el salto de etapas).
  - Las 4 rutas de etapa comparten una factory
    (`backend/src/lib/etapaRouter.js`) porque el patrón
    borrador/validado/RBAC/avance-de-macro-estado es idéntico en las 4; solo
    cambian tabla, campos y hooks propios (dueño de parcela en producción,
    decisión de ruta A/B en procesamiento).
  - **Decisión de alcance**: como todavía no hay endpoint para
    `certificaciones`, validar `registros_procesamiento` (rol SENASA) avanza
    el lote directo de `procesamiento` a `exportacion`, saltándose el estado
    `certificacion_sanitaria` del enum. Se decidió así porque
    `registros_procesamiento.validado_por` YA ES la certificación
    fitosanitaria de SENASA (ver comentario en la migración 006). Cuando se
    implemente el endpoint de `certificaciones`, separar en dos pasos sin
    romper lo ya construido.
  - `registros_transformacion` (solo Ruta B) y `codigos_qr` **aún no tienen
    endpoints** — quedan para una sesión futura.
  - `POST /api/correcciones` — abierto a cualquier rol autenticado, exige
    que el registro original exista y esté `validado`; nunca toca el
    original. Whitelist de tablas corregibles: las 4 tablas de registro de
    etapa.
- **Endpoint público implementado**: `GET /trazabilidad/:codigo`
  (`backend/src/routes/trazabilidad.js`), montado en `/trazabilidad` (sin
  `/api`, sin `authenticate`) para que sea la URL literal que un QR
  resuelve. Busca primero en `codigos_qr.codigo` (nivel lote/unidad, aunque
  esa tabla todavía no tiene endpoint que la llene) y si no hay match cae a
  `lotes.codigo_unico` (lo único generable hoy). **Gating**: solo responde
  si existe un `registros_procesamiento` con `estado='validado'` para ese
  lote (se verifica el registro directamente, no el string de
  `estado_macro`, para no depender de la simplificación de saltar
  `certificacion_sanitaria`); si no, 404. Devuelve línea de tiempo (una
  entrada por etapa validada, con fecha y usuario validador), parcela con
  GPS, `transformacion` (solo si `ruta='B'` y existe un registro validado —
  hoy siempre `null` porque no hay endpoint para esa tabla todavía),
  `certificaciones` (hoy siempre `[]`, mismo motivo), y `fotos: []` (**no
  existe almacenamiento de fotos en el modelo de datos** — pendiente si se
  quiere agregar).
- **Endpoints GET agregados** (necesarios para el frontend, no pedidos
  explícitamente antes): `GET /api/parcelas` (propias del productor) y un
  `GET /` genérico agregado a la factory `etapaRouter.js` (propios del
  actor, JOIN con `lotes` para traer `codigo_unico` y `estado_macro` sin
  round-trips extra) — heredado automáticamente por las 4 rutas de etapa.
- **Frontend implementado** (React Router + Context API, sin librería de
  estado externa):
  - `src/auth/AuthContext.jsx` — token + usuario en `localStorage`,
    persiste la sesión entre recargas.
  - `src/api.js` — cliente fetch con `Authorization: Bearer` automático.
  - `src/components/ProtectedRoute.jsx` — redirige a `/login` si no hay
    sesión, y a `/` si el rol no está en `rolesPermitidos` (RBAC también en
    el frontend, no solo en el backend).
  - `LoginPage` (`/login`), `DashboardPage` (`/`) — data-driven por rol
    (`ACCIONES_POR_ROL`): Productor tiene links reales a
    `/produccion/nuevo` y `/produccion`; el resto de roles ven sus acciones
    listadas pero marcadas "Próximamente" (para validar el patrón sin
    construir esas pantallas todavía, tal como se pidió).
  - `ProduccionNuevoPage` (`/produccion/nuevo`) — "Registrar cosecha":
    dropdowns de variedad (según café/cacao) y zona
    (`src/constants/catalogos.js`, sin texto libre), captura GPS con
    `navigator.geolocation.getCurrentPosition` (sin EXIF), selector de
    parcela existente o creación de una nueva. Al enviar, encadena
    `POST /api/parcelas` (si es nueva) → `POST /api/lotes` →
    `POST /api/registros/produccion` en una sola acción de usuario (el
    Productor no ve las 3 llamadas, solo "Registrar cosecha").
  - `ProduccionListaPage` (`/produccion`) — consume el nuevo
    `GET /api/registros/produccion`, muestra estado borrador/validado con
    badge de color y fecha de validación.
  - Probado de punta a punta con Chrome (login, dashboard por rol,
    creación de parcela nueva con GPS real capturado, cambio de dropdown
    café↔cacao, lista mostrando borrador y validado). Se corrigió en el
    camino un bug de `line-height` heredado en `h1` (index.css del
    scaffold de Vite) que causaba superposición de texto cuando el título
    envolvía a 2 líneas.
  - Roles distintos de Productor y Cooperativa (planta, senasa, exportador,
    sunat, admin) **aún no tienen pantallas propias** — solo aparecen en el
    Dashboard como "Próximamente".

### Cooperativa (segundo rol con pantallas — patrón replicado)

- **Backend, dos endpoints genéricos nuevos** (se agregan una vez y quedan
  disponibles para las 4 etapas, no solo Cooperativa):
  - `GET /api/registros/<etapa>/pendientes` — agregado a la factory
    `etapaRouter.js`. Lista los registros en `borrador` para `rolValidador`
    (JOIN con `lotes` y `usuarios` para mostrar código de lote y nombre de
    quien lo creó). No filtra por "quién validará" específico, cualquier
    usuario del rol validador puede tomar cualquier pendiente — mismo
    criterio que ya usaba `POST /:id/validar`.
  - `GET /api/lotes?estado_macro=<etapa>` — para poblar el selector de
    "sobre qué lote registro esto" cuando el actor no es quien creó el
    lote (Cooperativa no crea lotes, solo los recibe una vez que
    Producción fue validada).
- **Frontend**:
  - `ProduccionValidarPage` (`/produccion/validar`, rol `cooperativa`) —
    consume `GET /api/registros/produccion/pendientes`, botón "Validar"
    por fila que llama `POST /api/registros/produccion/:id/validar` y
    quita la fila de la lista al confirmar (sin recargar toda la página).
  - `AcopioNuevoPage` (`/acopio/nuevo`) y `AcopioListaPage` (`/acopio`) —
    mismo patrón exacto que Producción: selector de lote (solo los que ya
    están en etapa `acopio`), formulario con peso/humedad/fecha, y lista
    de "mis registros" con badge de estado.
  - `DashboardPage` actualizado: las 2 acciones de Cooperativa ahora son
    links reales en vez de "Próximamente".
  - Probado de punta a punta en Chrome: validar un registro de producción
    pendiente (desaparece de la lista), y registrar acopio sobre ese mismo
    lote (aparece en "Mis registros de acopio" como Borrador).
  - **Nota de arquitectura para las próximas etapas**: este mismo patrón
    (pantalla de pendientes + formulario propio + lista propia) se debe
    repetir para Planta/SENASA/Exportador/SUNAT. Los endpoints genéricos
    (`/pendientes`, `GET /api/lotes?estado_macro=`) ya están listos para
    reutilizarse sin cambios.

### Landing pública + catálogo + trazabilidad visual

- **Reestructuración de rutas importante**: `/` ahora es la **landing
  pública** (sin login). El panel interno que antes vivía en `/` se movió a
  `/panel`. Se actualizó `LoginPage` (redirige a `/panel` si ya hay sesión,
  y navega ahí tras login), `Layout.jsx` (el link "Raíz" apunta a
  `/panel`), y `ProtectedRoute.jsx` (el redirect por rol incorrecto iba a
  `/`, que ahora es público — se corrigió a `/panel`, si no las páginas
  internas por rol habrían mandado a un usuario con rol equivocado al
  catálogo público en vez de a su panel).
- **Backend**: `GET /catalogo` (público, `backend/src/routes/catalogo.js`,
  montado en `/catalogo` sin `/api`). Mismo gating que
  `/trazabilidad/:codigo` (requiere `registros_procesamiento` validado).
  Filtros opcionales por query string: `tipo_producto`, `ruta`, `zona`.
  Devuelve `codigo, tipo_producto, ruta, variedad, zona, productor_nombre,
  certificaciones_aprobadas` por lote (join con `registros_produccion`,
  `parcelas`, `usuarios`).
- **Frontend — paleta y diseño**: `src/styles/publico.css`, paleta cálida
  café/cacao (crema/marrones/terracota/dorado) **separada a propósito** del
  tema morado/oscuro del panel interno (son audiencias distintas). Soporta
  claro/oscuro vía `prefers-color-scheme`, todo bajo una clase `.publico`
  para no chocar con `App.css`/`index.css` del panel interno.
- **`LandingPage`** (`/`): hero institucional + catálogo tipo marketplace
  (`TarjetaProducto`) con filtros (chips de producto/ruta + select de
  zona) que refetchean `GET /catalogo` con query params reales.
- **`TrazabilidadPublicaPage`** (`/trazabilidad/:codigo`): consume el
  mismo `GET /trazabilidad/:codigo` ya construido. Incluye:
  - Línea de tiempo visual (iconos por etapa, fecha, validador, detalle).
  - Mapa real de la parcela vía iframe de `openstreetmap.org/export/embed.html`
    (sin API key, sin librería nueva — se prefirió sobre Leaflet/Google
    Maps por simplicidad, dado que ya hay bastante superficie nueva en
    este turno).
  - QR generado **en el cliente** con la librería `qrcode` (codifica la
    URL de la propia ficha) y botón "Descargar ficha en PDF" con `jspdf`
    (adjunta el QR + línea de tiempo). Probado de punta a punta: el PDF se
    descarga y su contenido es correcto.
  - **Decisión importante sobre datos faltantes**: como no existe
    almacenamiento de fotos ni hay `certificaciones` pobladas (sección
    "Estado actual" más arriba), la página muestra honestamente "Aún no
    hay fotos/certificaciones disponibles" en vez de inventar contenido de
    relleno (stock photos, badges falsos). Las tarjetas del catálogo usan
    un ícono ilustrado (☕/🍫) en vez de una "foto" real, por la misma
    razón — no hay fotos reales que mostrar todavía.
- Solo aparecen en el catálogo lotes con `registros_procesamiento`
  validado (mismo criterio que trazabilidad) — verificado con el único
  lote real que llegó a esa etapa, y confirmando que un lote en
  `produccion`/`acopio` no aparece.
- Probado de punta a punta en Chrome: landing con filtros, click en
  tarjeta → ficha de trazabilidad con mapa real renderizado, descarga de
  PDF verificada abriendo el archivo generado, y confirmado que el login
  interno (`/login` → `/panel`) sigue funcionando tras la reestructuración
  de rutas.

### Rediseño visual de la landing (hero + institucional + catálogo)

- **Hero a pantalla completa**: imagen de fondo real (foto de plantación de
  café, libre de derechos de Unsplash — URL comentada en
  `LandingPage.jsx` como placeholder TEMPORAL hasta que el Admin suba la
  suya real) con velo oscuro fijo (no depende de claro/oscuro, igual que el
  sidebar del panel Productor de mas abajo). `nombre_plataforma` (de
  `GET /api/configuracion`) es el elemento tipográfico dominante (hasta
  92px). El texto institucional largo que antes competia con el hero se
  movió a su propia sección "Quiénes somos / Qué hacemos" despues del
  hero, acompañada de un diagrama visual de la cadena
  (Producción→Acopio→Procesamiento→Exportación).
- Catálogo con tarjetas mas "premium": sello "Trazabilidad verificada",
  metadatos con iconos, CTA explicito "Ver trazabilidad completa →".
- `api.obtenerConfiguracion()` agregado a `api.js` para que la landing
  consuma nombre e imagen de fondo dinamicamente.

### Parcela como entidad propia, perfil de usuario, config del sitio, subida de imágenes (solo backend)

- **Hallazgo importante**: `registros_produccion` **nunca guardó
  ubicación embebida** — desde el inicio solo tiene `parcela_id` (FK), la
  ubicación siempre vivió en `parcelas`. Por eso **no hizo falta migrar
  datos existentes**: el modelo ya estaba normalizado, lo único que
  faltaba era dejar de crear la parcela "de paso" en el mismo formulario
  (eso es tarea de frontend, no tocado en este turno).
- **`multer` agregado** (`backend/src/lib/uploads.js`,
  `crearUploaderImagen(subcarpeta)`): nombre de archivo aleatorio (evita
  colisiones/no expone el original), valida tipo MIME
  (jpg/png/webp/gif) y tamaño máximo 5MB. `/uploads` servido como estático
  en `server.js`. Errores de multer (tipo inválido, tamaño excedido) via
  el mismo manejador de errores global (`err.status` / `err.code ===
  'LIMIT_FILE_SIZE'` → 400).
- **Migraciones 013-016**: `parcelas.tipo_cultivo` (nullable, CHECK
  cafe/cacao/ambos — NULL en parcelas creadas antes de este cambio, no se
  puede inferir retroactivamente), tabla `fotos_parcela` (galería general
  de la parcela, distinta de futuras fotos de evidencia por cosecha),
  `usuarios.foto_perfil_url` + `usuarios.nombre_publico` (disponibles para
  cualquier rol, no solo Productor — es cosmético y no vale la pena
  restringirlo por rol a nivel de columna), tabla `configuracion_sitio`
  (clave/valor simple, con 2 filas default: `nombre_plataforma='Raíz'`,
  `imagen_fondo_landing_url=NULL`).
- **Endpoints nuevos**:
  - `POST /api/parcelas` ahora acepta `tipo_cultivo`.
  - `GET /api/parcelas/mias` — alias explícito de `GET /api/parcelas`
    (mismo handler `listarPropias`); se mantiene `GET /api/parcelas` tal
    cual porque el frontend ya construido lo consume y no se toca en este
    turno.
  - `POST /api/parcelas/:id/fotos` — sube a la galería de la parcela
    (campo multipart `foto`), valida dueño ANTES de invocar multer (para
    no escribir el archivo a disco si la parcela no es del usuario).
  - `GET/PUT /api/usuarios/perfil` — el usuario autenticado edita su
    propio `nombre_publico` y/o sube `foto_perfil_url` (multipart, campo
    `foto`); ambos opcionales, actualización parcial.
  - `PUT /api/admin/configuracion` (solo `admin`) y
    `GET /api/configuracion` (público) — nombre de plataforma + imagen de
    fondo de la landing, upsert simple sobre `configuracion_sitio`.
  - `GET /api/lotes/mios/estado` (solo `productor`) — "dónde está mi
    cosecha": etapa macro de cada lote propio (join por
    `registros_produccion.actor_id`) + `tiene_qr` (siempre `false` hoy,
    honesto, porque `codigos_qr` sigue sin endpoint que la llene).
  - Todas las respuestas de parcela ahora incluyen `fotos: []` (o con
    contenido si ya subió alguna).
- Probado de punta a punta con curl: creación con `tipo_cultivo`,
  rechazo de valor inválido, `/mias`, subida de foto (éxito, rechazo por
  dueño incorrecto, rechazo por tipo de archivo no-imagen), perfil
  (GET, PUT parcial con y sin foto, rechazo si no hay nada que
  actualizar), configuración (público con defaults, rechazo no-admin,
  actualización admin reflejada en el endpoint público), y
  `/api/lotes/mios/estado` (con datos reales y rechazo de rol
  incorrecto). **Nota de testing**: un `curl -F` con acentos (`Raíz`,
  `Huánuco`) se corrompió por la codificación de Git Bash en Windows, no
  por el backend — confirmado reproduciendo la misma llamada con
  `fetch`/`FormData` desde Node, que sí preserva UTF-8 correctamente.
- **Aún sin frontend** para nada de esto (no se tocó, tal como se pidió).

### Panel Productor rediseñado: sidebar + 5 secciones (patrón a replicar después)

Todo backend usado ya existía (perfil, parcelas/mias, fotos, lotes/mios/estado)
— este turno fue 100% frontend.

- **Reestructuración de rutas**: `/panel` (genérico, `DashboardPage`) ahora
  redirige a `/panel/perfil` si `usuario.rol === "productor"`. Nuevas rutas:
  `/panel/perfil`, `/panel/parcelas`, `/panel/parcelas/nueva`,
  `/panel/parcelas/:id`, `/panel/seguimiento`. `/produccion/nuevo` y
  `/produccion` (ya existían) se reutilizaron tal cual, solo cambiando su
  layout envolvente.
- **`PanelProductorLayout`** (`src/components/panelProductor/`) — sidebar
  fijo (colapsa a hamburguesa/off-canvas en `max-width: 860px`, mismo
  breakpoint que ya usaba `TrazabilidadPublicaPage`), con avatar+nombre
  (via `GET /api/usuarios/perfil`) y los 5 items de nav (resaltado por
  ruta activa via `useLocation()`, sin necesidad de React Router
  `Outlet`). Expone `usePerfilPanel()` (Context) para que `PerfilPage`
  actualice el nombre/foto del sidebar **al instante** al guardar, sin
  esperar una navegación — el bug inicial (guardar perfil no actualizaba
  el sidebar hasta recargar) se corrigió así.
- **Paleta**: `src/styles/panelProductor.css` reutiliza los mismos
  valores/nombres de variable que `publico.css` (`--pub-*`) — decisión
  explícita del usuario para que el panel Productor se sienta "la misma
  plataforma" que la landing, no un producto aparte. Los demás roles
  siguen con el tema morado/oscuro de `App.css` hasta que se les replique
  este patrón.
- **Bug real encontrado y corregido**: `App.css` (tema interno, cargado
  globalmente) también define una clase `.boton` — con la misma
  especificidad, gana la que se evalúa después según el orden de imports
  de `App.jsx` (que es alfabético/por aparición, no por "quién lo usa").
  Eso hacía que los botones del panel Productor salieran morados en vez
  del acento cálido. Se resolvió renombrando a `.boton-panel` en
  `panelProductor.css` — **lección para las próximas paletas**: no confiar
  en el orden de import entre hojas de estilo que conviven en el mismo
  bundle; usar nombres de clase con sufijo/prefijo único por zona
  (`-panel`, `-publico`, etc.), como ya se hacía con `.boton-enlace-panel`.
- **Mis parcelas**: `ParcelasListaPage` (grid con foto/badge de cultivo),
  `ParcelaNuevaPage` (nombre + zona + tipo_cultivo + GPS; tras crear,
  muestra inline el uploader de fotos de `GaleriaFotos`, componente
  compartido), `ParcelaDetallePage` (datos + mini-mapa OSM + galería —
  reutiliza `GET /api/parcelas/mias` y filtra por `:id` en el cliente, no
  hizo falta un endpoint `GET /api/parcelas/:id` nuevo).
- **Registrar cosecha simplificado**: `ProduccionNuevoPage` ya NO crea
  parcelas inline (eso quedó en "Mis parcelas") — ahora es solo un
  selector de parcelas ya registradas; si el productor no tiene ninguna,
  muestra un estado vacío con link a "Registrar mi primera parcela".
- **Seguimiento de mi cosecha**: stepper visual de 6 etapas
  (`produccion→acopio→procesamiento→certificacion_sanitaria→exportacion→entregado`)
  por lote, calculado comparando el índice de `estado_macro` contra el
  orden fijo (no depende de nombres de etapa hardcodeados por lote,
  generaliza si el modelo cambia). Badge "Exportado, con código QR
  generado" solo si `tiene_qr` es `true` (siempre `false` hoy, honesto,
  mismo motivo que en turnos anteriores: no existe endpoint de generación
  de QR todavía).
- Probado de punta a punta en Chrome: perfil (nombre + foto, actualización
  en vivo del sidebar confirmada), parcela nueva con GPS + foto inline,
  parcela existente mostrando mapa y galería, registrar cosecha con el
  selector nuevo, mis registros y seguimiento con datos reales. El
  responsive se verificó forzando temporalmente el breakpoint CSS a un
  valor siempre-activo (la herramienta `resize_window` del entorno de
  automatización no redimensionó el viewport real en esta sesión) —
  confirmado que hamburguesa, overlay y cierre funcionan; se revirtió el
  breakpoint a 860px antes de terminar.
- **Nota de arquitectura para replicar a los demás roles**: el patrón
  completo (sidebar + Context de perfil compartido + paleta con nombres
  `-panel` para evitar colisiones) queda listo para copiar a
  Cooperativa/Planta/SENASA/Exportador/SUNAT cuando se pida — **ojo con
  la colisión de `.boton`** al crear la próxima hoja de estilos.

### Bugfix: pantalla en blanco en /panel/perfil (insertBefore) + condición de carrera real

- **Diagnóstico**: backend (`GET /api/usuarios/perfil`) confirmado correcto
  con curl — no era la causa. No se logró reproducir visualmente el
  crash exacto de `insertBefore`/`<Text>` pese a probar 4 escenarios
  (recarga dura sin foto, recarga dura con foto seteada, navegación SPA
  entre secciones, flujo completo de login). **Pero sí se encontró y
  reprodujo un bug real emparentado**: `PanelProductorLayout` fetcheaba el
  perfil con solo una bandera booleana `vigente` para evitar carreras —
  en React StrictMode (dev) el efecto se invoca dos veces al montar y
  **ambas** peticiones de red salen y responden 200; se observó
  (via `read_network_requests`) que a veces el resultado dejaba
  `perfil=null` con `cargando=false`, mostrando un estado inconsistente.
  Esto confirma la clase de bug que diagnosticó el usuario (datos
  asíncronos + doble-render de React sin manejo robusto), aunque el
  síntoma final observado fue una carrera de estado, no necesariamente
  el mismo insertBefore textual.
- **Fix aplicado**:
  - `PanelProductorLayout.jsx`: `AbortController` en vez de la bandera
    booleana (cancela la petición obsoleta cuando el efecto se
    re-invoca), más un estado `cargandoPerfil` explícito que gatea
    la decisión `<img>` vs `<span>` del avatar del sidebar (antes se
    inferría "sin foto" con `perfil` en `null`, causando un cambio de
    tipo de nodo apenas llegaba la respuesta real).
  - `PerfilPage.jsx` reestructurado con el patrón early-return que ya
    usaba correctamente `ParcelaDetallePage` (cargando → error → contenido
    como ramas separadas, no ternarios anidados): `FormularioPerfil` ahora
    recibe `perfil` como prop **garantizada no-nula** (solo se monta
    cuando el dato ya llegó), eliminando la superficie del bug por
    completo en ese componente.
  - Mismo patrón de `AbortController` aplicado también a
    `ParcelasListaPage`, `ParcelaDetallePage`, `SeguimientoPage`,
    `ProduccionListaPage`, `ProduccionNuevoPage` (las 5 secciones del
    sidebar) y a los 2 efectos de `LandingPage` (ya que se tocó ese
    archivo para el fix de `key` de abajo) — `api.js` ahora acepta un
    `signal` opcional en cada método.
  - **Bug de `key` real encontrado**: no estaba en `TarjetaProducto` (ese
    componente ya tenía `key={item.codigo}` correcto y no tiene ningún
    `.map()` interno) sino en el diagrama de la cadena de `LandingPage`:
    `CADENA.map((paso) => <div key={paso.etapa}>...)` — los objetos de
    `CADENA` solo tienen `icono` y `etiqueta`, **nunca tuvieron un campo
    `etapa`**, asi que las 4 keys resolvian a `undefined`. Corregido a
    `key={paso.etiqueta}`.
- **Verificado por mí antes de cerrar**: 5 recargas duras consecutivas de
  `/panel/perfil` sin fallos (antes del fix se observó 1 fallo en ~4
  intentos); las 5 secciones del sidebar revisadas visualmente sin
  errores de consola; `/` sin warning de `key`. Datos de prueba
  (foto_perfil_url apuntando a un archivo inexistente) revertidos a
  `NULL` al terminar.

### Sesión: hero full-screen, foto obligatoria, seguimiento completo, layout para todos los roles

Sesión larga en 4 bloques, cada uno probado en Chrome antes de pasar al
siguiente. Resumen y, al final, la respuesta directa a si el Bloque 4
obligó a tocar algo de Productor.

#### Bloque 1 — Hero de la landing a pantalla completa + Ken Burns

- **Causa real de las "franjas vacías"**: `index.css` (resabio del scaffold
  de Vite, nunca limpiado) tiene `#root { width: 1126px; max-width: 100%;
  margin: 0 auto; border-inline: 1px solid var(--border); }`, aplicado
  globalmente. Correcto para el resto del sitio (legibilidad), pero
  encogía tambien el hero. Solución: técnica "full-bleed" solo en `.hero`
  (`width: 100vw` + `margin: calc(50% - 50vw)` a los lados) en vez de
  tocar `#root` — así el resto del sitio no cambia. `overflow-x: hidden`
  agregado a `body` (index.css) como red de seguridad del truco (evita
  scrollbar horizontal por el desfase de `vw` vs ancho visible).
- **Alto completo**: `.hero` pasó de `min-height: 88svh` a `height: 100vh`
  seguido de `height: 100dvh` (el navegador ignora la segunda declaración
  si no soporta `dvh`, y si la soporta la sobrescribe — asi se logra el
  fallback pedido sin media queries).
- **Header flotando sobre el hero**: en vez de dejar el header como barra
  sólida empujando el hero hacia abajo (lo que causaba que el hero
  sobrara por la altura del header y no calzara exacto con la pantalla),
  se agregó el modifier `.publico-header--flotante` (solo usado en
  `LandingPage`, no en `TrazabilidadPublicaPage` que sigue con el header
  normal en flujo) con `position: absolute` y colores fijos claros (mismo
  criterio que `hero__marca`: el fondo debajo siempre es la foto
  oscurecida, sin importar claro/oscuro).
- **Ken Burns con CSS puro**: la imagen de fondo se separó a su propio
  elemento `.hero__fondo` (antes era `background-image` inline en la
  propia `.hero`) para poder animarle `transform: scale` sin afectar el
  texto encima. `@keyframes hero-ken-burns` de 100% a 110% en 20s,
  `infinite alternate` (zoom-in y zoom-out continuo y lento, no solo una
  vez) para que se sienta "vivo" en una landing donde el usuario puede
  quedarse un rato. Respeta `prefers-reduced-motion: reduce`.
- Probado en Chrome: geometría real vía JS (`getBoundingClientRect`) confirmó
  ancho = viewport exacto, alto = viewport exacto, sin scroll horizontal,
  header en `position: absolute` con colores claros legibles.

#### Bloque 2 — Foto obligatoria en Registrar cosecha

- **Backend**: migración 017 (`fotos_registro_produccion`, FK a
  `registros_produccion.id` — **no** a la parcela, esa es una tabla
  aparte ya existente, `fotos_parcela`). Endpoints nuevos en
  `routes/produccion.js`: `GET /:id/fotos` (cualquier autenticado — las
  fotos terminan siendo públicas vía `/trazabilidad` de todos modos) y
  `POST /:id/fotos` (solo el productor dueño del registro, solo mientras
  `estado='borrador'`, hasta 4 archivos, mismo `crearUploaderImagen`
  ya existente). Se agregó un hook opcional `conExtra(registro)` a la
  factory `etapaRouter.js` (mismo patrón que `antesDeCrear`/
  `antesDeValidar` ya existentes) para que `GET /` y `GET /pendientes` de
  Producción embeban `fotos: []` sin tocar Acopio/Procesamiento/
  Exportación (que no pasan ese hook, quedan igual que antes).
- **Frontend**: `ProduccionNuevoPage` ahora tiene selector de archivos
  (`multiple`, hasta 4), preview con `URL.createObjectURL` (revocados al
  cambiar/desmontar), botón "Registrar cosecha" deshabilitado si no hay
  ninguna foto. Al enviar: crea lote → crea registro → sube las fotos al
  registro recién creado, en una sola acción de usuario (mismo patrón que
  ya encadenaba crear lote + registro).
- **Manejo de datos legacy (borradores sin foto)**: `ProduccionListaPage`
  ahora muestra las fotos si existen; si un registro sigue en `borrador`
  y no tiene ninguna, muestra un uploader inline para agregarla ahí mismo
  (`AgregarFotosLegacy`); si ya está `validado` sin foto, se muestra como
  excepción honesta ("dato anterior") sin bloquear nada — se decidió no
  exigir retroactivamente algo que no se pudo pedir en su momento.
- Probado en Chrome: envío bloqueado sin foto, envío con 2 fotos con
  preview correcto, error claro al subir más del máximo (mensaje de
  Multer `LIMIT_UNEXPECTED_FILE` traducido en el manejador global de
  errores de `server.js`), rechazo por dueño incorrecto y por registro ya
  validado (curl), y el flujo de "agregar foto a un borrador viejo sin
  foto" funcionando en vivo.

#### Bloque 3 — Vista de Seguimiento completa

- **Backend**: `GET /api/lotes/mios/estado` (ya existía) ahora también
  devuelve, por lote: `linea_tiempo` (un registro por cada una de las 4
  etapas con tabla propia, **en cualquier estado** — borrador o validado,
  a diferencia de `/trazabilidad/:codigo` que es pública y solo muestra
  lo ya validado), `fotos` (las de Bloque 2, vía JOIN con
  `registros_produccion`), y `codigos_qr` (array, hoy siempre vacío
  porque sigue sin existir el endpoint que genera códigos QR).
- **Frontend**: `SeguimientoPage` mantiene el stepper horizontal compacto
  que ya existía, y le agrega debajo una línea de tiempo vertical
  detallada **reutilizando el mismo patrón visual** de
  `TrazabilidadPublicaPage` (clases `.linea-tiempo`/`.panel-publico` de
  `publico.css`, importado también aquí) con fecha y validador por etapa.
  Se agregó un modifier `.linea-tiempo__item--pendiente` (opacidad
  reducida) porque a diferencia de la ficha pública, aquí SÍ se muestran
  las 6 etapas siempre, incluidas las que todavía no llegan.
- **Certificación sin tabla propia**: como `certificacion_sanitaria` no
  tiene registro propio (la aprobación de SENASA vive en
  `registros_procesamiento.validado_por`, decisión de alcance ya
  documentada arriba), esa etapa muestra una nota explícita ("Aprobada
  por SENASA junto con la validación de Procesamiento") en vez de
  inventar un registro que no existe.
- **QR**: si `tiene_qr` es true, se genera el código QR **en el cliente**
  (misma librería `qrcode` que ya usaba `TrazabilidadPublicaPage`) por
  cada entrada de `codigos_qr`, con nota de que el lote "ya salió de la
  cadena hacia el comprador". Sigue sin poder probarse con datos reales
  porque no existe endpoint de generación de QR — probado insertando una
  fila de prueba directo en SQLite y revirtiéndola después de confirmar
  que se renderiza.
- Solo lectura confirmada: no se tocó ningún endpoint de escritura para
  esta pantalla, sigue siendo 100% GET.

#### Bloque 4 — Mismo layout para Cooperativa, Planta, SENASA, Exportador, SUNAT y Administrador

- **Hallazgo importante antes de empezar**: de los 6 roles a replicar,
  **solo Cooperativa ya tenía pantallas reales** (con el tema oscuro
  viejo). Planta de Procesamiento, SENASA, Exportador, SUNAT y
  Administrador solo mostraban tarjetas "Próximamente" en el dashboard
  genérico — el backend (`etapaRouter.js` ya cubre
  procesamiento/exportación) existía, pero no había pantallas. Este
  bloque terminó incluyendo construir esas pantallas, no solo re-vestir
  unas que ya existían.
- **Generalización del layout**: `PanelProductorLayout.jsx` se convirtió
  en un re-export transparente de un nuevo componente genérico
  (`components/panelInterno/PanelLayout.jsx`) que arma el sidebar a
  partir de `constants/panelNav.js` (`NAV_POR_ROL`, un array de items por
  rol) en vez de recibir los items hardcodeados. **Ningún archivo de
  Productor fue tocado más allá de este re-export** — mismo HTML, mismas
  clases CSS (`panel-productor__*`, sin renombrar nada), mismo Context de
  perfil compartido. Verificado con captura antes/después: pixel por
  pixel el mismo resultado.
- **Páginas genéricas por etapa** (`pages/etapas/`): dado que
  Acopio/Procesamiento/Exportación comparten exactamente el mismo patrón
  backend (`etapaRouter.js`) y el mismo patrón de pantalla (validar
  pendientes / crear registro con selector de lote / listar mis
  registros), se construyeron 3 componentes genéricos
  (`EtapaValidarPage`, `EtapaNuevoPage`, `EtapaListaPage`) parametrizados
  por `constants/etapas.js` (`CONFIG_ETAPA`, campos de formulario y
  campos a mostrar por etapa) en vez de escribir 9 páginas casi
  idénticas a mano. Producción se queda con sus páginas propias (foto
  obligatoria, selector de parcela) porque no encaja en el patrón
  genérico.
- **Cooperativa migrada al patrón genérico también**: sus 3 páginas
  viejas (`ProduccionValidarPage`, `AcopioNuevoPage`, `AcopioListaPage`,
  con el tema oscuro de `App.css`/`Layout.jsx`) se **eliminaron** y se
  reemplazaron por las mismas páginas genéricas que usan los demás roles
  nuevos (`EtapaValidarPage etapa="produccion"`, etc.) — si no, Cooperativa
  hubiera quedado con el diseño viejo mientras el resto usaba el nuevo.
- **Limpieza de código muerto resultante**: al mover Cooperativa al patrón
  genérico, `components/Layout.jsx` (tema oscuro) quedó sin ningún uso
  real (`DashboardPage` es lo único que lo importaba). Se simplificó
  `DashboardPage.jsx` a un simple `<Navigate to="/panel/perfil" />` (todos
  los roles tienen destino propio ahora) y se borró `Layout.jsx`.
  `ETIQUETAS_ROL` se movió de `Layout.jsx` a `constants/catalogos.js`
  (única fuente, ya no vive "escondido" en un componente de layout).
- **Administrador**: nueva pantalla `ConfiguracionSitioPage`
  (`/panel/configuracion`) que consume el `PUT /api/admin/configuracion`
  que ya existía desde una sesión anterior — nombre de plataforma +
  imagen de fondo del hero, con preview antes de guardar (mismo patrón de
  preview que las fotos de Bloque 2).
- **`/panel/perfil` dejó de estar restringido a `productor`**: como el
  endpoint de perfil (`GET/PUT /api/usuarios/perfil`) nunca fue exclusivo
  de un rol, ahora cualquier rol autenticado tiene "Mi perfil" en su
  sidebar, reutilizando literalmente el mismo componente `PerfilPage.jsx`
  (vive en `pages/panelProductor/` por razones históricas, pero ya no es
  específico de ese rol).
- Probado rol por rol en Chrome, cada uno con datos reales encadenados: 
  login como Cooperativa → validar producción → registrar acopio; login
  como Planta → validar ese acopio → registrar procesamiento (con
  selector de ruta A/B); login como SENASA → validar esa certificación;
  login como Exportador → registrar esa exportación; login como SUNAT →
  validarla; login como Administrador → subir imagen de prueba y
  confirmar que se reflejó en la landing pública (revertido a `NULL`
  después de confirmar). Al final, login de vuelta como el Productor
  original y confirmado en `/panel/seguimiento` que el lote de prueba
  quedó con las 6 etapas completas y cada validador correcto.

**Respuesta directa a la pregunta del usuario**: el patrón de Productor
**sí era perfectamente reutilizable** para el layout (sidebar, paleta,
tipografía) — no hubo que modificar su diseño visual en absoluto para que
funcionara en los demás roles, y quedó verificado que es pixel-idéntico a
como estaba al cerrar el Bloque 3. Lo único que se tocó de "Productor" fue
`PanelProductorLayout.jsx`, pero como re-export transparente de la
implementación genérica, no como cambio de comportamiento. Lo que **sí**
resultó más grande de lo esperado fue el alcance del Bloque 4 en sí: 5 de
los 6 roles no tenían pantallas propias todavía (solo Cooperativa), así
que además de "cambiar el layout" hubo que construir las pantallas
funcionales de Planta/SENASA/Exportador/SUNAT desde cero (reutilizando el
backend ya existente) y migrar las de Cooperativa al patrón genérico
nuevo para que no quedaran con el diseño viejo mientras el resto ya tenía
el nuevo.

**Nota de datos de prueba**: quedaron en la base varios lotes/registros de
prueba creados durante esta sesión (identificables por sus fechas
`2026-07-20` y variedades como "CCN-51"/"Typica" con volúmenes redondos
como 100/150/50 kg) — son datos válidos, no rotos, se dejaron como
evidencia de que el flujo cruzado entre roles funciona de punta a punta.

### Bugfix: franjas vacías en TODA la app (causa raíz real de un workaround anterior)

El usuario reportó franjas vacías a los costados en la landing, el
catálogo, y el panel interno (`/panel/perfil`). Diagnóstico pedido
explícitamente antes de tocar nada.

- **Causa raíz confirmada**: `frontend/src/index.css` tenía
  ```css
  #root {
    width: 1126px;
    max-width: 100%;
    margin: 0 auto;
    border-inline: 1px solid var(--border);
    ...
  }
  ```
  — resabio del scaffold de Vite + React que **nunca se quitó**. `#root`
  es el único nodo que envuelve TODA la app (`main.jsx` monta ahí), así
  que ese ancho fijo de 1126px centrado se heredaba en **cada página**,
  sin importar en qué sesión se haya construido esa página (landing,
  panel, etc.) — exactamente la sospecha del usuario de que era un
  contenedor global, no un bug por componente.
- **Por qué el hero de la landing no se veía afectado**: en una sesión
  anterior (ver "Bloque 1" arriba) ya se había parcheado esto, pero
  **solo para `.hero`**, con un truco "full-bleed" (`width:100vw` +
  `margin: calc(50% - 50vw)`) que hacía que esa sección específica se
  saliera del contenedor de 1126px. Ese parche era correcto pero
  incompleto: resolvía el síntoma en una sola sección en vez de la causa
  en `#root`, por eso el resto del sitio (institucional, catálogo,
  trazabilidad, y **todo** el panel interno construido en sesiones
  posteriores) seguía con las franjas.
- **`<html lang="en">`** (`frontend/index.html`) — otro resabio del
  scaffold nunca actualizado, en una app 100% en español. Esto es lo que
  causaba el bug reportado de "Changer foto": el texto real en el código
  siempre fue "Cambiar foto" (verificado en `PerfilPage.jsx`), pero
  Chrome detecta un `lang` declarado que no coincide con el idioma real
  del contenido y a veces auto-traduce la página — de ahí "Changer foto"
  (francés) y hasta el título de pestaña "frontend" apareciendo como
  "Frontal" en las pruebas. No era un bug de texto en el código, era una
  consecuencia del `lang` incorrecto.

**Corrección aplicada**:

- `index.css`: se eliminó el `width`/`max-width`/`margin`/`border-inline`
  de `#root`, dejando solo `min-height: 100svh; display: flex;
  flex-direction: column;`. Ahora el fondo de cada página ocupa el 100%
  real de la ventana en todas partes, no solo en el hero.
- `publico.css` — `.hero` ya no necesita el truco full-bleed (era un
  parche para saltarse el `#root` que ya no existe): se simplificó a
  `width: 100%` normal, mismo resultado, menos código.
- `publico.css` — `.trazabilidad-hero` y `.trazabilidad-grid` **no
  tenían max-width propio** (dependían implícitamente del límite de
  `#root` para no verse estirados). Al quitar el límite global, se les
  agregó `max-width: 1200px; margin: 0 auto;` (mismo valor que
  `.seccion-catalogo`) para que seguidamente el CONTENIDO no se estire
  de borde a borde en pantallas anchas, aunque el fondo (`.publico`) sí
  llegue a los bordes reales.
- `panelProductor.css` — `.panel-productor__contenido` (el área de
  contenido del panel, al lado del sidebar) tampoco tenía max-width
  propio; se le agregó `max-width: 1180px`. El fondo del panel
  (`.panel-productor`, el sidebar) sigue llegando de borde a borde; el
  contenido queda alineado a la izquierda (pegado al sidebar) con un
  límite de ancho razonable, dejando espacio vacío a la derecha en
  monitores muy anchos — patrón normal de paneles con sidebar fijo (no
  centrado como una landing).
- `index.html`: `lang="en"` → `lang="es"` (corrige la causa real de la
  auto-traducción) y `<title>frontend</title>` → `<title>Raíz</title>`
  (mismo resabio de scaffold, se corrigió de paso). El texto "Cambiar
  foto" en `PerfilPage.jsx` no se tocó porque ya estaba correcto.
- **Lección para futuras sesiones**: cuando un bug de layout aparece "en
  una sola sección" y se resuelve con un truco local (full-bleed,
  z-index, position:absolute, etc.), vale la pena preguntarse si el
  problema real está más arriba en el árbol de contenedores antes de dar
  el parche por bueno — sobre todo en este proyecto, que arrancó del
  scaffold de Vite y todavía puede tener más resabios sin auditar
  (`App.css` quedó con bastante CSS muerto del tema oscuro viejo tras la
  migración de Cooperativa al patrón genérico en el Bloque 4 — no
  se tocó en este turno por estar fuera de alcance, pero es candidato a
  limpieza futura).
- **Verificado en Chrome** (landing, catálogo, `/trazabilidad/:codigo`,
  `/panel/perfil`, `/panel/parcelas`): en cada página, geometría real vía
  `getBoundingClientRect()`/`clientWidth`/`scrollWidth` confirmó que el
  fondo ocupa el 100% del viewport con cero overflow horizontal, y que
  cada contenedor de contenido respeta su propio max-width (1200px en
  público, 1180px en el panel). **Nota de herramienta**: en este entorno
  de automatización, `window.outerWidth`/las capturas de pantalla del
  navegador reportan un ancho más angosto (~1536px) que el viewport CSS
  real (`window.innerWidth` ~1910px) — un límite de la herramienta de
  captura, no de la app (confirmado con `zoom` en coordenadas específicas
  y cotejando contra `elementFromPoint`, que sí devuelve los elementos
  reales de la página en esas posiciones). Por eso las capturas de
  pantalla completas muestran una franja negra a la derecha que **no es
  real** — la verificación confiable en este entorno es la geometría del
  DOM, no la captura visual completa.

### Rediseño de la paleta de color (toda la plataforma)

No se encontró ningún skill/guía de diseño frontend instalado en este
entorno (se buscó explícitamente antes de tocar CSS, como se pidió) —
la paleta se diseñó aplicando principios estándar directamente:
jerarquía de superficies por pasos de luminosidad, contraste WCAG 2.1
(mínimo 4.5:1 para texto normal, 3:1 para texto grande/componentes UI)
verificado con calculos reales (formula de luminancia relativa de WCAG,
script descartable en el turno) en vez de a ojo.

- **Causa raíz del "todo es el mismo marrón"**: `--pub-bg` y
  `--pub-card-bg` (el fondo de página y el fondo de las tarjetas) eran
  *casi el mismo color* — contraste WCAG real de **1.09:1** entre ambos
  (para referencia, 1:1 es literalmente el mismo color). No importaba
  cuántas tarjetas se agregaran, nunca iban a separarse visualmente del
  fondo porque numéricamente casi no había diferencia de luminosidad.
- **Texto blanco sobre el acento naranja de los botones**: 3.10:1, por
  debajo del mínimo AA de 4.5:1 para texto normal (el acento anterior,
  `#e2703a`, era demasiado claro para sostener texto blanco encima).
- Varios colores de estado (verde "validado", ámbar "borrador", dorado
  de badges "valor agregado"/certificación) estaban **hardcodeados como
  hex sueltos repetidos 3-4 veces cada uno** en `publico.css` y
  `panelProductor.css` en vez de ser variables — y ni siquiera cumplían
  buen contraste (verde `#2f8a45` sobre la tarjeta nueva: 3.33:1; dorado
  `#8a6a1f`: 2.87:1).

**Centralización real (no solo ajustar valores)**: las variables
`--pub-*` vivían **duplicadas palabra por palabra** en `publico.css`
(bajo `.publico`) y `panelProductor.css` (bajo `.panel-productor`) —
exactamente el patrón que ya había causado el bug de `.boton` de una
sesión anterior. Se extrajeron a un archivo nuevo,
`frontend/src/styles/paleta.css`, definidas una sola vez en `:root` e
importado globalmente en `main.jsx` (antes que cualquier otra hoja de
estilos). `publico.css` y `panelProductor.css` ya no declaran ninguna
variable, solo las consumen — cualquier pantalla nueva las hereda
automáticamente sin tener que redeclararlas ni adivinar valores.

#### Paleta final (dark, la que se ve en la práctica — el entorno de pruebas siempre reporta `prefers-color-scheme: dark`)

| Variable | Valor | Uso |
|---|---|---|
| `--pub-bg` | `#15120e` | Fondo base de página (nivel 0) |
| `--pub-bg-alt` | `#211c17` | Franjas de sección alternas, iconos recesados (nivel 1) — p.ej. la banda "Quiénes somos" de la landing |
| `--pub-card-bg` | `#302822` | Tarjetas, paneles, contenedores de filtros (nivel 2) |
| `--pub-card-bg-2` | `#41372f` | Elementos anidados dentro de una tarjeta: chips de filtro, fieldsets de formularios (nivel 3) |
| `--pub-text` | `#f6ecdc` | Texto principal |
| `--pub-text-soft` | `#c9ae95` | Texto secundario/atenuado (mínimo 5.5:1 incluso sobre `card-bg-2`) |
| `--pub-brand` | `#e8b978` | Identidad/títulos (sin cambios, ya tenía buen contraste) |
| `--pub-accent` | `#bb501b` | Botones/CTAs/interactivo — oscurecido desde `#e2703a` para que el texto blanco encima llegue a 5:1 |
| `--pub-accent-rgb` | `187, 80, 27` | Triplete RGB del acento, para fondos traslúcidos `rgba(var(--pub-accent-rgb), 0.X)` |
| `--pub-accent-2` | `#d9a441` | Dorado secundario: badges "valor agregado", certificación pendiente, tipo de cultivo |
| `--pub-accent-2-rgb` | `217, 164, 65` | Triplete RGB de accent-2 |
| `--pub-border` | `#4a342a` | Bordes sutiles sobre `card-bg` |
| `--pub-shadow` | `rgba(0,0,0,0.5)` | Sombra de elevación de tarjetas |
| `--pub-success` | `#59cf84` | Validado/aprobado/exportado |
| `--pub-warning` | `#e0932a` | Borrador/pendiente |
| `--pub-danger` | `#e7726a` | Rechazado/error (antes reutilizaba `--pub-accent`, ahora tiene tono propio — un rojo real en vez del naranja de marca, semántica más clara) |
| `*-rgb` de success/warning/danger | ver `paleta.css` | Mismo patrón que accent-rgb, para `rgba(...)` de fondos de badges |

El modo claro (`prefers-color-scheme: light`, resguardo — no es el foco
de este rediseño ya que el entorno de pruebas nunca lo activa) también
se corrigió con la misma lógica de 4 niveles y se verificó contraste,
pero se invirtió menos tiempo puliéndolo. Ver `paleta.css` para sus
valores completos.

**Aplicado en la práctica** (no solo definido, wireado a componentes
reales):
- `.filtro-chip` (chips de Producto/Ruta del catálogo) ahora usan
  `--pub-card-bg-2` en reposo en vez de `transparent` — antes eran
  invisibles hasta el hover/activo.
- `.formulario-panel fieldset` (agrupaciones dentro de los formularios
  del panel) ahora tienen `background: var(--pub-card-bg-2)` — antes
  solo tenían borde, invisibles contra la tarjeta que los contiene.
- La sección institucional de la landing (`.seccion-institucional`) se
  separó en un `<section>` de ancho completo con `--pub-bg-alt` como
  fondo y un `__inner` con el `max-width` de siempre — esto requirió
  envolver su contenido en un div nuevo en `LandingPage.jsx` (antes el
  `max-width` estaba en el propio `<section>`, así que no había forma de
  darle un fondo de banda completa sin desacoplar ambas cosas). Efecto:
  la landing ahora tiene 3 "zonas" visualmente distintas (hero, banda
  institucional, catálogo) en vez de un solo fondo plano de borde a
  borde.
- `certificacion-icono--rechazado` y `.mensaje-error` (ambas hojas)
  pasaron de `var(--pub-accent)` a `var(--pub-danger)` — un error ya no
  usa el mismo color que un botón de acción, semántica más clara.

**Bug real encontrado y corregido de paso** (no relacionado a colores,
apareció al probar `/trazabilidad/:codigo` visualmente): el proxy de
Vite agregado en la sesión de ngrok (`vite.config.js`, para exponer un
solo túnel) reenviaba *cualquier* request a `/trazabilidad/*` al backend
— incluida la navegación real del navegador a esa URL, que debía servir
la página React (`TrazabilidadPublicaPage`), no el JSON crudo del
endpoint público. Como esa ruta es a propósito la misma en frontend y
backend (es la URL literal que resuelve un QR — ver sección "Endpoint
público" arriba), el proxy no podía distinguir "navegación de página"
de "fetch interno de la propia página". Corregido con un `bypass()` en
esa entrada del proxy: si el header `Accept` de la request incluye
`text/html` (navegación real), se deja pasar para que Vite sirva el SPA;
si no (fetch/XHR), se reenvía al backend como antes. `/catalogo` y
`/uploads` no tienen este problema porque no existe una página de
React en esas mismas rutas.

**Probado visualmente en Chrome**: landing (hero + banda institucional +
catálogo con filtros y tarjetas), `/trazabilidad/:codigo` con datos
reales, y el panel interno de 3 roles distintos (Productor: perfil, mis
registros con badges borrador/validado, seguimiento con stepper +
timeline; Cooperativa: validar productores; Administrador: configuración
del sitio, útil porque en una sola pantalla se ven los 3 niveles de
superficie a la vez — página, tarjeta, fieldset anidado). Sin errores de
consola en ninguna. Verificado por JS que las variables resueltas en
`:root` coinciden exactamente con los valores de esta tabla.

**Pendiente de decisión del usuario**: el modo claro (`prefers-color-scheme:
light`) sigue existiendo como resguardo pero nunca se ha visto en la
práctica en este proyecto — si se confirma que la plataforma es
deliberadamente oscura siempre (no depende de la preferencia del SO),
se podría eliminar esa rama entera de `paleta.css` y simplificar. No se
quitó en este turno porque no se pidió explícitamente y quitar soporte
existente sin que lo pidan no correspondía.

### Ficha pública de trazabilidad: fotos/ubicación/identidad conectadas + rediseño

El usuario reportó que `/trazabilidad/:codigo` no mostraba toda la
información ya registrada (fotos, ubicaciones, identidad de actores).
Pidió verificar el estado real del código **antes** de asumir nada de
versiones anteriores de este documento.

#### PASO 1 — Estado real verificado (foto/GPS por etapa)

Se leyeron las migraciones `004`–`008` (las 4 tablas de registro de
etapa) y `017` (fotos), más los formularios de frontend
(`ProduccionNuevoPage.jsx`, `EtapaNuevoPage.jsx` genérico +
`constants/etapas.js`) y se confirmó con `grep` exhaustivo sobre **todas**
las migraciones:

| Etapa | ¿Foto? | ¿Ubicación/GPS? |
|---|---|---|
| Producción | ✅ `fotos_registro_produccion` (migración 017), 1-4 obligatorias | ✅ indirecta, vía `parcela_id` → `parcelas.ubicacion_lat/lng` |
| Acopio | ❌ nunca existió tabla ni columna | ❌ nunca existió |
| Procesamiento | ❌ nunca existió | ❌ nunca existió |
| Exportación | ❌ nunca existió (puerto/destino son texto libre, no coordenadas) | ❌ nunca existió |

**Conclusión**: no había nada que "conectar" para Acopio/Procesamiento/
Exportación porque esos datos **nunca se capturaron** al construir esos
3 formularios — no es un bug de la ficha pública, es una etapa del
proyecto que no llegó a implementarse para esas 3 tablas. No se inventó
ni se dejó placeholder vacío para eso, tal como se pidió.

Lo que sí estaba mal: `backend/src/routes/trazabilidad.js` **no exponía**
lo que sí existía —
- `usuarioPublico()` solo seleccionaba `id, nombre, rol` de `usuarios`,
  nunca `nombre_publico`/`foto_perfil_url` (existen desde la migración
  015) — la identidad pública configurada por cada actor se ignoraba.
- La respuesta solo resolvía `validado_por` (quien aprobó cada etapa),
  nunca `actor_id` (quien la **registró** — el Productor que cosechó, la
  Cooperativa que pesó, etc.) — el dato más relevante para un comprador
  ("¿quién produjo esto?") no se exponía en absoluto.
- `fotos: []` estaba **hardcodeado** en la respuesta con un comentario
  desactualizado ("no existe almacenamiento de fotos en el modelo de
  datos") que ya no era cierto desde que Bloque 2 agregó
  `fotos_registro_produccion` — el endpoint nunca se actualizó después de
  esa migración.
- `parcela` (con `ubicacion_lat/lng`) sí se devolvía correctamente, pero
  el frontend la mostraba en un panel lateral genérico, sin relación
  visual con la etapa de Producción a la que pertenece.

#### PASO 2 — Backend conectado

`backend/src/routes/trazabilidad.js`:
- `usuarioPublico(id)` ahora selecciona también `nombre_publico` y
  `foto_perfil_url`.
- Nueva función `fotosDeProduccion(registroProduccionId)` — consulta
  `fotos_registro_produccion`, se usa solo para la etapa `produccion`
  (las otras 3 etapas no tienen fotos que consultar, confirmado en Paso 1).
- Cada entrada de `linea_tiempo` ahora incluye `actor` (identidad
  completa de quien registró esa etapa, mismo shape que `validado_por`)
  y `fotos` (array, vacío salvo en `produccion`).
- Se quitó el `fotos: []` hardcodeado del nivel superior de la respuesta
  (ya no hace falta, las fotos viven dentro de la etapa que les
  corresponde).
- `parcela` no cambió (ya devolvía `ubicacion_lat/lng` correctamente).

#### PASO 3 — Rediseño del frontend

`frontend/src/pages/publico/TrazabilidadPublicaPage.jsx` y
`frontend/src/styles/publico.css` (paleta de `paleta.css` sin tocar,
tal como se pidió — esto fue reorganización, no cambio de colores):

- Cada etapa de la línea de tiempo pasó de ser un ítem de lista plano a
  una **tarjeta propia** (`.linea-tiempo__card`, fondo
  `var(--pub-card-bg-2)` — el mismo token de "superficie anidada" que ya
  se definió en la sesión de paleta, reutilizado en vez de inventar uno
  nuevo) dentro del spine de iconos/línea que ya existía.
- **Identidad del actor** (quien registró la etapa) con tratamiento
  visual principal: avatar circular de 44px (foto real si existe,
  círculo con inicial si no — mismo patrón de fallback que ya usa el
  sidebar del panel interno) + nombre público + rol en badge dorado
  (`--pub-accent-2`). El validador (quien aprobó) quedó como línea de
  texto secundaria al pie de la tarjeta ("✓ Validado por X · Rol"),
  deliberadamente más discreto — jerarquía explícita: quién lo hizo
  primero, quién lo aprobó después.
- **Fotos de evidencia** ahora se muestran dentro de la tarjeta de
  Producción (única etapa que las tiene), no en una sección genérica al
  final de la página — esa sección se eliminó por completo.
- **Mapa de la parcela** se movió de un panel lateral suelto a estar
  integrado dentro de la tarjeta de Producción (con nombre de la parcela
  y enlace "Ver mapa completo" al pie) — sigue sin mostrarse si la
  parcela no tiene coordenadas (ni todas las parcelas viejas las tienen,
  dependía de que el productor aceptara el permiso de GPS al crearla).
- La columna lateral quedó reducida a lo que es utilidad pura para el
  comprador (QR + descarga de PDF) y Certificaciones como panel
  secundario debajo (sigue vacío siempre, honesto, mismo motivo de
  siempre: no existe endpoint que llene esa tabla).
- El PDF (`jsPDF`) ahora incluye el nombre del actor de cada etapa en su
  línea de texto, mismo dato nuevo que ya se ve en pantalla.
- **Limpieza**: `.mapa-parcela*` (clases CSS) quedaron sin ningún uso en
  todo el frontend tras este cambio (confirmado con `grep`) — se
  eliminaron de `publico.css` en vez de dejarlas como código muerto.
- **Riesgo verificado**: `SeguimientoPage.jsx` (panel interno del
  Productor) reutiliza las clases base `.linea-tiempo__item/__punto/
  __etapa/__fecha/__validador` de `publico.css` sin pasar por el
  componente de React de la ficha pública — esas clases base **no se
  modificaron**, solo se agregaron clases nuevas (`__card`, `__actor`,
  `__fotos`, `__mapa`) que esa página no usa. Confirmado en Chrome que
  `/panel/seguimiento` se ve pixel-igual que antes del cambio.

**Probado con el lote más completo disponible** (`RZ-CAF-20260720-703212`
— 4 etapas validadas, 2 fotos de evidencia, GPS de la parcela, todos los
actores con foto de perfil salvo el validador final de SUNAT): tarjeta de
Producción con avatar+nombre+rol+fotos+mapa todo integrado, Acopio/
Procesamiento/Exportación con avatar+nombre+rol+detalle+validador cada
una. También probado con `RZ-CAF-20260719-5EA8FB` (parcela sin GPS,
actor sin foto de perfil) para confirmar los casos honestos: el avatar
cae al círculo con inicial ("M" de Maria Huaman) y el mapa simplemente no
aparece — nada de placeholders vacíos ni contenido inventado. Sin errores
de consola en ninguno de los dos casos, descarga de PDF verificada sin
errores.

### Tarjeta de perfil al hacer click en un actor (estilo "hovercard" de Facebook)

Pedido explícito: al hacer click en cualquier actor de la línea de tiempo
de `/trazabilidad/:codigo` (quien registró la etapa o quien la validó),
debe aparecer una ventana flotante encima con su foto, sus parcelas y sus
cafés/cacaos — "para cada proceso de la línea de tiempo", no solo
Producción.

**Backend** — `backend/src/routes/usuarios.js`, nueva ruta pública (sin
`authenticate`) `GET /api/usuarios/:id/actividad-publica`. Devuelve:
- `usuario`: id, nombre, nombre_publico, rol, foto_perfil_url (nada de
  email/teléfono — mismo criterio de "qué es público" que el resto de la
  ficha).
- `parcelas`: solo si `rol === 'productor'` (nombre, zona, tipo_cultivo,
  primera foto de la parcela).
- `lotes`: todos los lotes donde el usuario participó como actor en
  cualquier etapa (`UNION` sobre las 4 tablas `registros_*`), pero
  **filtrados a solo los que ya tienen `registros_procesamiento.estado =
  'validado'`** — el mismo gate de "visible públicamente" que usa el
  catálogo, para no filtrar por esta vía lotes todavía en borrador de un
  actor.

**Frontend** — nuevo componente `frontend/src/components/publico/
TarjetaPerfilActor.jsx`, consumido desde `TrazabilidadPublicaPage.jsx`:
- El actor de cada etapa y el texto "✓ Validado por..." pasaron de `<div>`
  a `<button>` (`onClick` guarda `{ actor, rect: e.currentTarget.
  getBoundingClientRect() }` en estado `perfilAbierto`).
- Click, no hover — decisión explícita del pedido ("cuando el usuario da
  click"), más robusto en móvil donde no existe hover real.
- Posicionamiento: `position: fixed`, calculado una vez al click a partir
  del `getBoundingClientRect()` del botón — pegada al borde izquierdo del
  actor, debajo por defecto, con flip hacia arriba si no hay ~220px de
  espacio abajo. `left` se recorta a `[12, innerWidth-352]` y el ancho
  además tiene `max-width: calc(100vw - 24px)` en CSS para no desbordar
  en pantallas muy angostas (celulares pequeños).
- Cierre: botón ✕, click fuera (`mousedown` + `ref.contains`), tecla
  Escape, y scroll de la página (`window.addEventListener('scroll',
  ..., {capture:true})`) — deliberadamente se cierra en vez de
  reposicionarse en vivo, más simple y predecible. El listener de scroll
  descarta explícitamente los eventos que se originan **dentro** de la
  propia tarjeta (su cuerpo tiene `overflow-y:auto` para listas largas de
  parcelas/lotes) comparando `e.target` contra el `ref` de la tarjeta —
  sin ese filtro, hacer scroll dentro de la tarjeta la cerraba
  inmediatamente en vez de scrollear su contenido.
- CSS nuevo (bloque `.tarjeta-actor*` en `publico.css`) reutiliza
  exclusivamente tokens `--pub-*` ya existentes de `paleta.css` — no se
  agregó ningún color nuevo, mismo criterio que la sesión anterior.

**Probado en Chrome** contra `RZ-CAF-20260720-703212` (4 etapas
validadas): click en los 4 actores de etapa (Producción/Cooperativa/
Planta/Exportador) y en los 4 validadores (Cooperativa/Planta/SENASA/
SUNAT) — los 4 actores con actividad muestran sus lotes correctamente
(Producción además muestra Parcelas, los demás roles no-productor
correctamente omiten esa sección), el validador de SENASA (sin lotes
propios como actor) muestra "Sin actividad pública todavía." en vez de
un error o placeholder vacío. Cero errores de consola en las 8
interacciones. Verificado también que el scroll interno de la tarjeta
(lista larga de parcelas/lotes) ya no la cierra, y que un scroll real de
la página (rueda del mouse, no `scrollBy()` programático — ver nota
abajo) sí la cierra correctamente.

**Nota de entorno (no del código):** durante la verificación, simular el
scroll de página con `window.scrollBy()` vía JS inyectado no disparaba
ningún evento `scroll` en `window`/`document` pese a que
`document.scrollingElement.scrollTop` sí cambiaba numéricamente — es una
particularidad de esta pestaña de automatización (el evento `scroll` se
despacha en el paso de renderizado/compositor, que puede no llegar a
ejecutarse en una pestaña controlada por CDP). Un scroll real con la
rueda del mouse (`computer` tool) sí disparó el evento y cerró la tarjeta
correctamente, confirmando que el código de producción
(`window.addEventListener('scroll', ..., {capture:true})`) es correcto
tal cual está — no requirió ningún cambio.
