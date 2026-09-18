# Raíz — Guía de pruebas manuales

Cada dato de esta guía (URLs, campos de formulario, endpoints, prerrequisitos)
fue verificado leyendo el código actual del repositorio, no reconstruido de
memoria. Backend en `http://localhost:4000`, frontend en
`http://localhost:5173` (o el túnel público que esté activo — ver
`docs/CONTEXTO.md` si hay uno).

**Usuarios de prueba** (`backend/src/seed.js`, password `Test1234!` para
todos):

| Email | Rol |
|---|---|
| `productor1@raiz.test` / `productor2@raiz.test` | productor |
| `cooperativa1@raiz.test` / `cooperativa2@raiz.test` | cooperativa |
| `planta1@raiz.test` / `planta2@raiz.test` | planta_procesamiento |
| `senasa1@raiz.test` / `senasa2@raiz.test` | senasa |
| `exportador1@raiz.test` / `exportador2@raiz.test` | exportador |
| `sunat1@raiz.test` / `sunat2@raiz.test` | sunat |
| `admin1@raiz.test` / `admin2@raiz.test` | admin |

La sesión (JWT) expira a las 8 horas (`JWT_EXPIRES_IN` en
`backend/src/config.js`) — no hay refresh token, tras eso hay que volver a
loguearse en `/login`.

---

## 3. Qué puede hacer cada actor — paso a paso real

Todos los roles, tras loguearse en `/login`, llegan a `/panel` →
redirige automáticamente a **`/panel/perfil`** (`DashboardPage.jsx` ya no
muestra nada propio, solo enruta). El sidebar que ve cada rol está definido
en `frontend/src/constants/panelNav.js`.

### Productor

**Sidebar**: Mi perfil · Mis parcelas · Registrar cosecha · Mis registros ·
Seguimiento de mi cosecha

1. **Mi perfil** (`/panel/perfil`, opcional) — nombre público (texto libre,
   placeholder = su nombre real) y foto (imagen). El email de acceso se
   muestra pero no es editable. Es lo que verá el comprador final en la
   ficha de trazabilidad.
2. **Registrar parcela** (`/panel/parcelas/nueva`) — **prerrequisito
   obligatorio** para poder registrar cualquier cosecha, no existe atajo.
   Campos: `nombre_parcela` (texto, requerido), `zona` (select con 6
   opciones fijas: Tingo María, Leoncio Prado, Pachitea, Huánuco, Marañón,
   Puerto Inca), `tipo_cultivo` (Café / Cacao / Café y cacao), y
   ubicación GPS — botón "Usar mi ubicación GPS actual" que pide permiso
   de geolocalización al navegador; **el envío queda bloqueado hasta que
   se capture la ubicación**. Tras crear la parcela, se puede subir fotos
   a su galería (opcional, sin límite explícito de cantidad en el
   frontend).
3. **Registrar cosecha** (`/produccion/nuevo`) — requiere al menos 1
   parcela ya creada (si no hay ninguna, la pantalla muestra un enlace
   directo a crear la primera). Campos: parcela (select, solo las
   propias), producto (Café/Cacao), variedad (depende del producto:
   café → Typica/Caturra/Bourbon/Catimor/Pache/Gran Colombia/Costa Rica
   95/Otra; cacao → CCN-51/Criollo/Trinitario/ICS-95/Chuncho/Otra), fecha
   de cosecha, volumen en kg, y **1 a 4 fotos de evidencia — obligatorias,
   el botón de envío queda deshabilitado sin al menos una** (JPG/PNG/
   WEBP/GIF, máx. 5MB cada una). Al enviar se encadenan tres llamadas en
   una sola acción: crea el lote, crea el registro de producción, sube
   las fotos.
4. **Mis registros** (`/produccion`) — lista los propios registros de
   producción con badge Borrador/Validado, y sus fotos. Si un registro
   quedó en borrador sin fotos (dato de prueba anterior a que la foto
   fuera obligatoria), se puede agregar ahí mismo mientras siga sin
   validar.
5. **Seguimiento de mi cosecha** (`/panel/seguimiento`) — solo lectura.
   Por cada lote propio: stepper de 6 etapas, línea de tiempo detallada
   (fecha y validador por etapa), fotos de evidencia, y el código QR si
   ya existe (ver limitaciones, hoy nunca existe).

**Prerrequisito para que el lote avance**: Cooperativa debe validar el
registro de producción.

### Cooperativa

**Sidebar**: Mi perfil · Validar productores · Registrar acopio · Mis
registros de acopio

**Prerrequisito**: que exista al menos un registro de producción en
`borrador` (lo crea un Productor).

1. **Validar productores** (`/produccion/validar`) — lista todo registro
   de producción en borrador de *cualquier* productor (no solo uno en
   particular), con nombre de quien lo registró, variedad, fecha de
   cosecha y volumen. Botón "Validar" por fila — solo existe esa acción,
   no hay "Rechazar" en ninguna pantalla del sistema. Al validar, el lote
   avanza a la etapa `acopio`.
2. **Registrar acopio** (`/acopio/nuevo`) — requiere un lote en
   `estado_macro = 'acopio'` (el selector solo muestra esos). Campos:
   lote, peso recibido en kg, humedad en % (0–100), fecha de recepción.
3. **Mis registros de acopio** (`/acopio`) — lista propia con badge
   Borrador/Validado.

**Prerrequisito para avanzar**: Planta de Procesamiento valida el acopio.

### Planta de Procesamiento

**Sidebar**: Mi perfil · Validar acopio · Registrar procesamiento · Mis
registros de procesamiento

**Prerrequisito**: acopio en borrador existente.

1. **Validar acopio** (`/acopio/validar`) — mismo patrón que arriba (lista
   pendientes, botón Validar). Avanza el lote a `procesamiento`.
2. **Registrar procesamiento** (`/procesamiento/nuevo`) — requiere lote en
   `estado_macro = 'procesamiento'`. Campos: lote, **ruta de exportación**
   (select: "A — Materia prima" o "B — Valor agregado"; **se fija una
   sola vez para todo el lote** — si ya estaba fijada y se intenta enviar
   una ruta distinta, el backend lo rechaza), método de beneficio (texto
   libre), tipo de secado (texto libre). El modelo también tiene un campo
   `detalles_json` que el backend acepta, pero **el formulario actual no
   lo expone** — siempre queda `NULL` vía la interfaz.
3. **Mis registros de procesamiento** (`/procesamiento`).

**Prerrequisito para avanzar**: SENASA valida el procesamiento — esa
validación **es** la certificación fitosanitaria (ver sección 6, no hay
paso separado).

### SENASA

**Sidebar**: Mi perfil · Validar certificación fitosanitaria (única acción)

**Prerrequisito**: procesamiento en borrador.

1. **Validar certificación fitosanitaria** (`/procesamiento/validar`) —
   valida pendientes de procesamiento. Al validar, el lote salta directo
   de `procesamiento` a `exportacion` (nunca pasa por un estado
   `certificacion_sanitaria` separado, aunque el enum de la base de datos
   lo contempla — ver sección 6).

SENASA "no registra documentos propios, solo aprueba/rechaza lo que sube la
Planta" según el modelo de negocio, pero en la práctica hoy solo puede
aprobar — no hay botón de rechazo en ninguna pantalla.

### Exportador

**Sidebar**: Mi perfil · Registrar exportación · Mis registros de
exportación

**Prerrequisito**: lote en `estado_macro = 'exportacion'` (llega ahí
cuando SENASA valida el procesamiento).

1. **Registrar exportación** (`/exportacion/nuevo`) — campos: lote,
   puerto (texto libre), destino (texto libre), contenedor (texto libre).
2. **Mis registros de exportación** (`/exportacion`).

**Prerrequisito para avanzar**: SUNAT valida la exportación → el lote pasa
a `entregado`, el estado final del flujo.

### SUNAT

**Sidebar**: Mi perfil · Validar documentación aduanera (única acción)

**Prerrequisito**: exportación en borrador.

1. **Validar documentación aduanera** (`/exportacion/validar`) — al
   validar, el lote pasa a `entregado`. No hay ninguna acción posterior a
   esta en el flujo del lote.

### Administrador

**Sidebar**: Mi perfil · Configuración del sitio

1. **Configuración del sitio** (`/panel/configuracion`) — campos: nombre
   de la plataforma (texto) e imagen de fondo del hero de la landing
   (archivo de imagen, opcional subir una nueva; muestra preview de la
   actual). Botón "Guardar cambios" — al menos uno de los dos campos debe
   cambiar.

El backend tiene `POST /api/auth/register` (dar de alta usuarios de
cualquier rol, restringido a `admin`) pero **no existe ninguna pantalla
para esto** — para crear un usuario de prueba nuevo hay que usar curl/
Postman o editar `backend/src/seed.js`. Tampoco existe una pantalla de
"gestión de usuarios" ni "ver todo el sistema" — el Administrador hoy solo
tiene Configuración del sitio.

---

## 4. Flujo de punta a punta sugerido para probar todo

Guión concreto, un lote de café por Ruta A (materia prima, el camino más
corto) desde Producción hasta aparecer en el catálogo público con su
ficha de trazabilidad. Cada paso indica con qué usuario y qué clics.

1. **Login como Productor** (`productor1@raiz.test` / `Test1234!`) en
   `/login` → redirige a `/panel/perfil`.
2. Ir a **Mis parcelas** → **"+ Registrar nueva parcela"**: nombre
   cualquiera, elegir zona, tipo de cultivo "Café", clic en "Usar mi
   ubicación GPS actual" (el navegador pedirá permiso — aceptar) →
   "Registrar parcela".
3. Ir a **Registrar cosecha**: elegir la parcela recién creada, producto
   "Café", cualquier variedad, fecha de cosecha, un volumen en kg, clic
   "+ Agregar foto" y elegir cualquier imagen del equipo → "Registrar
   cosecha". Anotar el código del lote que aparece en "Mis registros"
   (formato `RZ-CAF-AAAAMMDD-XXXXXX`).
4. **Cerrar sesión** → login como **Cooperativa**
   (`cooperativa1@raiz.test`).
5. **Validar productores** → localizar el lote del paso 3 → "Validar".
6. **Registrar acopio**: el lote ya debería aparecer en el selector →
   peso, humedad, fecha de recepción → "Registrar acopio".
7. **Cerrar sesión** → login como **Planta de Procesamiento**
   (`planta1@raiz.test`).
8. **Validar acopio** → "Validar" sobre el lote.
9. **Registrar procesamiento**: elegir el lote, ruta **"A — Materia
   prima"**, método de beneficio y tipo de secado (cualquier texto) →
   "Registrar procesamiento".
10. **Cerrar sesión** → login como **SENASA** (`senasa1@raiz.test`).
11. **Validar certificación fitosanitaria** → "Validar". El lote pasa
    directo a `exportacion`.
12. **Cerrar sesión** → login como **Exportador**
    (`exportador1@raiz.test`).
13. **Registrar exportación**: elegir el lote, puerto/destino/contenedor
    (cualquier texto) → "Registrar exportación".
14. **Cerrar sesión** → login como **SUNAT** (`sunat1@raiz.test`).
15. **Validar documentación aduanera** → "Validar". El lote queda
    `entregado` — fin del flujo interno.
16. Sin sesión (o cerrar sesión), ir a **`/`** (landing pública) → bajar
    hasta "Lotes con trazabilidad completa" → el lote del paso 3 debería
    aparecer ahí ahora (ya cumple el requisito: producción **y**
    procesamiento validados).
17. Clic en la tarjeta → **`/trazabilidad/<código>`** → confirmar línea de
    tiempo con las 4 etapas validadas, mapa de la parcela (si se aceptó
    el permiso de GPS en el paso 2), QR generado en el navegador, botón
    "Descargar ficha en PDF".
18. Opcional: login de nuevo como el Productor original → **Seguimiento
    de mi cosecha** → confirmar que el lote muestra el stepper completo
    hasta "Entregado" y cada validador correcto.

Para probar **Ruta B** (valor agregado), repetir desde el paso 9 eligiendo
"B — Valor agregado" — el resto del flujo es idéntico (no hay pantalla de
"transformación" que registrar, ver sección 6).

---

## 5. Landing pública y consulta sin login

No requiere sesión ni cuenta. URL raíz: `/` (o la URL del túnel público,
si hay uno activo).

- **Hero**: imagen de fondo (configurable por Administrador), nombre de
  la plataforma, CTA "Explorar catálogo ↓".
- **Sección institucional**: texto "Quiénes somos" + diagrama de la
  cadena (Producción → Acopio → Procesamiento → Exportación).
- **Catálogo** (`#catalogo`, mismo `/`): tarjetas de lotes con filtros por
  Producto (Café/Cacao), Ruta (Materia prima/Valor agregado) y Zona
  (select). Los filtros llaman `GET /catalogo` con esos mismos parámetros
  como query string. **Un lote solo aparece si tiene tanto su registro de
  producción como su registro de procesamiento en estado `validado`** —
  ni Acopio ni Exportación afectan si aparece o no en el catálogo, solo
  esos dos.
- Clic en una tarjeta → **`/trazabilidad/<código>`**, o se puede escribir
  la URL directamente si ya se conoce el código del lote. Esta página
  también es de acceso público (sin login) — es la URL literal que un
  código QR resolvería. Muestra: línea de tiempo (solo las etapas que ya
  están validadas, no las pendientes — a diferencia de "Seguimiento de mi
  cosecha" del Productor, que sí muestra las 6), mapa real de la parcela
  vía OpenStreetMap (si la parcela tiene coordenadas), sección de fotos
  (ver limitación abajo, hoy siempre vacía), certificaciones (siempre
  vacía, ver sección 6), código QR generado en el navegador (codifica la
  URL de la propia ficha, no es un QR persistido por el sistema), y botón
  para descargar la ficha en PDF.
- El mismo gating de "producción y procesamiento validados" aplica aquí:
  pedir la ficha de un lote que todavía no llegó a esa etapa devuelve 404.

---

## 6. Limitaciones conocidas / pendientes

Para no confundir estas con bugs nuevos si aparecen durante una prueba:

- **`codigos_qr`, `certificaciones`, `registros_transformacion` — tablas
  sin ningún endpoint que las escriba.** Existen en el modelo de datos
  (migraciones 007, 009, 011) pero no hay ninguna ruta `POST`/`PUT` para
  ellas en todo el backend — están y estarán siempre vacías hasta que se
  implementen. Consecuencias concretas:
  - El QR que se ve en `/trazabilidad/:codigo` y en "Seguimiento de mi
    cosecha" es generado **en el navegador** (librería `qrcode`,
    codifica la URL de la propia ficha) — no es un código real emitido
    por el sistema, y el flujo de negocio de "el QR se genera en la
    Planta para Ruta B / en Exportador para Ruta A" **no está
    implementado**, solo documentado como decisión de diseño.
  - Elegir ruta "B — Valor agregado" en Registrar procesamiento no crea
    ningún registro de transformación — solo fija `lotes.ruta = 'B'`.
  - La sección "Certificaciones" de la ficha pública está siempre vacía.
  - `certificacion_sanitaria` existe en el enum de `estado_macro` pero el
    sistema nunca lo asigna: SENASA valida y el lote salta directo de
    `procesamiento` a `exportacion` (decisión de alcance documentada en
    `docs/CONTEXTO.md`: la validación de SENASA sobre
    `registros_procesamiento` **es** la certificación fitosanitaria).
- **La ficha pública de trazabilidad no muestra las fotos de evidencia**,
  aunque el Productor sí las sube y sí existen en la base de datos
  (`fotos_registro_produccion`). `GET /trazabilidad/:codigo` devuelve
  `fotos: []` siempre — el endpoint nunca se conectó a esa tabla después
  de agregarse. "Seguimiento de mi cosecha" (vista interna del Productor)
  sí las muestra correctamente porque usa un endpoint distinto
  (`GET /api/lotes/mios/estado`). No confundir con que "no hay fotos": si
  el Productor subió fotos, existen, solo no se ven en la ficha pública
  todavía.
- **No hay botón de "Rechazar" en ninguna pantalla de validación** —
  Cooperativa, Planta, SENASA y SUNAT solo pueden "Validar". El modelo
  conceptualmente permite rechazo pero no hay ningún endpoint de negocio
  que lo implemente.
- **No hay pantalla para editar un registro en borrador**, aunque el
  endpoint existe en el backend (`PUT /api/registros/<etapa>/:id`,
  compartido por las 4 etapas vía `etapaRouter.js`) — ningún rol tiene un
  botón "Editar" en sus listas. Un registro validado tampoco se puede
  editar nunca (por diseño, es inmutable); la única vía es una
  **corrección**.
- **Correcciones sin pantalla**: `POST /api/correcciones` existe y
  funciona (permite corregir un registro ya validado sin tocar el
  original) pero no tiene ninguna interfaz — solo se puede probar con
  curl/Postman.
- **Gestión de usuarios sin pantalla**: `POST /api/auth/register` existe
  (solo `admin`) pero no hay formulario — crear una cuenta nueva requiere
  curl/Postman o editar `backend/src/seed.js` y correr `npm run seed`.
- El formulario de **Registrar procesamiento** no expone el campo
  `detalles_json` que el backend sí acepta — queda `NULL` siempre que se
  use la interfaz (solo se puede poblar manualmente vía API).
- **Login (`/login`) y el instante antes de redirigir desde `/panel`**
  siguen usando el tema visual original del proyecto (`App.css`, morado/
  oscuro) — no se migraron a la paleta café/cacao del resto de la
  plataforma porque no se pidió explícitamente en el rediseño de color.
- El **modo claro** de la paleta (`prefers-color-scheme: light`) existe
  en `styles/paleta.css` pero nunca se ha visto renderizado en ninguna
  sesión de pruebas (el entorno usado siempre reporta modo oscuro) —
  está definido con la misma lógica de contraste que el oscuro pero sin
  verificación visual real.
- El **mini-mapa** (tanto en la ficha pública como en "Mis parcelas" del
  panel) solo aparece si la parcela tiene `ubicacion_lat`/
  `ubicacion_lng` — si se denegó el permiso de geolocalización al crear
  la parcela, esos campos quedan `NULL` y la sección de mapa
  simplemente no se muestra (no es un error).
- Ya existen algunos lotes de prueba de sesiones anteriores en la base de
  datos (ids con fechas `2026-07-19`/`2026-07-20`), incluidos al menos
  dos ya `entregado` — se puede usar cualquiera de ellos para probar
  `/trazabilidad/:codigo` o el catálogo sin tener que correr el flujo
  completo primero.
