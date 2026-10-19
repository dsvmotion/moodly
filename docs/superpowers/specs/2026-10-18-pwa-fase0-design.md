# Fase 0 — Fontanería PWA (app instalable en iPhone)

- **Fecha:** 2026-10-18
- **Autor:** producto (dsv.motion@gmail.com) + agente
- **Estado:** propuesta, pendiente de revisión
- **Rama:** `feat/pwa-movil-fase0`
- **Alcance:** primer subproyecto del programa "App móvil de Moodly". Esta
  fase **no construye ninguna pantalla del diseño**: solo hace que la app
  `apps/web` actual se pueda **instalar en el iPhone** y se abra a pantalla
  completa (sin barra de Safari). El aspecto de las maquetas `M-*` llega en
  las fases 1 en adelante.

## 1. Contexto

El diseño definitivo de la app (canvas "Moodly AI", artifact
`BoLfJGSVxG4tGv6DmLYQfv`) incluye 13 pantallas móviles `M-*` (390×844) con
barra de pestañas inferior, y un design system propio (`ds/moodly`: fuente
Geist, tokens de color claro/oscuro, botones píldora, radios 12px,
separadores finos, sin sombras). Se construirá **exactamente ese diseño**,
por fases, sobre la **misma app Next.js responsive** (`apps/web`).

Hoy `apps/web` es una app Next.js (App Router) con next-intl, auth de
Supabase (proxy + `requireUser()` por página) y **sin `public/`, sin
manifest y sin service worker**. Sin esos tres elementos, un iPhone no puede
instalar la app ni abrirla a pantalla completa, da igual lo buena que sea la
UI. Por eso la Fase 0 es la fontanería previa.

## 2. Objetivo y criterios de éxito

Un usuario entra con Safari en el iPhone, pulsa **Compartir → Añadir a
pantalla de inicio**, y a partir de ahí:

1. La app tiene **icono propio** (marca Moodly) en la pantalla de inicio.
2. Se abre **a pantalla completa** (`display: standalone`), sin barra de
   direcciones ni pestañas de Safari.
3. El **login sigue funcionando** igual que en el navegador.
4. Sin conexión, muestra un **estado "sin conexión" limpio**, nunca el error
   de Safari ni contenido de tenant cacheado.

## 3. Alcance

**Dentro:**
- Web App Manifest.
- Service worker mínimo (escrito a mano, sin dependencia nueva).
- Iconos de app derivados del logo de Moodly.
- Registro del service worker y aviso de "nueva versión".
- Página de respaldo `offline` estática.
- Metadatos (manifest, iconos, theme-color, Apple) vía Metadata API.
- Cabeceras para servir `sw.js`.

**Fuera (fases posteriores o nunca):**
- Cualquier pantalla del diseño `M-*` (fases 1+).
- Caché de datos para uso offline (nunca para datos de tenant; ver §8).
- Notificaciones push.
- Cambios en auth, RLS, el proxy o el motor de políticas.
- Empaquetado en App Store (sería el camino Capacitor, descartado por ahora).

## 4. Decisiones de arquitectura

| Decisión | Elección | Motivo |
|---|---|---|
| Implementación del SW | **A mano, mínimo** (sin `next-pwa`/Serwist) | No añade dependencia (`package.json` es zona sensible); auditable de una lectura; encaja con "incrementos pequeños y verificables". |
| Modelo offline | **App shell: solo instalable + respaldo offline** | No se cachea ninguna página autenticada ni respuesta de datos. Lo más seguro para un panel B2B con RLS. |
| Alcance del SW | **Solo same-origin + solo GET** | Deja pasar sin tocar: POST, Server Actions, `/login`, auth y Supabase (otro origen). |
| Iconos | **PNG generados desde el SVG del wordmark** y commiteados | No se añade dependencia de imágenes al proyecto; se generan con herramienta puntual y se versiona el PNG. |
| `start_url` | **`/app`** | Es el home del producto. Si no hay sesión, el proxy redirige a `/login` (comportamiento correcto, también en standalone). |

## 5. Archivos

### Nuevos (`apps/web/`)
- `public/manifest.webmanifest` — ver §6.
- `public/sw.js` — ver §7.
- `public/offline.html` — página estática de respaldo (sin conexión). HTML
  autónomo, con los colores de marca del token `canvas`/`ink`, texto
  "Sin conexión. Vuelve a intentarlo cuando tengas internet." Sin datos.
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-192-maskable.png`
- `public/icons/icon-512-maskable.png`
- `public/icons/apple-touch-icon.png` (180×180)
- `public/icons/moodly-mark.svg` — isotipo cuadrado fuente (la "M" del
  wordmark `apps/site/public/brand/moodly-logo.svg`, mismo trazo), del que
  se generan los PNG. Se copia al repo de `apps/web` para no acoplar los dos
  paquetes.
- `src/components/pwa/service-worker-register.tsx` — componente cliente que
  registra `/sw.js` y gestiona la actualización (ver §9).

### Modificados
- `src/app/layout.tsx` — añadir metadatos (`manifest`, `icons`, `themeColor`,
  `appleWebApp`) reutilizando `BRAND_NAME`, y montar
  `<ServiceWorkerRegister />` dentro de `<body>`. **No** se toca la lógica de
  tema ni de locale existente.
- `apps/web/next.config.ts` — **zona sensible** (§8): añadir `headers()` para
  servir `/sw.js` con `Cache-Control: no-cache` y `Service-Worker-Allowed: /`.

## 6. Manifest (`public/manifest.webmanifest`)

```jsonc
{
  "name": "Moodly",              // el valor se mantiene alineado con BRAND_NAME
  "short_name": "Moodly",
  "description": "Agentes de IA que trabajan dentro de tu negocio.",
  "start_url": "/app",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "lang": "es",
  "dir": "ltr",
  "background_color": "#f4f4f5", // token canvas (claro) — fondo del splash
  "theme_color": "#f4f4f5",      // token canvas (claro)
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Nota: el manifest es un archivo estático, así que el nombre no puede importar
`BRAND_NAME` en tiempo de ejecución. Se cubre con un **test** que comprueba
que `manifest.name === BRAND_NAME` (ver §10), de modo que si la marca cambia,
el test falla y obliga a actualizar el manifest en el mismo PR. Así se
respeta el espíritu de la regla "nunca el nombre de la marca a mano".

## 7. Service worker (`public/sw.js`)

Clásico, sin build, sin dependencias, **fuente única**. La decisión de
estrategia se escribe como **función pura** `pickStrategy(request, origin)`
al principio de `public/sw.js`. El registro de listeners (`install`,
`activate`, `fetch`) se envuelve en `if (typeof self !== "undefined" &&
self.addEventListener)`, de modo que el archivo se puede **importar desde
Vitest** sin ejecutar el cableado del SW, y el test llama directamente a
`pickStrategy`. Así no hay duplicación ni posible desincronización entre lo
testeado y lo que corre en el navegador. Lógica:

- **Versionado de caché:** `const CACHE = "moodly-shell-v1";`
- **`install`:** `precache` **mínimo y no sensible**: `/offline.html`,
  `/manifest.webmanifest`, los iconos. `self.skipWaiting()` **no** se llama
  automáticamente (la actualización la decide el cliente, §9).
- **`activate`:** borrar cachés cuyo nombre no sea `CACHE`; `clients.claim()`.
- **`fetch`:** una función pura `handle(request) -> Strategy` decide la
  estrategia. **Es la pieza que se testea** (§10). Reglas, en orden:
  1. Si `request.method !== "GET"` → **passthrough** (no `respondWith`).
     Cubre Server Actions y cualquier mutación.
  2. Si el origen no es el de la app (p. ej. Supabase) → **passthrough**.
  3. Si la ruta es de auth/login (`/login`, `/auth`, callbacks) →
     **passthrough**. Nunca se cachea nada del flujo de sesión.
  4. Si es un **asset estático** no sensible (`/_next/static/…`, `/icons/…`,
     `/manifest.webmanifest`, fuentes) → **cache-first** con
     revalidación en segundo plano.
  5. Si es una **navegación** (`request.mode === "navigate"`) →
     **network-first**; si la red falla, servir `/offline.html` desde caché.
     **La respuesta de navegación NO se guarda en caché** (evita almacenar
     HTML de páginas autenticadas / de tenant).
  6. Resto → **passthrough**.

Resultado clave: **ninguna respuesta que pueda contener datos de tenant o de
sesión se escribe en caché**. Solo assets de build públicos y la página
offline.

## 8. Seguridad y zonas sensibles

- `apps/web/next.config.ts` está en `scripts/merge-guard/sensitive-paths.txt`
  (config de build). El cambio de `headers()` **requiere revisión humana** y
  la etiqueta `revisado-humano` antes de poder mergear de forma autónoma.
  Es un cambio pequeño y acotado (solo cabeceras para `/sw.js`).
- **No se toca** auth, `lib/auth`, `lib/supabase`, el proxy, el login ni las
  redirecciones: el SW los deja pasar por diseño (§7, reglas 1–3).
- **RLS / datos de tenant:** el SW nunca cachea navegaciones ni respuestas de
  datos, así que no puede filtrar datos de un tenant a otro ni persistirlos
  en el dispositivo. El test estructural (§10) lo garantiza.
- El service role de Supabase no interviene en nada de esta fase.

## 9. Registro y actualización (`service-worker-register.tsx`)

Componente cliente, montado en el layout:

- Registra `/sw.js` en `load` solo si `"serviceWorker" in navigator` y en
  `production` (evita interferir con el `dev` de Next).
- Escucha `updatefound` / el estado `installed` del nuevo worker. Cuando hay
  una versión nueva en espera, muestra un **aviso discreto** ("Hay una
  versión nueva — Recargar") usando los componentes de `packages/ui`. Al
  aceptar: `registration.waiting.postMessage({type:"SKIP_WAITING"})` y, en
  `controllerchange`, `location.reload()` una sola vez.
- Enfoque conservador: **no** se fuerza `skipWaiting` automático, para no
  cambiar el código bajo los pies del usuario a mitad de sesión.

## 10. Plan de verificación (construir → probar → verificar)

**Tests automáticos (Vitest):**
1. **Estrategia del SW** — el test importa `public/sw.js` y ejerce la
   función pura `pickStrategy(request, origin)` (fuente única, §7). Casos que
   *prueban* la seguridad:
   - POST a `/app/...` (Server Action) → `passthrough`.
   - GET a URL de Supabase (otro origen) → `passthrough`.
   - GET `/login`, `/auth/callback` → `passthrough`.
   - GET navegación a `/app/activity` → `network-first`, **sin** escritura en
     caché.
   - GET `/_next/static/chunk.js`, `/icons/icon-192.png` → `cache-first`.
2. **Manifest** — `manifest.name === BRAND_NAME`; campos obligatorios
   presentes; los `src` de iconos existen en `public/icons/`.

**Verificación manual en iPhone real (evidencia en el PR):**
- Instalar desde Safari ("Añadir a pantalla de inicio"): aparece el icono
  Moodly.
- Abrir: pantalla completa, sin barra de Safari.
- Login completo: funciona.
- Modo avión → abrir la app: se ve `/offline.html`, no el error de Safari.
- Reconectar: la app vuelve a cargar normal.

**Checks del repo antes de pedir merge:** `pnpm check` (typecheck + lint +
test + build) en verde; e2e existentes sin regresión.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Un SW mal hecho cachea páginas con datos y las sirve a otra sesión | Navegaciones **nunca** se cachean; test estructural lo bloquea. |
| El SW rompe el login o los Server Actions | Reglas de passthrough explícitas (método ≠ GET, auth, otro origen) + casos de test. |
| El SW "se queda pegado" con una versión vieja | `Cache-Control: no-cache` en `/sw.js` + flujo de actualización con aviso. |
| iOS no soporta algo | Alcance limitado a instalación + standalone + offline shell, todo soportado en iOS 16.4+. Push queda fuera. |
| Añadir herramienta de iconos ensucia dependencias | Generación puntual fuera del árbol de deps; solo se commitean los PNG. |

## 12. Definición de hecho (Fase 0)

- [ ] TypeScript strict sin errores, lint limpio.
- [ ] Tests nuevos (estrategia del SW + manifest) pasando en local y CI.
- [ ] Manifest, SW, iconos, offline y registro en su sitio.
- [ ] Instalación y pantalla completa verificadas en iPhone real, con
      evidencia (capturas) en el PR.
- [ ] Login y estado offline verificados en dispositivo.
- [ ] Cambio de `next.config.ts` revisado por humano (`revisado-humano`).
- [ ] `docs/STATUS.md` actualizado.

## 13. Siguientes fases (contexto, no se construyen aquí)

1. **Fase 1 — Chasis móvil responsive:** barra de pestañas inferior
   (`Inicio·Chats·Aprobar·Agenda·Más`) visible en móvil; barra lateral en
   escritorio; tokens `ds/moodly` en `packages/ui`.
2. **Fase 2 — Pantalla Inicio.**
3. **Fase 3 — Pantalla Más.**
4. **Fase 4+ — Resto de pestañas**, por disponibilidad de datos.

Cada fase: su propio spec → plan → implementación verificable.

## 14. Adenda tras explorar el código (al escribir el plan)

Tres cambios respecto a lo de arriba, todos pendientes de visto bueno de
producto junto al plan:

1. **Se toca el proxy (zona sensible).** `src/proxy.ts` aplica la sesión a
   todo salvo `_next/static`, `_next/image` y `favicon.ico`. Sin sesión,
   `/sw.js`, `/manifest.webmanifest`, `/icons/*` y `/offline.html` se
   redirigirían a `/login`, y desde `/login` (donde se instala la app) el
   iPhone no podría leer el manifest ni registrar el SW. Solución: añadirlos
   a la exclusión del `matcher`. Son estáticos sin datos; la lógica de
   sesión y redirección no cambia. Corrige lo dicho en §3 y §8 ("no se toca
   el proxy").
2. **Manifest como ruta de Next** (`src/app/manifest.ts`, servida en
   `/manifest.webmanifest`) en lugar de `public/manifest.webmanifest`: usa
   `BRAND_NAME` directamente y Next añade el `<link rel="manifest">`. Mismos
   campos que §6. Ya no hace falta cabecera de tipo en `next.config.ts`.
3. **Icono:** el último trazo del wordmark es el símbolo ®, no un punto de
   marca. El isotipo es la "M" blanca del wordmark sobre tinta `#000000`,
   con dos fuentes SVG (normal y *maskable*) y un script
   `apps/web/scripts/pwa-icons.sh` (ImageMagick) que genera los PNG
   commiteados. El comando se documenta en `AGENTS.md`/`CLAUDE.md` (zona
   sensible).

**Actualización (2026-10-18):** producto facilitó el icono definitivo de la
app (baldosa azul con el símbolo). Sustituye a la "M": la fuente maestra es
`apps/web/scripts/pwa-icons/app-icon.png` y el mismo script genera el icono
general (con transparencia) y los opacos para iOS y Android.

Además, la lógica de registro/actualización se separa del componente en
`src/lib/pwa/register.ts` para poder testearla.
