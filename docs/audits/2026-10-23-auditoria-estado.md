# Auditoría del estado — 2026-10-23

> Revisión de todo lo hecho hasta hoy (Fase 0, fase A y lo que va de la B), con el staging ya alojado. Continúa la numeración de hallazgos de `2026-10-22-reauditoria-plan.md` (R-16 en adelante). Rango: `docs/audits/` (histórico); manda ADR > MANUAL > diseño (ADR 0023).

## 0. Resumen

**Lo construido aguanta.** El aislamiento por organización (RLS), las guardas, la revocación de sesiones, el equipo interno con acceso JIT, el freno del login, las invitaciones, el MFA para administrar y los logs están en `main`, verificados en local y en el CI, y desde hoy también en un proyecto alojado de staging, aplicados por el CI.

**Lo más importante que sale de esta auditoría:**
1. **R-16 (alta): el MFA no protege las lecturas en la capa de datos.** Quien tiene el TOTP activado pasa por `/login/mfa` en la interfaz, pero la contraseña sola ya da una sesión aal1 válida contra la API de Supabase, y ninguna política `SELECT` exige aal2. Con la contraseña robada se leen por REST todos los datos de sus organizaciones, sin el segundo factor.
2. **R-18 (media): secretos de staging al alcance de ramas que no son `main`**: los *previews* de Vercel (también los de Dependabot) y el entorno `staging` de GitHub sin restricción de ramas, con un token de Supabase que da acceso a toda la cuenta.
3. **R-17 (media): la configuración de Auth del proyecto alojado no está como código.** El registro público estaba abierto por defecto (producto lo cerró a mano hoy). Por defecto también vienen contraseñas de 6 caracteres sin requisitos y `site_url` en localhost.
4. **R-19 (media, a confirmar): el plan de Vercel.** La API de logs respondió como plan Hobby (retención de 1 h). Si es así, no vale para uso comercial ni permite *log drains* para las alertas de B1.
5. **R-28 (producto): ~4 semanas en cimientos y nada todavía de lo que vende el producto** (agentes, memoria, objetivos, coach). Propuesta: tras cerrar B, adelantar la fase D (runtime de agentes) a la C (WorkOS).

## 1. Método y evidencia

- `main` en `872e1c8` (tras #58). CI de `main` en verde en sus 5 checks, y el despliegue a staging en verde (run 39871956506): aplicó las 4 migraciones que faltaban con `supabase db push`.
- **Base de datos alojada** (`moodly-staging`, consultas de solo lectura):
  - inventario de funciones de `public` y `private` (`prosecdef`, `search_path`, EXECUTE por rol);
  - las 28 políticas, comprobando que empiezan por `session_is_active()` y dónde exigen aal2;
  - privilegios por tabla de `anon` y `authenticated`;
  - extensiones;
  - avisos de seguridad y de rendimiento de Supabase.
- **Código:** lectura completa de la capa de autenticación (`session.ts`, login, MFA, alta y baja de TOTP), Server Actions (invitaciones, organización activa, preferencias), cliente de Supabase, cabeceras, proxy, datos de alcance y validación. Workflows (`ci.yml`, `security-daily.yml`, `sensitive-paths.yml`, `deploy-staging.yml`).
- **Infraestructura (conectores):**
  - Vercel: despliegues, variables por entorno, protección, logs y errores de ejecución;
  - Supabase: historial de migraciones y avisos;
  - Sentry: proyecto creado;
  - Hostinger: zona DNS.
- **Inventario de tests:** 14 archivos pgTAP con 432 aserciones, 28 archivos de tests unitarios y 21 archivos e2e (100 ejecuciones en el CI).
- **Prueba de R-16 en local** (Supabase local con el seed, `main`): cada cuenta del seed entra solo con la contraseña por la API de Auth (`/auth/v1/token`) y lee por REST. Las tres `org_admin` con TOTP reciben `aal: aal1` y aun así leen sus organizaciones, locales, memberships e invitaciones; una de ellas, 1 organización, 1 local, 1 membership y 2 invitaciones con el email de las personas invitadas. Sin código TOTP. Las credenciales no salieron del archivo local.
- **Límites:** desde esta sesión no se puede leer la configuración de Auth del proyecto alojado (el proxy bloquea su API y el conector no la expone). La ejecución local completa (`pnpm check`, pgTAP, e2e) no se repitió: la cubre el CI de `main` sobre el mismo commit.

## 2. Estado por área

### 2.1 Base de datos y RLS (verificado en el proyecto alojado)

| Punto | Estado |
|---|---|
| RLS activado y forzado en las 9 tablas de `public` | ✔ |
| Las 28 políticas empiezan por `(select private.session_is_active())` | ✔ |
| Escrituras de administración (org_admin y equipo interno) con aal2 | ✔ (todas menos `users_*_self`, que son del propio perfil) |
| **Lecturas con aal2 cuando la persona tiene MFA** | ✘ **R-16** |
| Funciones: todas con `search_path = ''`; `SECURITY DEFINER` solo donde hace falta | ✔ 20 en total; `register_server_key` solo `service_role`; las del freno exigen la clave de servidor |
| `anon` sin privilegios sobre ninguna tabla de `public` | ✔ |
| `authenticated` con DELETE (organizations, regions, locations, users) e INSERT (organizations) sin política que lo use | Bloqueado por RLS, pero sobra: **R-20** |
| `graphql_public` | No aplica en el alojado: `pg_graphql` no está instalado |
| `pgvector` | No instalado todavía (llega con la memoria, ADR 0025) |
| Avisos de Supabase | Esperados: tablas de `private` sin políticas (a propósito), RPCs del freno ejecutables por `anon` (protegidas con la clave de servidor), varias políticas `SELECT` permisivas por tabla (rendimiento, cuando haya volumen) e índices sin usar (no hay datos) |

### 2.2 Autenticación, MFA e invitaciones

| Punto | Estado |
|---|---|
| `requireUser()` con `getUser()` en páginas y acciones; nunca `getSession()` | ✔ |
| Freno del login por email + IP, con fallo cerrado si no responde; los códigos MFA cuentan en el mismo freno | ✔ |
| La IP sale de `x-forwarded-for` (Vercel la reescribe) | ✔ en Vercel; revisar si se pone un CDN delante |
| MFA en la interfaz (`/login/mfa`, `requireUser` exige aal2 a quien tiene factor) | ✔ |
| **MFA en la capa de datos para lecturas** | ✘ **R-16** |
| Desactivar MFA no pide un código actual | **R-21** |
| Cualquier error de Auth (también 5xx) cuenta como fallo en el freno del login | **R-23** (en el paso de MFA ya se distingue) |
| Invitaciones: token de un solo uso, ligado al email, sin altas en organizaciones suspendidas | ✔ |
| El token de invitación viaja en la query | **R-22** (los logs propios lo quitan; los de la plataforma no) |
| Cookies propias `httpOnly` y `SameSite=Lax`, sin `Secure` | Info (R-24): HSTS con *preload* lo cubre en la práctica |

### 2.3 Web y observabilidad

| Punto | Estado |
|---|---|
| CSP con nonce y `strict-dynamic`, `connect-src 'self'`, HSTS, COOP/CORP, `X-Frame-Options` | ✔ comprobado en staging |
| Zod en las Server Actions; errores con `cause`, sin concatenar | ✔ |
| Logs JSON con censura y seudónimos; `request.error` deduplicado | ✔ en `main`; en staging aún no hay tráfico con sesión |
| Sentry | Proyecto `moodly-ai/moodly-web` creado y DSN en Vercel; **falta la integración** (bloqueada por R-26) |
| Errores de ejecución en staging (Vercel, 24 h) | Ninguno |
| Retención de logs en Vercel | 1 h (ver R-19) |

### 2.4 CI, cadena de suministro y proceso

| Punto | Estado |
|---|---|
| 5 checks obligatorios, Actions fijadas por commit, permisos mínimos | ✔ |
| `pnpm audit` diario y gitleaks en cada PR | ✔ |
| Migraciones a staging solo desde el CI, tras el CI verde de `main` y con el commit exacto; nunca desde un fork | ✔ (#58) |
| Entorno `staging` de GitHub sin restricción de ramas | **R-18** |
| 4 migraciones aplicadas a mano antes del CI | Corregido el mismo día (**R-25**): historial alineado tras comprobar el MD5 y regla nueva en AGENTS.md |
| Plugin de Semgrep sin acceso de red bloqueando ediciones e instalaciones en la sesión del agente | **R-26** |
| `main` sin protección técnica (GitHub Free) | Sigue bloqueado |

### 2.5 Staging (infraestructura)

| Pieza | Estado |
|---|---|
| Supabase `moodly-staging` (Free, `eu-central-1`, Postgres 17) | ✔ 8/8 migraciones del repo; clave del freno registrada (solo el hash). Free: sin copias y se pausa tras una semana sin uso |
| Vercel `moodly-staging` (`fra1`, Node 24, turbo con typecheck) | ✔ `main` en producción de staging, sin errores de ejecución |
| `staging.moodlycrm.com` | ✔ CNAME en Hostinger, certificado emitido |
| Variables de servidor (`LOGIN_THROTTLE_KEY`, `LOG_PSEUDONYM_KEY`) | Como *sensitive*, en Production **y Preview** (R-18). Generadas por el agente: se rotan antes de datos reales |
| Auth del proyecto alojado | Registro cerrado (a mano, 2026-10-23); el resto sin verificar ni como código (**R-17**) |
| Primer usuario de staging | No existe: el login aún no se ha probado de punta a punta en staging |
| Resend | Registros DKIM y `send.` en la zona de `moodlycrm.com`, pero 0 dominios en la cuenta conectada a la sesión: hay que aclarar qué cuenta los creó (B4) |

### 2.6 Documentación

- `STATUS.md`: describe Sentry como bloqueado por permisos (ya no lo está) y B2 sin el despliegue del CI (ya verificado). Se corrige en este PR.
- MANUAL §3.2 marca como **[PROPUESTO]** piezas ya en uso y con ADR o código: monorepo, Supabase, migraciones con la CLI, hosting en Vercel y Resend. Y dice «pendiente de crear el proyecto» en Sentry (**R-27**).
- 14 ADRs (0001–0017, salvo 0003) siguen «por redactar».

### 2.7 Producto

Fase 0: tareas 1–4 hechas (monorepo, tenants con RLS, Auth y app shell). Las tareas 5 (catálogo de agentes) y 6 (worker) siguen sin empezar. Nada de la prioridad máxima del producto (memoria que aprende, objetivos, coach; MANUAL §5.12 y §6) existe todavía en código (**R-28**).

## 3. Hallazgos nuevos

| # | Hallazgo | Gravedad | Propuesta |
|---|---|---|---|
| R-16 | **MFA sin efecto sobre las lecturas en la capa de datos.** Con la contraseña sola (aal1) se lee por la API REST todo lo que RLS deja ver a esa persona, aunque tenga el TOTP activado. Solo las escrituras de administración exigen aal2. | **Alta** | `private.session_is_active()` exige además aal2 cuando la persona tiene un factor verificado (`auth.mfa_factors`). Al estar en la primera condición de las 28 políticas, las cubre todas. pgTAP: con factor, aal1 no ve nada y aal2 sí; sin factor, aal1 ve. Las RPC `SECURITY DEFINER` que leen o escriben datos de tenants (`accept_invitation`) hacen la misma comprobación. |
| R-17 | **Auth del proyecto alojado sin configuración como código.** Por defecto: registro abierto (cerrado a mano hoy), contraseñas de 6 caracteres sin requisitos (en local, 12 con mayúsculas, minúsculas y dígitos), `site_url` en localhost (enlaces de email rotos) y TOTP sin fijar. | Media | `[remotes.staging]` en `config.toml` y, en el despliegue del CI, `supabase config diff` (solo lectura) y después `config push`. Antes, revisar lo que exige plan Pro (`[auth.sessions]`) o SMTP propio (límite de emails). |
| R-18 | **Secretos de staging accesibles desde ramas que no son `main`.** (a) Los *previews* de Vercel de cualquier rama, también las de Dependabot (código de terceros sin revisar), compilan y se ejecutan con `LOGIN_THROTTLE_KEY` y `LOG_PSEUDONYM_KEY` contra la base de staging. (b) El entorno `staging` de GitHub no restringe ramas: un workflow modificado en cualquier rama del repositorio podría leer `SUPABASE_ACCESS_TOKEN`, que es un token de la cuenta entera de Supabase (también daría acceso al futuro proyecto de producción). | Media | (a) Quitar las claves de servidor de Preview (los *previews* no necesitan login) o no compilar las ramas `dependabot/*`. (b) Restringir el entorno a `main` (en repo privado puede pedir GitHub Team) y, para producción, una organización de Supabase aparte con su propio token. |
| R-19 | **Plan de Vercel a confirmar.** La API de logs del equipo `diegosanjuan` respondió como plan Hobby (retención de 1 h). Hobby no permite uso comercial ni *log drains*. | Media | Confirmar que el proyecto está en el equipo Pro y moverlo si no. Sin *log drain* no hay alertas de B1. |
| R-20 | `authenticated` conserva DELETE en `organizations`, `regions`, `locations` y `users`, e INSERT en `organizations`, sin política que los use. | Baja | Migración que los revoca y pgTAP de privilegios (mínimo privilegio; hoy RLS lo bloquea). |
| R-21 | Desactivar el MFA no pide un código actual: una sesión aal2 robada puede quitar el segundo factor. | Baja | Pedir el código TOTP para desactivarlo; email de aviso cuando exista Resend (B4). |
| R-22 | El token de invitación va en la query de `/app/invitation`. Los logs propios lo quitan, pero los de acceso de la plataforma guardan la URL completa. | Baja | Llevarlo en el fragmento (`#`) o en un POST al hacer los emails de invitación (B4). |
| R-23 | `signIn` registra como fallo cualquier error de Auth, también los 5xx: una caída de Auth puede frenar a usuarios legítimos. | Baja | Contar solo los 4xx, como ya hace el paso de MFA. |
| R-24 | Cookies de preferencias y de organización activa sin `Secure`. | Info | Añadir `secure` fuera de local. |
| R-25 | Proceso: 4 migraciones aplicadas a mano en staging antes de usar el CI; claves de staging generadas por el agente dentro de la sesión. | Media (corregido) | Historial verificado por MD5 y alineado; regla nueva en AGENTS.md («solo el CI migra»). Las claves se rotan antes de datos reales y las de producción las genera una persona. |
| R-26 | Proceso: el plugin Semgrep Guardian no puede conectarse (el proxy del entorno bloquea sus dominios) y, sin sesión iniciada, bloquea ediciones e instalaciones. Desactivado en claude.ai, sigue cargado en la sesión en curso. | Media (bloquea trabajo) | Arranque nuevo de la sesión. Si se quiere Semgrep: permitir `semgrep.dev`, `scanner.semgrep.ai` y `telemetry.semgrep.dev` e iniciar sesión. |
| R-27 | Documentación desfasada: MANUAL §3.2 (estados [PROPUESTO] de piezas en uso, Sentry «pendiente») y 14 ADRs por redactar. | Baja | Alinear §3.2 en el próximo PR de documentación; ADRs por orden de impacto (0004, 0009, 0017). |
| R-28 | Producto: nada de agentes, memoria, objetivos ni coach en código; la fase D va detrás de la C (WorkOS). | Alta para el negocio | Tras cerrar B, hacer D antes que C, salvo que haya un cliente enterprise esperando SSO. El piloto pyme no necesita WorkOS. |

## 4. Plan actualizado

Regla que no cambia: una fase no avanza hasta que la anterior está mergeada, verificada sobre `main` y anotada en `STATUS.md`.

### Fase B — cerrar el staging (en curso)
- **B2 ✔** Supabase y Vercel en la UE, `staging.moodlycrm.com` y migraciones desde el CI (#58). Falta el **primer usuario de staging** (decisión 2) y el login de punta a punta allí.
- **B3 · Auth y MFA de verdad:**
  - **R-16** (MFA en las lecturas), lo primero;
  - Auth como código (**R-17**: `config diff` y después `config push`);
  - **R-21** y **R-23**;
  - Turnstile.
- **B1b · Sentry:** `@sentry/nextjs` con *tunnel* propio, sin datos personales y sin *replay* (ADR 0032). Bloqueado por R-26 hasta que la sesión arranque de nuevo.
- **B4 · Email:** Resend con el dominio de `moodlycrm.com` para staging; invitaciones por email (y R-22).
- **B5 · Higiene de staging (nuevo):**
  - **R-18**: *previews* sin claves de servidor y entorno de GitHub restringido;
  - **R-19**: plan de Vercel;
  - **R-20**: privilegios sobrantes;
  - *log drain* y alertas.

### Fase D — runtime de agentes (propuesta: antes que la C)
Catálogo de agentes y skills (ADR 0030), *spike* de DBOS y worker en Railway (ADR 0027), `tenantDb(orgId)`, aprobaciones atadas al hash, destinatarios fijados por el runtime y evals de ataque. Y la primera pieza de la prioridad del producto: memoria con procedencia (ADR 0024) y objetivos.

### Fase C — identidad enterprise
*Spike* de WorkOS (ADR 0022), cuando haya un cliente que lo pida o al terminar D.

### Fase E — canales e integraciones
Sin cambios: WhatsApp Cloud API (ADR 0020), webhooks firmados y OAuth.

### Condiciones de salida a producción (sin cambios, más R-18 y R-19)
- Supabase Pro en la UE con copias y una restauración probada;
- revisión humana reactivada, con la lista leída de la rama base;
- `main` protegida;
- DPAs, y DPIA si el piloto es una clínica;
- claves rotadas y generadas por una persona;
- proyecto y token de Supabase de producción separados de staging;
- Vercel Pro con *log drain*.

## 5. Decisiones que necesito de producto
1. **Plan de Vercel:** ¿el equipo `diegosanjuan` es Pro? Si no, mover el proyecto al equipo Pro (R-19).
2. **Primer usuario de staging.** Propuesta: un *seed* de staging que corre el CI con datos ficticios (una organización «Demo», sus locales y cuentas de prueba) y tu cuenta personal como `org_admin` por invitación.
3. **Orden de fases:** ¿D (agentes, memoria, objetivos) antes que C (WorkOS)? Recomendado, salvo un cliente enterprise a la vista.
4. **Semgrep:** dejarlo desactivado (el CI ya tiene gitleaks, `pnpm audit` y Dependabot) o configurarlo con red e inicio de sesión (R-26).
5. **GitHub Team:** protege `main` y permite restringir el entorno `staging` a `main` (R-18 b).
