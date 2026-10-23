# 0032 — Observabilidad: logs JSON con pino, eventos de seguridad y Sentry (UE) para errores

- **Estado:** aceptado (logs, eventos y Sentry)
- **Fecha:** 2026-10-22
- **Secciones del MANUAL afectadas:** §3.2 (tabla del stack), §12
- **Relación:** ADR 0031 (construir frente a adoptar), revisión de seguridad del 2026-10-20 (hallazgo 8.1), re-auditoría del 2026-10-22 (fase B1)

## Contexto

La plataforma no tenía logs estructurados, ni registro de errores del servidor, ni alertas (hallazgo 8.1, «Alta»). Sin eso no se puede operar un staging, ni investigar un incidente, ni detectar abusos (fuerza bruta, MFA desactivado, cambios de organización). El MANUAL dejaba pino y Sentry como «propuestos». Producto ya ha creado la cuenta de Sentry en la región UE.

## Decisión

1. **Logs: pino, una línea JSON por evento en la salida estándar** (`apps/web/src/lib/observability`). La plataforma de despliegue recoge la salida; no hay transporte propio. Campos fijos: `level` (texto), `time` (ISO), `service`, `msg`, y cuando aplica `event`, `organization_id`, `user_id`.
2. **Sin datos personales en claro:**
   - contraseñas, tokens, emails y cabeceras `cookie`/`authorization` se censuran (`[redactado]`), también anidados;
   - email e IP solo como seudónimo: HMAC-SHA256 con la clave de servidor `LOG_PSEUDONYM_KEY`, recortado a 16 hex (`email_ref`, `ip_ref`). Sin clave no hay seudónimo: un hash sin clave de un email se revierte con un diccionario;
   - las rutas se escriben sin query ni fragmento (los tokens de invitación van en la query).
3. **Errores del servidor:** `onRequestError` (`src/instrumentation.ts`) escribe un `request.error` por error (deduplicado por digest), con nombre, mensaje (genérico: el detalle de Supabase va en `cause` y no se escribe), digest, método, ruta y tipo de ruta.
4. **Eventos de seguridad**, base de las alertas:
   - `auth.login_failed|throttled|succeeded`;
   - `auth.mfa_required|failed|throttled|succeeded|enabled|disabled`;
   - `org.active_changed`;
   - `org.invitation_created|revoked|accepted`.

   Los fallos, los frenos y la desactivación de MFA van con nivel `warn`.
5. **Errores con contexto: Sentry, en la región UE** (`de.sentry.io`, proyecto `moodly-ai/moodly-web`), con `@sentry/nextjs` 11 (`src/lib/observability/sentry.ts`):
   - **Servidor:** `captureRequestError` en el mismo `onRequestError` que escribe `request.error`.
   - **Navegador:** `instrumentation-client.ts`, por un *tunnel* propio (`POST /monitoring`), así que la CSP sigue en `connect-src 'self'`. El tunnel solo reenvía sobres con el DSN de nuestro proyecto, y la URL de ingesta se construye con el DSN esperado. El tunnel por *rewrite* de la SDK reenvía a cualquier proyecto de Sentry. Límite de 1 MiB, y fuera del proxy (llegan errores también desde el login).
   - **Sin datos personales:**
     - la SDK 11 lo recoge todo por defecto, y ya no tiene `sendDefaultPii`; `dataCollection` lo apaga todo: usuario e IP (`infer_ip: never`), cookies, cabeceras, cuerpos, query, variables y código de los frames;
     - además, `beforeSend`/`beforeBreadcrumb`: de la petición, solo método y ruta; rutas de los contextos sin query; emails censurados en mensajes y excepciones; sin breadcrumbs de consola;
     - sin `cause` encadenadas (`LinkedErrors`), como en los logs;
     - un `satisfies` contra el tipo de `init` hace que una opción que la SDK no conoce no compile.
   - **Solo errores:**
     - sin `tracesSampleRate`: con 0, la SDK seguiría propagando cabeceras de traza;
     - en el navegador, fuera `BrowserTracing`, `WebVitals` y `SpanStreaming` (la SDK de Next añade `BrowserTracing` aunque no haya muestreo), y `BrowserSession` (una sesión por página cargada). En el servidor la SDK añade `SpanStreaming` por su cuenta, pero sin muestreo no registra ni envía ninguna traza;
     - sin *session replay*;
     - `withSentryConfig` añade a cada página `<meta name="sentry-trace">` y `<meta name="baggage">`: identificador de traza, entorno, release y clave pública, sin datos personales. No se puede quitar con una opción, y une el error del navegador con el render del servidor que lo originó.
   - **Sin DSN (local, CI, e2e), Sentry no se activa** y `/monitoring` responde 404.
   - **Build:** `withSentryConfig` sin subir *source maps* ni crear releases (no hay token de Sentry en el build) y sin telemetría del plugin.
   - **Coste:** unos 55 KB gzip más de JavaScript en cada página (medido: 297 → 353 KB en total). Con Turbopack, el código de trazas no se elimina del bundle aunque no se use. Cargar la SDK en diferido lo quitaría de la carga inicial, pero perdería los errores de la hidratación; queda como opción si hace falta.
6. **OpenTelemetry y Langfuse** siguen propuestos: llegan con el worker y los agentes (fase D).

## Alternativas consideradas

- **`console.log` con objetos:** no hay censura ni formato estable, y cada sitio inventa sus campos.
- **Un proveedor de logs gestionado desde el día uno** (Datadog, Better Stack): se decidirá con el staging. Las líneas JSON a stdout las recoge cualquiera, sin cambiar el código.
- **Sentry como único sitio de logs:** Sentry es para errores con contexto, no para eventos de negocio o de seguridad que hay que conservar y consultar.

## Consecuencias

- Nueva variable de servidor `LOG_PSEUDONYM_KEY` (≥ 32 caracteres aleatorios), y opcional `LOG_LEVEL`. En local las genera `env:local`; en staging y producción van en el gestor de secretos del hosting.
- Toda acción nueva que cambie permisos, accesos o datos de una organización emite su evento con `securityEvent()`.
- Las alertas (ráfagas de `auth.login_failed`, `auth.mfa_disabled`, accesos del equipo interno) se configuran en el proveedor de logs cuando exista el staging (B2).

## Verificación

- Unitarios: formato, censura (también anidada), seudónimos estables y dependientes de la clave, rutas sin query, nivel de cada evento.
- Prueba real: la app con la salida capturada y los 100 e2e contra ella.
  - Se registran todos los tipos de evento.
  - En el log no aparece ningún email, contraseña ni secreto TOTP del seed, ninguna IP de los tests y ningún `token=`.
- Con PostgREST parado y una URL con `?token=…`, `request.error` lleva la ruta sin la query y el mensaje genérico.
- Sentry (2026-10-23):
  - unitarios de la limpieza de eventos, las opciones y el tunnel, con pruebas de mutación de cada comparación del DSN;
  - e2e: sin DSN, el tunnel da 404 y un error del navegador no se envía;
  - prueba real con el DSN de staging en local. Un error del navegador con `?token=` en la URL y un email en el mensaje llega a `/monitoring` sin token, con el email censurado, sin consola, cookies ni IP, y con `infer_ip: never`. Un error del servidor sale igual de limpio, también en `contexts.nextjs`. El proxy del entorno del agente no deja salir a `ingest.de.sentry.io`, así que la llegada a Sentry se comprueba en staging.
