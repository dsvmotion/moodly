# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- Scaffold del monorepo (Fase 0 · tarea 1): pnpm 11 + Turborepo, 13 workspaces vacíos `@repo/*` (`apps/{web,worker}`, `packages/*`), TypeScript strict, ESLint (typescript-eslint strict), Vitest con un test trivial, CI en GitHub Actions y comandos en `AGENTS.md`/`CLAUDE.md` — verificado con una instalación limpia en local (`pnpm install --frozen-lockfile`, `pnpm typecheck`/`lint`/`test`/`build`: 13/13 tareas OK, 1 test pasando), una prueba negativa de las tres puertas (tsc exit 2, eslint exit 1, vitest exit 1) y el CI en verde en el PR (run 36454243122, Node 24.21.0) — 2026-09-28 — https://github.com/dsvmotion/moodly/pull/1
- Supabase local + primera migración de tenants con RLS (Fase 0 · tarea 2): `organizations`, `regions`, `locations`, `users` y `memberships` con RLS activado y forzado, helpers `security definer` en `private`, guardas de negocio (campos de la organización, columnas inmutables, estado y estructura del local, último `org_admin`) y mínimo privilegio (sin TRUNCATE/REFERENCES/TRIGGER para `authenticated`, nada para `anon`) — verificado con 158 tests pgTAP, pruebas negativas por cada protección, rollback probado, `supabase db lint` limpio, revisión humana aplicada y CI en verde (run 36566349349, Supabase CLI 2.118.0); tras el merge, 158/158 también sobre `main` (`a04b9f8`) — 2026-09-29 — https://github.com/dsvmotion/moodly/pull/2

## En curso
- Auth + seed (Fase 0 · tarea 3) — PR #3 abierto, pendiente de revisión humana (auth y secretos, AGENTS.md). Hecho:
  - Seed idempotente `pnpm db:seed` (`packages/db/src/seed`): Demo A con 1 región, 3 locales (2 en la región, 1 sin región) y un usuario por rol; Demo B con 1 local y su `org_admin`. Contraseñas generadas en cada ejecución, guardadas solo en `packages/db/.seed/` (ignorado por git, 0600). Solo corre contra Supabase local.
  - `apps/web` en Next.js 16.3.6 con Supabase Auth (`@supabase/ssr`): login por email y contraseña, cierre de sesión, `proxy.ts` con `getClaims()` y rutas protegidas; sin service role en la app (hay un test que lo comprueba).
  - Página "Mi organización" (`/app/settings/organization`) con consultas normales vía RLS.
  - Tipos de la base de datos generados (`pnpm db:types`) y `BRAND_NAME` en `packages/config`.
  - 11 tests e2e con Playwright (5 roles + auth) y prueba negativa (política de locales permisiva → fallan los 6 tests de roles).
  - Job `e2e` en el CI.
  - Revisión de seguridad de la autenticación (9 puntos), respondida en el PR. Tres huecos encontrados y corregidos, cada uno con test y prueba negativa:
    - el registro público estaba abierto;
    - cerrar sesión no invalidaba las cookies copiadas antes (ahora hay una DAL con `getUser()`);
    - había una redirección abierta con tabulador o salto de línea en `next`.
  - 27 tests e2e y `.env.example`.
  - CI en verde con los jobs `check`, `db` y `e2e` (run 36570055914: 158 pgTAP + 11 e2e; capturas por rol en el artefacto `playwright`) — 2026-09-29 — https://github.com/dsvmotion/moodly/pull/3

## Bloqueado
- Protección de la rama `main` (PR y CI obligatorios antes de mergear) — GitHub devuelve 403 tanto en branch protection como en rulesets: "Upgrade to GitHub Pro or make this repository public" (repo privado en plan Free) — hace falta que producto decida si pasa a GitHub Pro/Team o hace el repo público. Mientras tanto, la regla "no mergear sin CI en verde" solo la sostiene el proceso (AGENTS.md).
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical piloto (#3), BSP de WhatsApp (#4), proveedores LLM y embeddings (#5). No bloquean la Fase 0.

## Próximo (Fase 0 — Cimientos, MANUAL §17)
3c. Decisiones pendientes de la revisión de autenticación del PR #3:
   - Tokens tras el logout en la API de datos: la app ya rechaza la sesión cerrada, pero un access token copiado sigue sirviendo contra la API REST de Supabase hasta que caduca (`jwt_expiry` = 1 h). Opciones documentadas por Supabase: comprobar `session_id` contra `auth.sessions` en los helpers de RLS (migración con revisión humana y coste por fila) o reducir `jwt_expiry`, sin bajar de 5 minutos.
   - Límites de Auth en producción: `config.toml` solo aplica en local. Cuando exista el proyecto alojado, hay que fijar ahí los mismos límites y la política de contraseñas, y valorar un captcha en el login.
3b. Invitaciones de miembros (sale de la revisión del PR #2 y del alcance de la tarea 3):
   - El alta de miembros tiene que pasar por invitaciones (email, caducidad, aceptación por el invitado), no por un INSERT directo del `org_admin` en `memberships` con cualquier `user_id`. Hoy la política `memberships_insert` permite al `org_admin` dar de alta a cualquier usuario existente sin su consentimiento; al introducir las invitaciones hay que retirar o restringir ese INSERT y cubrirlo con tests pgTAP.
   - Invitar staff por parte del `location_manager` (en sus locales), sobre el mismo flujo.
   - Alta del perfil `public.users` al aceptar la invitación (hoy solo lo crea el seed). Si se hace con un trigger `SECURITY DEFINER` sobre `auth.users`, requiere revisión humana (AGENTS.md).
4. App shell en `apps/web` con `packages/ui` (MANUAL §9.2): barra lateral, selector de organización y alcance, búsqueda, ⌘K y `DataTable` base mostrando locales y usuarios reales del seed. Verificar con capturas que cada rol ve solo lo que le corresponde.
5. Catálogo `agent_types`, `agents`, `config_overrides`, `config_snapshots` + resolución de configuración con herencia y bloqueos, con tests.
6. Worker always-on con pg-boss: job de prueba encolado desde la web y procesado por el worker, con evidencia en logs.
7. Redactar ADRs 0001–0017 (MANUAL §19). El 0003 (Supabase + RLS) ya está redactado en la tarea 2.
