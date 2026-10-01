# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- Scaffold del monorepo (Fase 0 · tarea 1): pnpm 11 + Turborepo, 13 workspaces vacíos `@repo/*` (`apps/{web,worker}`, `packages/*`), TypeScript strict, ESLint (typescript-eslint strict), Vitest con un test trivial, CI en GitHub Actions y comandos en `AGENTS.md`/`CLAUDE.md` — verificado con una instalación limpia en local (`pnpm install --frozen-lockfile`, `pnpm typecheck`/`lint`/`test`/`build`: 13/13 tareas OK, 1 test pasando), una prueba negativa de las tres puertas (tsc exit 2, eslint exit 1, vitest exit 1) y el CI en verde en el PR (run 36454243122, Node 24.21.0) — 2026-09-28 — https://github.com/dsvmotion/moodly/pull/1
- Supabase local + primera migración de tenants con RLS (Fase 0 · tarea 2): `organizations`, `regions`, `locations`, `users` y `memberships` con RLS activado y forzado, helpers `security definer` en `private`, guardas de negocio (campos de la organización, columnas inmutables, estado y estructura del local, último `org_admin`) y mínimo privilegio (sin TRUNCATE/REFERENCES/TRIGGER para `authenticated`, nada para `anon`) — verificado con 158 tests pgTAP, pruebas negativas por cada protección, rollback probado, `supabase db lint` limpio, revisión humana aplicada y CI en verde (run 36566349349, Supabase CLI 2.118.0); tras el merge, 158/158 también sobre `main` (`a04b9f8`) — 2026-09-29 — https://github.com/dsvmotion/moodly/pull/2
- Auth + seed (Fase 0 · tarea 3): seed idempotente solo local (`pnpm db:seed`), Supabase Auth en `apps/web` (Next.js 16.3.6, `@supabase/ssr`), proxy con `getClaims()` y DAL con `getUser()`, página "Mi organización" vía RLS, registro público cerrado y redirección tras login blindada — verificado con 27 e2e por rol y de seguridad (con pruebas negativas), revisión de seguridad de la autenticación (9 puntos) aplicada y CI en verde (run 36700076225); tras el merge, sobre `main` (`b4c26d3`) pasan `pnpm check` 52/52, pgTAP 158/158 y e2e 27/27 — 2026-09-30 — https://github.com/dsvmotion/moodly/pull/3
- Revocación real de sesiones (Fase 0 · tarea 3c-1): `private.session_is_active()` (sesión viva en `auth.sessions`, usuario no borrado ni baneado) como primera condición, en forma de InitPlan, de las 15 políticas de las 5 tablas de tenants; un token copiado antes del logout ya no lee datos por la API REST — verificado con 186 pgTAP, 29 e2e, pruebas negativas, `EXPLAIN ANALYZE` (1 llamada frente a 2.004 sin envolver), rollback probado y CI en verde (run 36703604922); tras el merge, sobre `main` (`d64cdc0`) pasan `pnpm check` 52/52, pgTAP 186/186 y e2e 29/29 — 2026-09-30 — https://github.com/dsvmotion/moodly/pull/4
- Mergeo autónomo endurecido: `scripts/safe-merge.sh` (checks sobre el head exacto, zonas sensibles y tests debilitados), lista única de zonas sensibles y job de CI `sensitive-paths` con la etiqueta `revisado-humano`, que se invalida con cada commit nuevo — verificado con 65 tests del script, pruebas negativas, la etiqueta comprobada en GitHub (de rojo a verde sobre el mismo commit) y 6 PRs mergeados después con el script — 2026-10-01 — https://github.com/dsvmotion/moodly/pull/8

## En curso
- App shell (Fase 0 · tarea 4) — estado a 2026-10-01, `main` en `ebaf37b`, verificado (`pnpm check` 51/51, pgTAP 186/186, e2e 83/83):
  - **Mergeado:** #6 (dependencias, por producto), #7 (tokens y componentes base), #9 (barra lateral), #10 (selector de alcance), #11 (Registros con vista previa), #12 (paleta ⌘K), #13 (i18n, teclado y axe) y #14 (e2e por rol con capturas). Del #9 al #14, con `scripts/safe-merge.sh`.
  - **PRs abiertos:** ninguno, salvo el de esta actualización de STATUS.
  - **Siguiente, en este orden:**
    1. PR sensible: traducción de la página de login (`apps/web/src/app/login/**`). No lo mergea el agente.
    2. PR sensible: Inicio (P1) en `/app` (redirección tras el login), ajustando las expectativas de URL de los e2e. No lo mergea el agente.
    3. Resumen final de la tarea 4 para producto, con las capturas por rol en `~/Developer/moodly-capturas/tarea-4/` (40 PNG, en claro y oscuro, fuera del repo).
  - **Al retomar:**
    1. `pnpm db:start && pnpm db:seed && pnpm --filter @repo/web env:local`.
    2. Si los e2e fallan al lanzar el navegador: `pnpm --filter @repo/web exec playwright install chromium` (macOS borró la caché del navegador una vez).

## Bloqueado
- Protección de la rama `main` (PR y CI obligatorios antes de mergear) — GitHub devuelve 403 tanto en branch protection como en rulesets: "Upgrade to GitHub Pro or make this repository public" (repo privado en plan Free) — hace falta que producto decida si pasa a GitHub Pro/Team o hace el repo público. Mientras tanto, la regla "no mergear sin CI en verde" solo la sostiene el proceso (AGENTS.md), y eso incluye el mergeo autónomo del agente: GitHub no impediría un merge con el CI en rojo.
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical piloto (#3), BSP de WhatsApp (#4), proveedores LLM y embeddings (#5). No bloquean la Fase 0.

## Próximo (Fase 0 — Cimientos, MANUAL §17)
3b. Invitaciones de miembros (sale de la revisión del PR #2 y del alcance de la tarea 3):
   - El alta de miembros tiene que pasar por invitaciones (email, caducidad, aceptación por el invitado), no por un INSERT directo del `org_admin` en `memberships` con cualquier `user_id`. Hoy la política `memberships_insert` permite al `org_admin` dar de alta a cualquier usuario existente sin su consentimiento; al introducir las invitaciones hay que retirar o restringir ese INSERT y cubrirlo con tests pgTAP.
   - Invitar staff por parte del `location_manager` (en sus locales), sobre el mismo flujo.
   - Alta del perfil `public.users` al aceptar la invitación (hoy solo lo crea el seed). Si se hace con un trigger `SECURITY DEFINER` sobre `auth.users`, requiere revisión humana (AGENTS.md).
3c-2. Configuración de Auth de producción, cuando exista el proyecto alojado de staging: límites de intentos (`sign_in_sign_ups`, `token_refresh`, `token_verifications`), captcha en el login, longitud mínima y requisitos de contraseña, y `jwt_expiry`. `config.toml` solo aplica en local: hay que fijarlo en el proyecto alojado y verificarlo allí.
3d. Cuando se use Supabase Realtime (bandeja, conversaciones, aprobaciones: MANUAL §9.9): verificar que `private.session_is_active()` también se aplica en las suscripciones, es decir, que una sesión cerrada deja de recibir eventos, con un test que lo demuestre.
3e. Identidad de GitHub separada para el agente, con permisos limitados (p. ej. una GitHub App o una cuenta de máquina con acceso de escritura a ramas y PRs, pero sin permiso para gestionar etiquetas ni para mergear sin checks). Hoy el agente usa la cuenta de producto: técnicamente podría poner la etiqueta `revisado-humano`, y solo lo impide la regla de AGENTS.md. Con la identidad separada, además, se pueden exigir revisiones de una persona distinta del autor.
4. App shell en `apps/web` con `packages/ui` (MANUAL §9.2): barra lateral, selector de organización y alcance, búsqueda, ⌘K y `DataTable` base mostrando locales y usuarios reales del seed. Verificar con capturas que cada rol ve solo lo que le corresponde.
5. Catálogo `agent_types`, `agents`, `config_overrides`, `config_snapshots` + resolución de configuración con herencia y bloqueos, con tests.
6. Worker always-on con pg-boss: job de prueba encolado desde la web y procesado por el worker, con evidencia en logs.
7. Redactar ADRs 0001–0017 (MANUAL §19). El 0003 (Supabase + RLS) ya está redactado en la tarea 2.
