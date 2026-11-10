# DíaLista — Fase 4

Aplicación web responsive para organizar tareas por días, en español. Funciona en modo local sin cuenta y, al iniciar sesión, sincroniza las tareas entre dispositivos y permite compartir una lista entre dos personas. Además se puede **instalar en el móvil** como una aplicación y **abrir la última copia de tus tareas sin conexión**.

> **Estado:** Fase 4 completa. Incluye todo lo de la Fase 3 y añade una PWA instalable
> (manifiesto, iconos y service worker), aviso de instalación con pasos para iPhone,
> caché offline de la sesión y de las tareas, y un despliegue con Docker y Caddy que
> obtiene HTTPS automáticamente.

## Stack

- **React 19 + Vite + TypeScript** en el cliente.
- **Node.js + Express 5** en el servidor.
- **Base de datos JSON** con escritura atómica y cola de guardado; sin dependencias
  nativas ni servicios externos.
- **SSE** para cambios en vivo y **polling** de respaldo.
- **PWA sin dependencias:** manifiesto y service worker propios.
- **Docker + Caddy** para el despliegue, con HTTPS automático.
- **Vitest** para las pruebas de lógica y de la API.
- Sin librerías de UI ni fuentes externas.

El cliente mantiene una única fuente de verdad para las tareas y separa dominio,
persistencia, hooks e interfaz. El modo local sigue usando `localStorage`. El modo
con cuenta usa la API y guarda **una última copia** de las tareas de cada lista en
`localStorage` para poder abrirla sin conexión (ver [Uso sin conexión](#uso-sin-conexión)).

## Cómo ejecutarlo

Requisitos: Node.js 22.12 o superior y npm.

### Desarrollo

```bash
npm install
npm run dev
```

`npm run dev` arranca a la vez:

- Vite en `http://localhost:5173` (interfaz).
- La API en `http://127.0.0.1:8787`.
- Vite redirige `/api` al servidor sin reescribir el host, para que la comprobación
  de origen del servidor siga funcionando.

En desarrollo **el service worker no se registra**, para no interferir con Vite. La
instalación y el modo sin conexión se prueban con la compilación de producción.

Si PowerShell bloquea `npm.ps1` con un error de políticas de ejecución, usa:

```powershell
npm.cmd install
npm.cmd run dev
```

### Producción en local

```bash
npm run build
npm start
```

Abre `http://localhost:8787`. `localhost` es un contexto seguro: el service worker se
registra y Chrome o Edge ofrecen instalar la aplicación.

### Producción en un servidor

Para instalar la app en un móvil, la dirección debe ser **HTTPS**. La guía está en
[Despliegue](#despliegue).

### Otros comandos

```bash
npm run dev:web      # solo Vite
npm run dev:server   # solo la API con recarga
npm run build        # cliente + servidor + dist/
npm run build:server # solo el servidor TypeScript
npm start            # API + interfaz compilada
npm run start:api    # solo la API
npm test             # 114 pruebas de lógica, API y copias offline
npm run test:watch   # pruebas en modo vigilancia
npm run lint         # Oxlint
```

### Opciones del servidor

Las opciones se pueden pasar como argumentos (`--port=8080`) o como variables de
entorno:

| Opción | Variable | Valor por defecto |
| --- | --- | --- |
| Puerto | `PORT` | `8787` |
| Interfaz de red | `HOST` | `127.0.0.1` |
| Directorio de datos | `DATA_DIR` | `./data` |
| Archivo de datos | `DATA_FILE` | `<DATA_DIR>/dialista.json` |
| Servir el cliente | `SERVE_STATIC=true` o `--serve-static` | desactivado |
| Directorio del cliente | `STATIC_DIR` | `./dist` |
| Duración de sesión | `SESSION_DAYS` | `30` |
| Cookie `Secure` | `COOKIE_SECURE=true` | desactivado |
| Confiar en proxy | `TRUST_PROXY=true` | desactivado |
| Límite del cuerpo | `BODY_LIMIT` | `5mb` |
| Límite de acceso | `AUTH_RATE_LIMIT` | `30` por IP cada 10 min |

`AUTH_RATE_LIMIT=off` desactiva el límite (solo recomendable en pruebas).
También existen `--host=`, `--data-dir=` y `--static-dir=`.

## Funcionalidad

### Fase 1

- [x] Crear, editar y eliminar tareas con confirmación.
- [x] Marcar tareas como hechas y sellar `completedAt` con fecha y hora ISO.
- [x] Cambiar el estado a **Pendiente**, **En progreso** o **Hecha**.
- [x] Vistas **Hoy**, **Mañana**, **Esta semana**, **Atrasadas** y **Sin fecha**.
- [x] Vista de un día concreto mediante el selector de fecha y flechas.
- [x] Progreso de hoy con contador y porcentaje (`3/7 hechas`).
- [x] Filtros por estado, prioridad y proyecto, combinables y limpiables.
- [x] Orden por hora ascendente, sin hora al final, y luego prioridad.
- [x] Resaltado visual de tareas atrasadas y antigüedad del retraso.
- [x] Mover una tarea atrasada a hoy individualmente.
- [x] Selección múltiple en **Atrasadas** y movimiento en lote a hoy.
- [x] Persistencia en localStorage con esquema versionado.
- [x] Validación de título obligatorio (máx. 120), fecha real y hora `HH:mm`.
- [x] Responsive para escritorio, tablet y móvil.
- [x] Estados vacíos, avisos de error y accesibilidad básica (foco visible,
      diálogos nativos, etiquetas y `aria-live`).
- [x] Cambio de día a medianoche sin recargar, también al recuperar el foco.

### Fase 2

- [x] **Subtareas** con contador (`1/3 subtareas`) y edición en el formulario.
      Al completar la tarea se marcan todas; al reabrirla se conservan.
- [x] **Recurrencia** diaria, en días laborables, semanal y mensual, con intervalo
      configurable.
- [x] Al completar una tarea recurrente se crea la siguiente aparición, pendiente y
      con las subtareas reiniciadas. `recurrenceGenerated` evita duplicados si se
      reabre y se vuelve a completar.
- [x] **Recordatorios** de 0, 10, 30, 60 o 1440 minutos antes de la hora.
- [x] Aviso in-app y **notificación del navegador opcional** con permiso.
- [x] **Búsqueda** por título, descripción, proyecto y subtareas, ignorando
      mayúsculas y tildes.
- [x] **Orden manual** con arrastrar y soltar o flechas, además del orden por hora.
      El arrastre se desactiva con filtros o búsqueda activos.
- [x] **Estadísticas**: totales, atrasadas, progreso, actividad de 7 días,
      prioridades y proyectos.
- [x] **Modo claro, oscuro o del sistema**, persistido y aplicado antes del primer
      render.
- [x] **Exportación** e **importación** JSON, combinando por identificador.
- [x] Migración automática del esquema v1 al v2 con copia de seguridad previa.
- [x] Ajustes persistidos aparte de las tareas (`dialista:settings`).

### Fase 3

- [x] **Cuentas** con nombre, correo y contraseña.
- [x] **Sesiones** persistentes mediante cookie HttpOnly; cerrar sesión vuelve al modo
      local sin borrar las tareas locales.
- [x] **Lista inicial automática** para cada cuenta, con código de invitación.
- [x] **Listas compartidas por dos personas**: unirse con código, ver quién forma
      parte y salir de la lista.
- [x] **Varias listas por cuenta**: crear listas adicionales y cambiar entre ellas
      desde la barra lateral.
- [x] **Sincronización en vivo** de altas, ediciones, cambios de estado, subtareas,
      orden, eliminaciones y tareas recurrentes.
- [x] **Actualización optimista** en el cliente y **última escritura gana** en el
      servidor, con versiones monotónicas para descartar eventos antiguos.
- [x] **Reconexión automática**: SSE con reintento y consulta de respaldo cada 20
      segundos, al recuperar el foco y al volver a la pestaña.
- [x] **Migración local → cuenta** no destructiva, combinando por ID. El aviso se
      recuerda por lista y conjunto de tareas para no repetirlo.
- [x] **Permisos**: solo las personas miembros pueden leer o modificar las tareas de
      una lista; las listas ajenas responden `404`.
- [x] **Seguridad**: contraseñas con scrypt, sesiones opacas, CSRF por origen, límite
      de intentos de acceso y validación de todas las entradas.
- [x] **Modo local conservado**: la app arranca sin cuenta y no bloquea el acceso si
      el servidor no responde.
- [x] **Interfaz de cuenta y listas**, avisos de sincronización, estados de error y
      adaptación a móvil y modo oscuro.

### Fase 4

- [x] **PWA instalable:** manifiesto con nombre, colores y modo independiente
      (`standalone`), con iconos normales, maskable y para iPhone.
- [x] **Aviso de instalación** en Chrome, Edge, Samsung Internet y otros navegadores
      que lo permiten. Se puede descartar y el descarte se recuerda.
- [x] **Pasos para iPhone y iPad:** Safari no muestra botón de instalación, así que la
      app explica cómo añadirla a la pantalla de inicio.
- [x] **Sección «Aplicación» en los ajustes**, con el botón de instalación, las
      instrucciones del navegador o el estado «instalada».
- [x] **Service worker** que guarda la interfaz compilada (HTML, JavaScript, CSS e
      iconos) y la sirve sin conexión. Las actualizaciones se aplican en la siguiente
      carga con conexión.
- [x] **Sesión sin conexión:** si el servidor no responde y hay una cuenta guardada,
      la app muestra la cuenta, sus listas y la última copia de las tareas en lugar de
      pasar al modo local.
- [x] **Tareas sin conexión:** la última copia de cada lista se guarda tras cada
      sincronización correcta y se muestra al abrir la app.
- [x] **Estado de red fiable:** el indicador muestra **Sin conexión** cuando falla la
      red, aunque el navegador diga que está conectado (por ejemplo, Wi‑Fi sin salida
      a internet).
- [x] **Privacidad al cerrar sesión:** se borran la sesión guardada y las copias de
      tareas del dispositivo. Al salir de una lista se borra su copia.
- [x] **Despliegue con Docker y Caddy:** HTTPS automático con Let's Encrypt, cabeceras
      de seguridad, usuario sin privilegios y comprobación de salud.

### Criterios de las vistas

- **Hoy**: tareas con fecha de hoy, incluidas las completadas, para calcular el
  progreso.
- **Mañana**: tareas con fecha de mañana.
- **Esta semana**: lunes a domingo de la semana actual. Las tareas anteriores a hoy
  también aparecen en **Atrasadas**.
- **Atrasadas**: no completadas con fecha anterior a hoy.
- **Sin fecha**: tareas sin día asignado.
- **Día seleccionado**: tareas de la fecha elegida en el calendario.
- Al crear desde una vista contextual se propone el día correspondiente: mañana en
  **Mañana**, la fecha elegida en la vista diaria, sin fecha en **Sin fecha** y hoy en
  el resto.

### Cómo funciona la recurrencia

- La siguiente aparición parte de la fecha asignada, pero **siempre es posterior a
  hoy**; una tarea atrasada no genera una cadena de tareas pasadas.
- **Días laborables** salta sábados y domingos.
- **Mensual** conserva el día original y se ajusta al último día del mes (31 de enero
  → 28/29 de febrero → 31 de marzo).
- La tarea original queda completada; la nueva nace pendiente, sin recordatorio
  enviado y con subtareas nuevas sin marcar.
- Solo se genera una aparición por finalización; no se crean series futuras.

### Cómo funcionan los recordatorios

- Se calculan con la fecha y hora locales de la tarea.
- La app comprueba al cargar, cada 30 segundos, al recuperar el foco y al volver a la
  pestaña.
- Hay una ventana de gracia de 6 horas para avisos tras una suspensión.
- Cada aparición avisa una sola vez (`reminderNotifiedAt`).
- **La app debe permanecer abierta**: no hay notificaciones push. El service worker
  solo guarda la aplicación para abrirla sin conexión. Las notificaciones del navegador
  requieren permiso y contexto seguro.

## Instalar en el móvil

La aplicación se instala desde el navegador. La dirección tiene que empezar por
`https://` (o ser `localhost` durante las pruebas).

**Android (Chrome, Edge o Samsung Internet)**

1. Abre la dirección de DíaLista.
2. Pulsa **Instalar** en el aviso de la app, o abre el menú del navegador y elige
   **Instalar aplicación** o **Añadir a pantalla de inicio**.
3. Abre DíaLista desde su icono. Se muestra a pantalla completa, sin la barra del
   navegador.

**iPhone y iPad (Safari)**

1. Abre la dirección en **Safari**. Otros navegadores de iOS no permiten añadir webs a
   la pantalla de inicio.
2. Pulsa el botón **Compartir** y elige **Añadir a pantalla de inicio**.
3. Confirma. El icono de DíaLista aparece en la pantalla de inicio.

**Ordenador (Chrome o Edge)**

Usa el icono **Instalar** de la barra de direcciones o el botón del aviso.

Una vez instalada, la app se actualiza sola: la nueva versión se usa la siguiente vez
que se abre con conexión.

## Uso sin conexión

La app guarda lo necesario para abrirse y mostrar tus tareas sin cobertura:

| Qué | Dónde | Cuándo se actualiza | Cuándo se borra |
| --- | --- | --- | --- |
| Interfaz (HTML, JavaScript, CSS e iconos) | Caché del service worker (`dialista-precache-v1` y `dialista-runtime-v1`) | Al instalar el service worker y en cada versión nueva | Al desinstalar la app o borrar los datos del sitio |
| Sesión mínima: nombre, correo y listas. Sin tokens | `localStorage`, clave `dialista:session-cache` | Al iniciar sesión y al cambiar de listas | Al cerrar sesión o si el servidor responde 401 |
| Última copia de las tareas de cada lista | `localStorage`, claves `dialista:remote-cache:<listId>` | Tras cada sincronización correcta y cada cambio recibido | Al cerrar sesión, al salir de la lista o al borrar los datos del sitio |

Reglas de funcionamiento:

- El service worker **nunca** guarda respuestas de `/api`. Las tareas solo llegan del
  servidor o de la copia guardada de la lista.
- La navegación se pide primero a la red; si no hay red, se abre la copia guardada.
- Los archivos con hash de la compilación (`/assets/…`) se sirven desde la caché y se
  actualizan en segundo plano. Al instalar una versión nueva se eliminan las antiguas.
- Sin conexión, la app muestra la sesión y las tareas tal como estaban en la última
  sincronización. El indicador dice **Sin conexión** y un aviso explica que se muestra
  la copia guardada.
- Al recuperar la conexión, la app vuelve a sincronizar. El servidor sigue siendo la
  fuente de verdad.

**Limitación importante:** los cambios hechos sin conexión se mantienen en memoria
mientras la pestaña está abierta y se envían al volver la conexión. **Si recargas o
cierras la app sin conexión antes de que se sincronicen, esos cambios se pierden.**
Ver [Limitaciones actuales](#limitaciones-actuales).

## Cuentas y listas compartidas

1. Sin sesión, la app funciona en modo local. El selector de lista de la barra lateral
   abre el acceso o el registro.
2. Al registrarse se crea una lista inicial llamada `Tareas de <nombre>` con un código
   de invitación de 8 caracteres.
3. Para compartir, abre el diálogo de listas y envía el código a la otra persona. Al
   introducirlo en **Unirse**, su cuenta pasa a formar parte de la lista (máximo dos
   miembros).
4. Ambas personas ven y editan las mismas tareas en tiempo real. Los cambios aparecen
   en la otra sesión mediante SSE; si la conexión se interrumpe, la consulta periódica
   recupera lo perdido.
5. Si la persona propietaria sale de una lista compartida, la otra pasa a ser
   propietaria. Si se va la última persona, la lista y sus tareas se eliminan.
6. Cada cuenta puede crear listas adicionales y unirse a listas de otras cuentas. Las
   listas se cambian desde el selector lateral.

### Migración de las tareas locales

Al iniciar sesión, si el dispositivo tiene tareas locales, aparece un aviso con la
opción **Copiar a esta lista**. La copia:

- combina por identificador y **no borra** las tareas locales;
- no duplica tareas que ya existan con el mismo ID;
- recuerda por lista qué conjunto de tareas locales ya se copió o se descartó,
  mediante una firma de IDs guardada en `localStorage`;
- vuelve a mostrar el aviso si se crean tareas locales nuevas o se cambia a otra lista
  que aún no las haya recibido.

## Sincronización y datos

### Modelo remoto

```ts
{
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  assignedDate: string | null
  time: string | null
  project: string | null
  createdAt: string
  completedAt: string | null
  order: number
  subtasks: { id: string; title: string; done: boolean }[]
  recurrence: {
    frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly'
    interval: number
  } | null
  reminderMinutes: number | null
  reminderNotifiedAt: string | null
  recurrenceGenerated: boolean
}
```

El servidor guarda cada tarea con `updatedAt` y una marca `deleted` (lápida). Las
versiones son estrictamente crecientes: si dos escrituras llegan en el mismo
milisegundo, la segunda recibe una versión posterior. El cliente:

- aplica cambios de forma optimista;
- encola las escrituras pendientes en un *outbox* en memoria y reintenta cada 5
  segundos mientras la pestaña esté abierta;
- ignora eventos remotos con una versión menor o igual a la conocida;
- no pisa una tarea mientras su escritura local está pendiente;
- conserva las lápidas para que un evento repetido no resucite una tarea.

La sincronización es **última escritura gana**. No hay fusión por campos: si dos
personas editan la misma tarea a la vez, prevalece la escritura que el servidor recibe
en último lugar.

### Persistencia local (modo sin cuenta)

- Clave de tareas: `dialista:data`.
- Esquema actual: `{ schemaVersion: 2, tasks: Task[] }`.
- Clave de ajustes: `dialista:settings`.
- Firma de migración: `dialista:migration:<listId>`.

```ts
{
  theme: 'light' | 'dark' | 'system'
  sortMode: 'time' | 'manual'
  browserNotifications: boolean
}
```

- Los datos v1 se migran al abrirlos y se guarda una copia del JSON original.
- Si el JSON está dañado, se respalda antes de iniciar una lista vacía.
- Si una versión futura guardó los datos, no se sobrescriben.
- Si localStorage está bloqueado, la app funciona en memoria y avisa.
- Las fechas de asignación son claves locales `YYYY-MM-DD`; los instantes se guardan en
  ISO 8601.

### Copias en el dispositivo (Fase 4)

- Sesión mínima: `dialista:session-cache`, con el usuario y sus listas. No contiene
  tokens: la cookie de sesión es `HttpOnly`.
- Última copia por lista: `dialista:remote-cache:<listId>`, con las tareas y la fecha
  de la última sincronización correcta.
- Aviso de instalación descartado: `dialista:install-dismissed`.
- Caché del service worker: `dialista-precache-v1` y `dialista-runtime-v1`.

Las versiones de cada copia se validan al leerlas: si el formato no coincide, se ignora
y se vuelve a descargar del servidor.

### Persistencia del servidor

- Archivo por defecto: `data/dialista.json`.
- Esquema del servidor: `schemaVersion: 1` con `users`, `sessions`, `lists` y `tasks`.
- Cada guardado escribe un temporal en el mismo directorio y lo renombra de forma
  atómica. Las escrituras se encadenan para no pisarse.
- Si el JSON está dañado o es de una versión más reciente, el servidor **no lo
  sobrescribe** y falla al arrancar.
- El archivo se crea con permisos `0600` cuando el sistema lo permite.
- Las contraseñas se guardan como `scrypt:<sal>:<hash>`; nunca en claro.
- Los tokens de sesión se guardan solo como hash SHA-256.

### Exportación e importación

```ts
{
  app: 'DiaLista'
  schemaVersion: 2
  exportedAt: string
  tasks: Task[]
}
```

La importación acepta ese envoltorio o una lista de tareas, normaliza los datos y omite
entradas no válidas o duplicadas. El límite del archivo es de 5 MB. Sigue disponible
tanto en modo local como con cuenta, y actúa sobre la lista activa.

## API

Todas las rutas, salvo el alta y el acceso, requieren la cookie de sesión.

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/health` | Comprobación de salud |
| `POST` | `/api/auth/register` | Crear cuenta y lista inicial |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `GET` | `/api/auth/session` | Sesión actual y listas |
| `GET` | `/api/lists` | Listas de la cuenta |
| `POST` | `/api/lists` | Crear lista |
| `POST` | `/api/lists/join` | Unirse con código |
| `POST` | `/api/lists/:listId/leave` | Salir de una lista |
| `GET` | `/api/lists/:listId/tasks?since=` | Instantánea o cambios desde una versión |
| `PUT` | `/api/lists/:listId/tasks` | Crear o actualizar una tarea |
| `POST` | `/api/lists/:listId/tasks/bulk` | Sincronizar hasta 500 tareas |
| `DELETE` | `/api/lists/:listId/tasks/:taskId` | Eliminar con lápida |
| `GET` | `/api/lists/:listId/events?since=` | Flujo SSE de cambios |

## Seguridad

- **Contraseñas:** scrypt con sal aleatoria de 16 bytes y clave de 64 bytes.
  Comparación con `timingSafeEqual`.
- **Sesiones:** token aleatorio de 32 bytes, guardado como hash SHA-256. Cookie
  `dialista_session` `HttpOnly`, `SameSite=Lax`, `Path=/`, con caducidad configurable.
  En producción debe activarse `COOKIE_SECURE=true` bajo HTTPS.
- **CSRF:** las peticiones de escritura comprueban `Origin` contra `Host`. El
  despliegue recomendado sirve interfaz y API en el mismo origen.
- **Autorización:** cada operación comprueba la pertenencia a la lista. Una lista ajena
  se trata como inexistente (`404`).
- **Fuerza bruta:** límite deslizante de 30 intentos de acceso por IP cada 10 minutos.
  Es un límite en memoria para una instancia.
- **Validación:** título, fechas reales, horas, recordatorios, recurrencia, subtareas,
  correo, contraseña (8–200 caracteres) y nombres de lista. Límite de cuerpo de 5 MB y
  de 500 tareas por lote.
- **Caché offline:** el service worker no cachea `/api`. La sesión guardada no contiene
  tokens. Cerrar sesión borra la sesión y las copias de tareas del dispositivo.
- **Cabeceras HTTP (Caddy):** HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`.
- **Datos en reposo:** la base JSON del servidor y las copias de `localStorage` no
  están cifradas. Protege el servidor con permisos y copias de seguridad, y el móvil con
  bloqueo de pantalla.
- **Sin secretos en el cliente:** el frontend solo usa la cookie de sesión.

## Estructura

```text
src/
├── App.tsx                    # composición, vistas, filtros y diálogos
├── types.ts                   # modelo y tipos compartidos
├── domain/                    # lógica pura y comprobable
│   ├── dates.ts               # días locales, semanas, DST, medianoche
│   ├── tasks.ts               # validación, subtareas, recordatorios, orden
│   ├── recurrence.ts          # siguientes apariciones
│   ├── selectors.ts           # vistas, búsqueda, filtros y contadores
│   ├── statistics.ts          # métricas y agregados
│   └── *.test.ts
├── data/
│   ├── apiClient.ts           # cliente REST y SSE; clasifica los errores de red
│   ├── taskRepository.ts      # localStorage, esquema v2 y migraciones
│   ├── taskTransfer.ts        # exportación e importación JSON
│   ├── taskSync.ts            # diff, versiones y fusión de cambios
│   ├── syncPreferences.ts     # firma persistente de migración
│   ├── sessionCache.ts        # sesión mínima para abrir sin conexión (sin tokens)
│   ├── remoteCache.ts         # última copia de tareas por lista
│   └── settingsRepository.ts  # tema, orden y notificaciones
├── hooks/
│   ├── useAuth.ts             # sesión, cuentas, listas y limpieza de copias
│   ├── useTasks.ts            # modo local/remoto, outbox, SSE y copia offline
│   ├── usePwaInstall.ts       # evento de instalación, iOS y descarte
│   ├── useSettings.ts         # ajustes y tema del sistema
│   ├── useReminders.ts        # comprobación de recordatorios
│   ├── useToday.ts            # cambio de día a medianoche
│   └── useToast.ts
├── components/                # interfaz (auth, listas, tareas, ajustes, instalación…)
├── lib/                       # formatos y etiquetas en español
└── styles/                    # tokens, tema oscuro y responsive

public/
├── manifest.webmanifest       # nombre, colores, iconos y modo standalone
├── sw.js                      # service worker: precarga y caché sin conexión
├── icons/                     # 180, 192, 512 y maskable 512 (PNG)
└── favicon.svg

server/
├── index.ts                   # arranque, opciones y cierre ordenado
├── app.ts                     # rutas REST, SSE, permisos y CSRF
├── auth.ts                    # scrypt, sesiones, cookies y límite
├── store.ts                   # JSON atómico, versiones y lápidas
├── validation.ts              # normalización y validación de entradas
├── types.ts                   # modelo del servidor
└── *.test.ts

Dockerfile                     # imagen de producción (build en varias etapas)
.dockerignore
deploy/
├── docker-compose.yml         # DíaLista + Caddy
├── Caddyfile                  # HTTPS automático y cabeceras
└── .env.example               # DOMAIN y ACME_EMAIL
```

## Pruebas incluidas

`npm test` ejecuta **114 pruebas** en **15 archivos**:

- `src/domain/dates.test.ts`: fechas locales, semanas, DST y medianoche.
- `src/domain/tasks.test.ts`: validación, estados, subtareas, recurrencia y
  recordatorios.
- `src/domain/recurrence.test.ts`: reglas diarias, laborables, semanales y mensuales.
- `src/domain/selectors.test.ts`: vistas, filtros, búsqueda y contadores.
- `src/domain/statistics.test.ts`: totales y agregados.
- `src/data/taskRepository.test.ts`: migraciones, datos dañados y errores de
  almacenamiento.
- `src/data/taskTransfer.test.ts`: exportación e importación.
- `src/data/taskSync.test.ts`: diferencias por identidad, versiones, lápidas y escrituras
  pendientes.
- `src/data/syncPreferences.test.ts`: firma estable de tareas locales y persistencia por
  lista tolerante a errores.
- `src/data/apiClient.test.ts`: clasificación de fallos de red, sesión caducada y
  respuestas del servidor.
- `src/data/sessionCache.test.ts`: guardado, validación y borrado de la sesión mínima.
- `src/data/remoteCache.test.ts`: copias por lista, reparación de datos dañados y
  borrado selectivo o completo.
- `server/app.test.ts`: registro, sesión, invitaciones, límite de dos miembros, permisos,
  sincronización, lápidas, lotes y SSE.
- `server/store.test.ts`: persistencia atómica, versiones monotónicas, poda de sesiones
  y protección ante JSON dañado.
- `server/validation.test.ts`: normalización de tareas, cuentas y listas.

Además se verificó la Fase 4 con un recorrido E2E en Chromium (Playwright): manifiesto
e iconos válidos, service worker activo y cachés, instalabilidad según Chrome, aviso de
instalación y descarte, instalación desde los ajustes, tarea sincronizada y copiada,
recarga con el servidor detenido, vuelta a la conexión, cierre de sesión que borra las
copias, primera visita seguida de apertura sin conexión tras reiniciar el navegador, y
los pasos de iPhone (con su agente de usuario simulado).

También se verificó la Fase 3 con un recorrido E2E real de dos usuarios (registro,
migración, invitación, convivencia en la lista, sincronización en vivo de
creación/edición/completado, recarga, cierre y reapertura de sesión, modo móvil y
ausencia de errores de JavaScript).

## Cómo probar la Fase 4 manualmente

1. Compila y arranca la versión de producción: `npm run build` y `npm start`. Abre
   `http://localhost:8787` en Chrome.
2. Instala la app con el aviso **Instalar** o con el icono de la barra de direcciones.
   Debe abrirse en su propia ventana, sin barra de direcciones.
3. En DevTools → Application → Service Workers, el service worker debe aparecer como
   *activated and is running*. En Cache Storage están `dialista-precache-v1` y
   `dialista-runtime-v1`.
4. Crea una cuenta, añade algunas tareas y espera a ver **Sincronizado**.
5. Detén el servidor (o activa Offline en DevTools) y recarga. La app debe abrir con las
   tareas, mostrar **Sin conexión** y el aviso de copia guardada.
6. Vuelve a levantar el servidor: el estado pasa a **Sincronizado**.
7. En Ajustes → **Cerrar sesión**, comprueba en Application → Local Storage que ya no
   aparecen `dialista:session-cache` ni `dialista:remote-cache:*`.
8. En el móvil, abre la dirección HTTPS del despliegue y sigue
   [Instalar en el móvil](#instalar-en-el-móvil).

En desarrollo (`npm run dev`) el service worker no se registra, así que la instalación y
el modo sin conexión no se pueden probar ahí.

## Cómo probar la Fase 3 manualmente

1. Arranca `npm run dev` y abre dos navegadores o dos ventanas privadas.
2. En la primera, crea una tarea sin cuenta. Después abre el selector de lista y crea
   una cuenta. Debe aparecer el aviso para copiar la tarea local.
3. Copia la tarea y comprueba que desaparece el aviso. Cierra sesión, vuelve a entrar y
   verifica que el aviso no reaparece.
4. En la segunda ventana, crea otra cuenta. En la primera, abre el diálogo de listas y
   copia el código de invitación.
5. En la segunda, introduce el código en **Unirse**. Debe cambiar a la lista compartida
   y ver las tareas existentes.
6. Crea una tarea en una ventana: debe aparecer en la otra sin recargar. Edita y completa
   desde la segunda: la primera debe reflejarlo.
7. Recarga ambas ventanas y comprueba que la sesión y las tareas persisten.
8. Intenta unirte a la lista con una tercera cuenta: debe rechazarse porque ya tiene dos
   miembros.
9. Sal de la lista desde una cuenta y comprueba que la otra sigue viéndola.
10. Reduce la ventana a tamaño móvil y revisa el acceso, el diálogo de listas y la barra
    lateral sin desbordamiento horizontal.

## Despliegue

La opción recomendada es **Docker Compose con Caddy delante**. Caddy obtiene y renueva
el certificado HTTPS automáticamente y reenvía las peticiones a DíaLista, que sirve la
interfaz y la API en el mismo origen.

### Requisitos

- Un servidor Linux con Docker y Docker Compose v2. Un VPS pequeño basta.
- Un dominio o subdominio, por ejemplo `dialista.tudominio.com`, con un registro `A` (y
  `AAAA` si hay IPv6) apuntando a la IP del servidor.
- Los puertos **80** y **443** abiertos. El 80 valida el certificado y redirige a HTTPS.

### 1. Configurar el dominio

```bash
cd deploy
cp .env.example .env
```

Edita `deploy/.env`:

```ini
DOMAIN=dialista.tudominio.com
ACME_EMAIL=tu-correo@example.com
```

### 2. Arrancar

```bash
cd deploy
docker compose up -d --build
docker compose ps
```

En el primer arranque Caddy pide el certificado, lo que puede tardar un par de minutos.
Comprueba que responde por HTTPS:

```bash
curl -fsS https://dialista.tudominio.com/api/health
```

Debe devolver `{"ok":true,...}`.

### 3. Qué hay en marcha

| Servicio | Imagen | Función |
| --- | --- | --- |
| `dialista` | `Dockerfile` del proyecto (Node 24, build en varias etapas) | API y interfaz compilada. Usuario sin privilegios. Datos en el volumen `dialista-data`. Comprobación de salud con `/api/health`. |
| `caddy` | `caddy:2-alpine` | HTTPS automático, redirección, cabeceras de seguridad y reenvío a `dialista:8787`. Es el único servicio que publica puertos. |

El `Caddyfile` no cachea `/sw.js`, para que las actualizaciones del service worker
lleguen siempre, y sirve el manifiesto con su tipo MIME.

### 4. Instalar en el móvil

Abre `https://dialista.tudominio.com` en el móvil y sigue
[Instalar en el móvil](#instalar-en-el-móvil).

### 5. Actualizar

Copia la nueva versión del proyecto al servidor y ejecuta:

```bash
cd deploy
docker compose up -d --build
```

Los datos del volumen `dialista-data` se conservan.

### 6. Copias de seguridad

Para una copia, lee el archivo de datos desde el contenedor y guárdalo fuera del
servidor:

```bash
cd deploy
docker compose exec -T dialista cat /app/data/dialista.json > dialista-backup.json
```

Para restaurar, detén el servicio para que no sobrescriba el archivo, copia la copia de
vuelta y arráncalo de nuevo:

```bash
cd deploy
docker compose stop dialista
docker compose run --rm -T --entrypoint sh dialista -c 'cat > /app/data/dialista.json' < dialista-backup.json
docker compose start dialista
```

### Sin Docker

Si prefieres ejecutar Node directamente, la alternativa es:

```bash
npm ci
npm run build
```

Con las variables `HOST=0.0.0.0`, `PORT=8787`, `DATA_DIR=/var/lib/dialista`,
`COOKIE_SECURE=true` y `TRUST_PROXY=true`, arranca con `npm start`. Delante necesitas un
proxy HTTPS. Ejemplo de Nginx:

```nginx
server {
    listen 443 ssl;
    server_name dialista.example.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE: no acumular la respuesta
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

Mantén **una sola instancia**: el límite de intentos y la difusión SSE viven en memoria
y la base JSON no coordina varios procesos.

### Checklist de producción

- [ ] `DOMAIN` y `ACME_EMAIL` definidos en `deploy/.env`, con el registro DNS apuntando
      al servidor.
- [ ] Puertos 80 y 443 abiertos. El puerto 8787 no se publica.
- [ ] `https://<dominio>/api/health` responde `ok: true`.
- [ ] La app se ha instalado en un móvil real (Android e iPhone) y se abre sin conexión.
- [ ] Copia de seguridad programada y prueba de restauración.
- [ ] Una sola instancia, o almacenamiento compartido antes de escalar.
- [ ] El archivo de datos y el volumen tienen permisos restringidos.

## Limitaciones actuales

- **Cambios sin conexión no persistentes:** el *outbox* vive en memoria. Si se recarga o
  se cierra la app sin conexión antes de sincronizar, esos cambios se pierden. Es la
  mejora prioritaria pendiente.
- **Una sola instancia:** el almacén JSON, el límite de acceso y SSE no están preparados
  para varias réplicas sin coordinación externa.
- **Copias en `localStorage` sin cifrar:** la sesión mínima y las tareas guardadas
  quedan en el dispositivo sin cifrar.
- **Datos de sitios poco usados:** los navegadores pueden borrar el almacenamiento de
  sitios que no se usan durante mucho tiempo. En ese caso, la copia sin conexión se
  recrea al abrir la app con conexión.
- **Sin tienda de aplicaciones:** la PWA se instala desde el navegador. Publicarla en
  App Store o Google Play requiere envolverla (por ejemplo con Capacitor) y pasar sus
  revisiones.
- **Instalación en iPhone manual:** Safari no ofrece el aviso automático; la app muestra
  los pasos.
- **Sin notificaciones push ni sincronización en segundo plano:** los recordatorios y los
  envíos pendientes requieren que la app esté abierta.
- **Dos miembros por lista**; no hay grupos mayores ni roles avanzados.
- **Última escritura gana** sin fusión por campos: dos ediciones simultáneas de la misma
  tarea pueden descartar una de ellas.
- No hay verificación de correo, recuperación de contraseña, cambio de correo ni
  eliminación de cuenta desde la interfaz.
- La recurrencia genera una aparición al completar; no crea series futuras ni permite
  editar «esta y las siguientes».
- El orden manual se aplica a la lista visible; las tareas no visibles conservan su orden
  anterior.
- La importación combina por identificador y no es una restauración destructiva.
- La base de datos no está cifrada en reposo y no hay registro de auditoría.
- El límite de intentos de acceso es por IP y en memoria; reiniciar el servidor lo
  reinicia.
