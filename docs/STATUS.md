# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- Scaffold del monorepo (Fase 0 · tarea 1): pnpm 11 + Turborepo, 13 workspaces vacíos `@repo/*` (`apps/{web,worker}`, `packages/*`), TypeScript strict, ESLint (typescript-eslint strict), Vitest con un test trivial, CI en GitHub Actions y comandos en `AGENTS.md`/`CLAUDE.md` — verificado con una instalación limpia en local (`pnpm install --frozen-lockfile`, `pnpm typecheck`/`lint`/`test`/`build`: 13/13 tareas OK, 1 test pasando), una prueba negativa de las tres puertas (tsc exit 2, eslint exit 1, vitest exit 1) y el CI en verde en el PR (run 36454243122, Node 24.21.0) — 2026-09-28 — https://github.com/dsvmotion/moodly/pull/1
- Supabase local + primera migración de tenants con RLS (Fase 0 · tarea 2): `organizations`, `regions`, `locations`, `users` y `memberships` con RLS activado y forzado, helpers `security definer` en `private`, guardas de negocio (campos de la organización, columnas inmutables, estado y estructura del local, último `org_admin`) y mínimo privilegio (sin TRUNCATE/REFERENCES/TRIGGER para `authenticated`, nada para `anon`) — verificado con 158 tests pgTAP, pruebas negativas por cada protección, rollback probado, `supabase db lint` limpio, revisión humana aplicada y CI en verde (run 36566349349, Supabase CLI 2.118.0); tras el merge, 158/158 también sobre `main` (`a04b9f8`) — 2026-09-29 — https://github.com/dsvmotion/moodly/pull/2
- Auth + seed (Fase 0 · tarea 3): seed idempotente solo local (`pnpm db:seed`), Supabase Auth en `apps/web` (Next.js 16.3.6, `@supabase/ssr`), proxy con `getClaims()` y DAL con `getUser()`, página "Mi organización" vía RLS, registro público cerrado y redirección tras login blindada — verificado con 27 e2e por rol y de seguridad (con pruebas negativas), revisión de seguridad de la autenticación (9 puntos) aplicada y CI en verde (run 36700076225); tras el merge, sobre `main` (`b4c26d3`) pasan `pnpm check` 52/52, pgTAP 158/158 y e2e 27/27 — 2026-09-30 — https://github.com/dsvmotion/moodly/pull/3

## En curso
- Revocación real de sesiones (Fase 0 · tarea 3c-1) — PR abierto en `feat/fase0-session-revocation`, **pendiente de revisión humana** (migración y políticas RLS). Hecho:
  - `private.session_is_active()` y comprobación de sesión en las 15 políticas de las 5 tablas de tenants (migración `20260930101908_session_revocation`, con rollback probado).
  - Verificado con `EXPLAIN ANALYZE`: es un InitPlan (1 llamada para 2.004 filas recorridas; sin envolver, 2.004 llamadas, una por fila).
  - 186 tests pgTAP (+28) y 29 e2e (+2), con pruebas negativas.
  - El seed espera a Auth y a la API REST tras `db reset` (antes fallaba si se lanzaba justo después).
  - ADR 0003 actualizado.

## Bloqueado
- Protección de la rama `main` (PR y CI obligatorios antes de mergear) — GitHub devuelve 403 tanto en branch protection como en rulesets: "Upgrade to GitHub Pro or make this repository public" (repo privado en plan Free) — hace falta que producto decida si pasa a GitHub Pro/Team o hace el repo público. Mientras tanto, la regla "no mergear sin CI en verde" solo la sostiene el proceso (AGENTS.md).
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical piloto (#3), BSP de WhatsApp (#4), proveedores LLM y embeddings (#5). No bloquean la Fase 0.

## Próximo (Fase 0 — Cimientos, MANUAL §17)
3b. Invitaciones de miembros (sale de la revisión del PR #2 y del alcance de la tarea 3):
   - El alta de miembros tiene que pasar por invitaciones (email, caducidad, aceptación por el invitado), no por un INSERT directo del `org_admin` en `memberships` con cualquier `user_id`. Hoy la política `memberships_insert` permite al `org_admin` dar de alta a cualquier usuario existente sin su consentimiento; al introducir las invitaciones hay que retirar o restringir ese INSERT y cubrirlo con tests pgTAP.
   - Invitar staff por parte del `location_manager` (en sus locales), sobre el mismo flujo.
   - Alta del perfil `public.users` al aceptar la invitación (hoy solo lo crea el seed). Si se hace con un trigger `SECURITY DEFINER` sobre `auth.users`, requiere revisión humana (AGENTS.md).
3c-2. Configuración de Auth de producción, cuando exista el proyecto alojado de staging: límites de intentos (`sign_in_sign_ups`, `token_refresh`, `token_verifications`), captcha en el login, longitud mínima y requisitos de contraseña, y `jwt_expiry`. `config.toml` solo aplica en local: hay que fijarlo en el proyecto alojado y verificarlo allí.
4. App shell en `apps/web` con `packages/ui` (MANUAL §9.2): barra lateral, selector de organización y alcance, búsqueda, ⌘K y `DataTable` base mostrando locales y usuarios reales del seed. Verificar con capturas que cada rol ve solo lo que le corresponde.
5. Catálogo `agent_types`, `agents`, `config_overrides`, `config_snapshots` + resolución de configuración con herencia y bloqueos, con tests.
6. Worker always-on con pg-boss: job de prueba encolado desde la web y procesado por el worker, con evidencia en logs.
7. Redactar ADRs 0001–0017 (MANUAL §19). El 0003 (Supabase + RLS) ya está redactado en la tarea 2.
