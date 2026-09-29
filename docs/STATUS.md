# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- Scaffold del monorepo (Fase 0 · tarea 1): pnpm 11 + Turborepo, 13 workspaces vacíos `@repo/*` (`apps/{web,worker}`, `packages/*`), TypeScript strict, ESLint (typescript-eslint strict), Vitest con un test trivial, CI en GitHub Actions y comandos en `AGENTS.md`/`CLAUDE.md` — verificado con una instalación limpia en local (`pnpm install --frozen-lockfile`, `pnpm typecheck`/`lint`/`test`/`build`: 13/13 tareas OK, 1 test pasando), una prueba negativa de las tres puertas (tsc exit 2, eslint exit 1, vitest exit 1) y el CI en verde en el PR (run 36454243122, Node 24.21.0) — 2026-09-28 — https://github.com/dsvmotion/moodly/pull/1

## En curso
- Supabase local + primera migración de tenants con RLS (Fase 0 · tarea 2) — PR #2 abierto, **pendiente de revisión humana** (migración + políticas RLS, AGENTS.md) antes de mergear. Hecho:
  - Configuración de Supabase en `packages/db/supabase`.
  - Migración `20260929105448_tenants_rls.sql`: `organizations`, `regions`, `locations`, `users` y `memberships`, con RLS activado y forzado, 15 políticas, helpers `security definer` en `private` y guardas de negocio (estructura del local editable solo por el `org_admin`, la organización nunca se queda sin `org_admin`, locales y regiones sin borrado desde la app).
  - Rollback probado.
  - 158 tests pgTAP en verde (aislamiento A/B, alcance por local y región, operativa de los managers, visibilidad de personas, org_admin y último admin, escalada, alcance cruzado, WITH CHECK, anon, funciones security definer, columnas de users, índices, campos de la organización, columnas inmutables, estado del local, mínimo privilegio y garantías estructurales).
  - Revisión de seguridad previa al merge (7 puntos) respondida en el PR, con una prueba negativa por punto.
  - Cambios de la revisión humana aplicados (guardas de organización, columnas inmutables y estado del local; sin TRUNCATE/REFERENCES/TRIGGER), con pruebas negativas.
  - Pruebas negativas: sin `locations_select` fallan 14 tests; con `using (true)` fallan 10; sin la guarda del último admin, 4; sin la guarda de estructura, 7.
  - Supabase CLI actualizado a 2.118.0 (local y CI).
  - `supabase db lint` limpio.
  - Job `db` en el CI.
  - ADR 0003 (propuesto).
  - PR: https://github.com/dsvmotion/moodly/pull/2 — CI: ver el último run del PR.

## Bloqueado
- Protección de la rama `main` (PR y CI obligatorios antes de mergear) — GitHub devuelve 403 tanto en branch protection como en rulesets: "Upgrade to GitHub Pro or make this repository public" (repo privado en plan Free) — hace falta que producto decida si pasa a GitHub Pro/Team o hace el repo público. Mientras tanto, la regla "no mergear sin CI en verde" solo la sostiene el proceso (AGENTS.md).
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical piloto (#3), BSP de WhatsApp (#4), proveedores LLM y embeddings (#5). No bloquean la Fase 0.

## Próximo (Fase 0 — Cimientos, MANUAL §17)
3. Auth + seed de una organización de prueba con 3 locales y un usuario de cada rol.
   - **Pendiente de la revisión del PR #2:** el alta de miembros tiene que pasar por invitaciones (email, caducidad, aceptación por el invitado), no por un INSERT directo del `org_admin` en `memberships` con cualquier `user_id`. Hoy la política `memberships_insert` permite al `org_admin` dar de alta a cualquier usuario existente sin su consentimiento; al introducir las invitaciones hay que retirar o restringir ese INSERT y cubrirlo con tests pgTAP.
   - Invitar staff por parte del `location_manager` (en sus locales), sobre el mismo flujo de invitaciones.
4. App shell en `apps/web` con `packages/ui` (MANUAL §9.2): barra lateral, selector de organización y alcance, búsqueda, ⌘K y `DataTable` base mostrando locales y usuarios reales del seed. Verificar con capturas que cada rol ve solo lo que le corresponde.
5. Catálogo `agent_types`, `agents`, `config_overrides`, `config_snapshots` + resolución de configuración con herencia y bloqueos, con tests.
6. Worker always-on con pg-boss: job de prueba encolado desde la web y procesado por el worker, con evidencia en logs.
7. Redactar ADRs 0001–0017 (MANUAL §19). El 0003 (Supabase + RLS) ya está redactado en la tarea 2.
