# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- Scaffold del monorepo (Fase 0 · tarea 1): pnpm 11 + Turborepo, 13 workspaces vacíos `@repo/*` (`apps/{web,worker}`, `packages/*`), TypeScript strict, ESLint (typescript-eslint strict), Vitest con un test trivial, CI en GitHub Actions y comandos en `AGENTS.md`/`CLAUDE.md` — verificado con una instalación limpia en local (`pnpm install --frozen-lockfile`, `pnpm typecheck`/`lint`/`test`/`build`: 13/13 tareas OK, 1 test pasando), una prueba negativa de las tres puertas (tsc exit 2, eslint exit 1, vitest exit 1) y el CI en verde en el PR (run 36454243122, Node 24.21.0) — 2026-09-28 — https://github.com/dsvmotion/moodly/pull/1
- Supabase local + primera migración de tenants con RLS (Fase 0 · tarea 2): `organizations`, `regions`, `locations`, `users` y `memberships` con RLS activado y forzado, helpers `security definer` en `private`, guardas de negocio (campos de la organización, columnas inmutables, estado y estructura del local, último `org_admin`) y mínimo privilegio (sin TRUNCATE/REFERENCES/TRIGGER para `authenticated`, nada para `anon`) — verificado con 158 tests pgTAP, pruebas negativas por cada protección, rollback probado, `supabase db lint` limpio, revisión humana aplicada y CI en verde (run 36566349349, Supabase CLI 2.118.0); tras el merge, 158/158 también sobre `main` (`a04b9f8`) — 2026-09-29 — https://github.com/dsvmotion/moodly/pull/2
- Auth + seed (Fase 0 · tarea 3): seed idempotente solo local (`pnpm db:seed`), Supabase Auth en `apps/web` (Next.js 16.3.6, `@supabase/ssr`), proxy con `getClaims()` y DAL con `getUser()`, página "Mi organización" vía RLS, registro público cerrado y redirección tras login blindada — verificado con 27 e2e por rol y de seguridad (con pruebas negativas), revisión de seguridad de la autenticación (9 puntos) aplicada y CI en verde (run 36700076225); tras el merge, sobre `main` (`b4c26d3`) pasan `pnpm check` 52/52, pgTAP 158/158 y e2e 27/27 — 2026-09-30 — https://github.com/dsvmotion/moodly/pull/3
- Revocación real de sesiones (Fase 0 · tarea 3c-1): `private.session_is_active()` (sesión viva en `auth.sessions`, usuario no borrado ni baneado) como primera condición, en forma de InitPlan, de las 15 políticas de las 5 tablas de tenants; un token copiado antes del logout ya no lee datos por la API REST — verificado con 186 pgTAP, 29 e2e, pruebas negativas, `EXPLAIN ANALYZE` (1 llamada frente a 2.004 sin envolver), rollback probado y CI en verde (run 36703604922); tras el merge, sobre `main` (`d64cdc0`) pasan `pnpm check` 52/52, pgTAP 186/186 y e2e 29/29 — 2026-09-30 — https://github.com/dsvmotion/moodly/pull/4
- Mergeo autónomo endurecido: `scripts/safe-merge.sh` (checks sobre el head exacto, zonas sensibles y tests debilitados), lista única de zonas sensibles y job de CI `sensitive-paths` con la etiqueta `revisado-humano`, que se invalida con cada commit nuevo — verificado con 65 tests del script, pruebas negativas, la etiqueta comprobada en GitHub (de rojo a verde sobre el mismo commit) y 6 PRs mergeados después con el script — 2026-10-01 — https://github.com/dsvmotion/moodly/pull/8
- App shell (Fase 0 · tarea 4): #6–#14 mergeados (barra lateral, selector de alcance, Registros con vista previa, ⌘K, i18n, teclado, axe y e2e por rol con capturas) — verificado sobre `main` (`ebaf37b`): `pnpm check` 51/51, pgTAP 186/186, e2e 83/83 — 2026-10-01. Quedan dos PRs sensibles de esta tarea (ver «En curso»).
- Web pública (`apps/site`, 17 páginas en es/en/fr/de), prototipo de la plataforma y cimientos del sistema de diseño (tokens de marca, fuentes, componentes de estado) — #17, 2026-10-09.
- Auditoría de decisiones y flujos (#18) y prototipo navegable con los 18 flujos cableados (#25, que incluye y cierra #19–#24) — verificado sobre `main` tras el merge: `pnpm check` 52/52 (210 tests), pgTAP 186/186, e2e 86/86 — 2026-10-19.
- App móvil · Fase 0 (`apps/web` instalable como PWA) — #26, código mergeado y e2e 86/86. **Falta la verificación en un iPhone real** (ver «Bloqueado»).
- Cierre del diseño del prototipo — #27: 67 pantallas (54 de escritorio y 13 de móvil), pantallas enterprise (2FA, SSO, SCIM, claves de API, ficha de integración, auditoría, facturación), modo oscuro, en/fr/de con frases completas, estados (cargando, vacío, error, sin permiso), adaptación a móvil y tableta (cajón por debajo de 900 px) y WCAG 2.1 AA (axe: 0 fallos en 67 pantallas × 2 temas; 237 estados × 2 temas; 24 diálogos con teclado). Lienzo de diseño «Moodly Landing Pages» en la versión 74. Verificado sobre `main`: `pnpm check` 52/52, pgTAP 186/186, e2e 86/86 — 2026-10-20. Detalle: `docs/audits/2026-10-20-cierre-diseno.md`.
- Documentación de seguridad y arquitectura en `main`: revisión de los cimientos (#32), revisión de toda la plataforma (#33), ADR 0022 de identidad enterprise y `docs/design/seguridad-por-pilares.md` (#34), WorkOS como proveedor de SSO/SCIM (#35), y ADRs 0023–0030 con el MANUAL alineado (#38) — 2026-10-21.

- Seguridad de los cimientos, primera tanda: dependencias sin vulnerabilidades (#28), cabeceras y CSP con nonce (#29), Auth con MFA TOTP, contraseñas y sesiones (#30), cadena de suministro (#31) y organizaciones suspendidas sin acceso (#41). Verificado sobre `main` (`b3be89e`) tras los merges: pgTAP 206/206, `db lint` limpio, `pnpm check` 52/52 (1 aviso de lint ya existente en `@repo/ui`) y e2e 91/91 — 2026-10-22.
- Seguridad de los cimientos, segunda tanda (fase A del plan, `docs/audits/2026-10-22-reauditoria-plan.md`): equipo interno con `audit_logs` de solo inserción y acceso JIT con MFA (#16), freno del login con clave de servidor (#36), invitaciones con consentimiento y fuera el alta directa de memberships (#37), organizaciones suspendidas sin acceso (#41), gitleaks arreglado (#47), mergeo autónomo sin revisión humana hasta el primer dato real (#48, #49) y next 16.4.2 contra dos avisos críticos de ejecución remota de código (#50). Verificado sobre `main` (`b15a62f`): pgTAP 406/406, `db lint` limpio, `pnpm check` 52/52 (1 aviso de lint ya existente en `@repo/ui`) y e2e 95/95 — 2026-10-22. Al verificar apareció un fallo intermitente del seed (contraseñas del equipo interno sin dígito, ~5 % de ejecuciones): corregido en el PR de la re-auditoría.
- MFA obligatorio para administrar (fase A2 del plan; hallazgo 2.3, P0-6) — #53: toda escritura de `org_admin` y las inserciones del equipo interno en `audit_logs` exigen aal2 en RLS (test estructural incluido); `/login/mfa` tras la contraseña, con los códigos fallidos en el mismo freno que las contraseñas; `requireUser()` no deja pasar una sesión aal1 de quien tiene un factor; Ajustes → Seguridad para activar y desactivar el TOTP; los `org_admin` del seed salen con TOTP. Verificado en local sobre la rama al día con `main`: pgTAP 432/432 (26 nuevos), prueba en negativo con el rollback (fallan 19/26), `pnpm check` 52/52, e2e 97/97 dos veces seguidas; en el CI del PR; y sobre `main` (`d79d9e6`) tras el merge: pgTAP 432/432, `db lint` limpio, `pnpm check` 52/52 y e2e 98/98 — 2026-10-22. Encontrados por el camino dos comportamientos de Supabase Auth (verificaciones simultáneas que chocan y cierre de las sesiones aal1 al verificar): resueltos con reintentos en la app y con `withMfaLock()` en los e2e (re-auditoría R-15). En la revisión previa al merge apareció un fallo propio: entrar con la contraseña vaciaba también los fallos de códigos MFA (quien supiera la contraseña tenía 5 intentos nuevos cada 30 s); corregido, con un e2e que falla sin la corrección.
- Higiene de la web y CI (fases A3 y A4 del plan): listas completas por páginas en lugar del corte silencioso de PostgREST en 1.000 filas (#54; probado contra PostgREST con 1.203 locales: la consulta normal devolvía 1.000), errores sin concatenar, GraphQL fuera de la API y `agentGuidance: false` en turbo (turbo 2.11.7 escribía en `AGENTS.md`) (#54); Actions al día en Node 24 (pnpm/action-setup 6.1.0, setup-cli v3.0.1, gitleaks-action v3.0.0) y caché de Playwright (#55); 11 dependencias menores (#51). Dependabot #42–#46 cerrados o sustituidos. Verificado sobre `main` (`d79d9e6`, con #53) — 2026-10-22.
- Observabilidad, primera parte (fase B1; ADR 0032) — #57: logs JSON con pino en la salida estándar (censura de contraseñas, tokens, emails y cabeceras de sesión; seudónimos HMAC con `LOG_PSEUDONYM_KEY`), `request.error` por cada error del servidor (deduplicado por *digest*) y eventos de seguridad de login, MFA, invitaciones y organización. Verificado sobre `main` (`d067498`) tras el merge: pgTAP 432/432, `db lint` limpio, `pnpm check` 52/52 y e2e 100/100 — 2026-10-22. Sentry, en B1b.
- Staging alojado (fase B2) — #58 y conectores:
  - **Supabase:** `moodly-staging` (organización `dsvmotion`, Free, `eu-central-1`, Postgres 17, ref `sgeswmdqstonegceusej`), con las 8 migraciones del repo:
    - las 4 primeras, aplicadas con el conector antes de recordar que B2 exige el CI; se verificó por MD5 que el SQL es idéntico al del repo y se alineó el historial;
    - las otras 4, aplicadas por el primer despliegue del CI.
  - **CI → staging:** `.github/workflows/deploy-staging.yml` corre `supabase db push` tras el CI verde de `main`, con el commit exacto. Usa los secretos del entorno `staging` de GitHub.
  - **Vercel:** proyecto `moodly-staging` (`fra1`, Node 24, turbo con typecheck) sirve `main` en `staging.moodlycrm.com`, con CNAME en Hostinger.
  - **Login:** clave del freno registrada (solo el hash); registro público cerrado a mano por producto.
  - **Verificado:** CI de `main` (`872e1c8`) en verde en los 5 checks; despliegue a staging en verde (run 39871956506); historial de staging igual al del repo; `/login` en staging responde con la CSP con nonce y las cabeceras de seguridad; sin errores de ejecución en Vercel. Avisos de Supabase revisados (solo los esperados).
  - **Falta:** el primer usuario de staging, para probar el login de punta a punta allí — 2026-10-23.

## En curso
- **Plan vigente:** `docs/audits/2026-10-23-auditoria-estado.md` (auditoría del 2026-10-23, que actualiza el plan de la re-auditoría del 2026-10-22). Una fase no avanza hasta que la anterior está mergeada, verificada sobre `main` y anotada aquí.
- **Dominio (decisión de producto, 2026-10-22):** staging en `staging.moodlycrm.com`. Producción irá directamente en `moodly.com` cuando esté lista, así que no hay mudanza: `moodlycrm.com` se queda para staging, y estrenar `moodly.com` solo pide darlo de alta en Vercel y en Resend.
- **Claves de servidor de staging** (`LOGIN_THROTTLE_KEY` y `LOG_PSEUDONYM_KEY`, *sensitive* en Vercel): las generó el agente solo para staging. **Se rotan antes de cualquier dato real, y las de producción las genera una persona directamente en Vercel.**
- **Mergeo sin revisión humana (decisión de producto, 2026-10-22):** mientras no haya datos reales de clientes, el agente mergea sus PRs, también los sensibles, con CI en verde sobre el commit exacto y sin tests debilitados (AGENTS.md → «Mergeo autónomo»). La lista de zonas sensibles completa se guarda en `scripts/merge-guard/sensitive-paths.suspended.txt`.
  - **Condición de salida a producción (bloqueante):** antes de meter el primer dato real de un cliente, reactivar la revisión humana al menos para migraciones, RLS, funciones `SECURITY DEFINER`, auth, secretos y la propia guarda (copiar esas líneas a `sensitive-paths.txt`), hacer que el job `sensitive-paths` lea la lista de la rama base y no de la del PR, y proteger `main` en GitHub.
- **Dependabot:** sin PRs abiertos. Ojo: los comandos `@dependabot …` escritos desde el conector de GitHub no le llegan (el conector los escapa); para actualizarlos, un PR propio con los mismos commits fijados.
- **Centralización (2026-10-21):** el desarrollo sigue solo desde la sesión en la nube. La sesión del Mac (`session_01VasfkA8hcvcB3xhbVSrmJ1`) se puede borrar.
- **Decisiones de producto anotadas:** el número de sedes de la clínica de la demo da igual (se queda en 2: Centro y Norte); SSO y SCIM con «lo más profesional, seguro y escalable» → WorkOS; modelos en todas las regiones (ADR 0019); WhatsApp directo con Meta (ADR 0020); 4 agentes de serie y estructura ampliable (ADR 0030); construir frente a adoptar (ADR 0031).
- **Cuentas creadas por producto (2026-10-22):** Vercel Pro, Supabase, Railway, Cloudflare, WorkOS, Sentry, Meta for Developers, Resend, GitHub y dominios en Hostinger. Estado de cada una en la re-auditoría §2.4. Las claves van siempre en el gestor de secretos del proveedor o en un `.env` local, nunca en el chat ni en el repo.

## Bloqueado
- **Código en la sesión del agente (R-26):** el plugin Semgrep Guardian no puede conectarse (el proxy del entorno bloquea sus dominios) y, sin sesión iniciada, bloquea las ediciones de código y las instalaciones de paquetes. Producto lo desactivó en claude.ai, pero sigue cargado hasta que la sesión vuelva a arrancar. Bloquea Sentry (B1b) y la configuración de Auth como código (B3). El proyecto `moodly-ai/moodly-web` ya existe en Sentry y su DSN está en Vercel.
- **Plan de Vercel (R-19):** la API de logs respondió como plan Hobby (retención de 1 h). Producto confirma si el equipo `diegosanjuan` es Pro; si no, se mueve el proyecto al equipo Pro (Hobby no permite uso comercial ni *log drains*).
- **Primer usuario de staging:** decisión de producto sobre cómo crearlo (propuesta en la auditoría del 2026-10-23, §5).
- App móvil · Fase 0: **falta la verificación en un iPhone real** (instalar desde Safari, pantalla completa, login, modo avión → "Sin conexión"). Necesita un despliegue HTTPS (llega con el staging) y un iPhone; la hace producto.
- Protección de la rama `main`: GitHub devuelve 403 en branch protection y rulesets en un repo privado del plan Free. Hace falta GitHub Pro/Team o hacer el repo público. Hasta entonces, «no mergear sin CI en verde» solo lo sostiene el proceso (AGENTS.md).
- Datos reales de clientes: Supabase Free no tiene copias de seguridad. **Ningún dato real antes de Supabase Pro en la UE** con una restauración probada, la revisión humana reactivada y los DPAs firmados.
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical y cliente piloto (#3), AI Gateway y proveedor de embeddings (#5) y proveedor de KMS (#6). No bloquean la Fase 0.

## Próximo (plan de la auditoría del 2026-10-23)
**Fase A — cerrar la seguridad de los cimientos**
- A2 · MFA obligatorio para administrar: hecho (#53). Quedan códigos de recuperación y alertas al desactivar MFA (con B1).
- A3 · Higiene de la web: hecho (#54 paginación, errores y GraphQL; #56 organización activa y Zod). **Fase A cerrada**: verificado sobre `main` (`0974d31`) pgTAP 432/432, `pnpm check` 52/52 y e2e 100/100 — 2026-10-22.
- A4 · CI: hecho (#52 revisión diaria de dependencias, #55 Actions y caché de Playwright).
- Pendientes menores de la fase: traducir la página de login, Inicio (P1) como destino tras el login, `location_manager` que invita en sus locales, alta de la cuenta de Auth de quien aún no la tiene (llega con WorkOS).

**Fase B — staging alojado y operación**
- B1 · Observabilidad (ADR 0032): logs y eventos de seguridad hechos (#57).
- B1b · Sentry: `@sentry/nextjs` con *tunnel* propio, sin datos personales y sin *replay*. Bloqueado por R-26.
- B2 · Staging: hecho (#58). Falta el primer usuario y el login de punta a punta allí.
- B3 · Auth y MFA de verdad:
  - **R-16 primero (alta):** el MFA no protege las lecturas en la capa de datos. Con la contraseña sola (aal1) se lee por REST todo lo de sus organizaciones; comprobado en local. Arreglo: `session_is_active()` exige aal2 a quien tiene un factor verificado.
  - Auth como código, R-17: `[remotes.staging]` y `supabase config diff`/`push` desde el CI, con registro cerrado, contraseñas, `site_url` y TOTP.
  - R-21 (pedir el código para desactivar el MFA) y R-23 (no contar los 5xx de Auth en el freno).
  - Cloudflare Turnstile.
- B4 · Email transaccional con Resend (dominio de `moodlycrm.com` para staging, con SPF, DKIM y DMARC): las invitaciones llegan por email, con el token fuera de la query (R-22).
- B5 · Higiene de staging (nuevo):
  - R-18: *previews* de Vercel sin claves de servidor y entorno `staging` de GitHub restringido a `main`;
  - R-19: plan de Vercel;
  - R-20: revocar los privilegios que sobran a `authenticated`;
  - *log drain* y alertas.

**Fase D — runtime de agentes** (propuesta de la auditoría del 2026-10-23: antes que la C, salvo un cliente enterprise a la vista; decide producto)
- Catálogo `agent_types`, `agents`, `skills`, `agent_skills`, `config_overrides`, `config_snapshots` con herencia y bloqueos (antes tarea 5; ADR 0030).
- *Spike* de DBOS (ADR 0027) y worker en Railway (antes tarea 6).
- Controles previos a la primera skill: `tenantDb(orgId)` con regla de lint (3.2), aprobaciones atadas al hash (3.3), destinatarios fijados por el runtime (3.4) y evals de ataque antes de activar ningún agente (3.8).
- `/ops` mínimo, PRs 2–4 (ADR 0021): `requirePlatformStaff()` y `withPlatformStaffAudit()`, `/ops/organizations` y `/ops/audit`, con la concesión JIT de #16.
- Primera pieza de la prioridad del producto: memoria con procedencia (ADR 0024) y objetivos.

**Fase C — identidad enterprise**
- *Spike* de WorkOS (ADR 0022) contra su entorno Staging: login, MFA, SSO de prueba, revocación inmediata y los tests de aislamiento en verde.

**Fase E — canales e integraciones**
- WhatsApp Cloud API (ADR 0020) con webhooks firmados (7.1); OAuth (7.2).

**Siempre abiertos**
- 3d. Con Supabase Realtime: comprobar que una sesión cerrada deja de recibir eventos.
- 3e. Identidad de GitHub separada para el agente, con permisos limitados.
- Borrado RGPD frente a `audit_logs` de solo inserción (ADR 0021, D6).
- Redactar ADRs 0001–0017 (MANUAL §19). El 0003 ya está.
