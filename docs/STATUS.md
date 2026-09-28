# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- Scaffold del monorepo (Fase 0 · tarea 1): pnpm 11 + Turborepo, 13 workspaces vacíos `@repo/*` (`apps/{web,worker}`, `packages/*`), TypeScript strict, ESLint (typescript-eslint strict), Vitest con un test trivial, CI en GitHub Actions y comandos en `AGENTS.md`/`CLAUDE.md` — verificado con una instalación limpia en local (`pnpm install --frozen-lockfile`, `pnpm typecheck`/`lint`/`test`/`build`: 13/13 tareas OK, 1 test pasando), una prueba negativa de las tres puertas (tsc exit 2, eslint exit 1, vitest exit 1) y el CI en verde en el PR (run 36454243122, Node 24.21.0) — 2026-09-28 — https://github.com/dsvmotion/moodly/pull/1

## En curso
- (nada)

## Bloqueado
- Protección de la rama `main` (PR y CI obligatorios antes de mergear) — GitHub devuelve 403 tanto en branch protection como en rulesets: "Upgrade to GitHub Pro or make this repository public" (repo privado en plan Free) — hace falta que producto decida si pasa a GitHub Pro/Team o hace el repo público. Mientras tanto, la regla "no mergear sin CI en verde" solo la sostiene el proceso (AGENTS.md).
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical piloto (#3), BSP de WhatsApp (#4), proveedores LLM y embeddings (#5). No bloquean la Fase 0.

## Próximo (Fase 0 — Cimientos, MANUAL §17)
2. Supabase local + primera migración: `organizations`, `regions`, `locations`, `users`, `memberships`, con RLS y tests pgTAP de aislamiento entre organizaciones y entre locales.
3. Auth + seed de una organización de prueba con 3 locales y un usuario de cada rol.
4. App shell en `apps/web` con `packages/ui` (MANUAL §9.2): barra lateral, selector de organización y alcance, búsqueda, ⌘K y `DataTable` base mostrando locales y usuarios reales del seed. Verificar con capturas que cada rol ve solo lo que le corresponde.
5. Catálogo `agent_types`, `agents`, `config_overrides`, `config_snapshots` + resolución de configuración con herencia y bloqueos, con tests.
6. Worker always-on con pg-boss: job de prueba encolado desde la web y procesado por el worker, con evidencia en logs.
7. Redactar ADRs 0001–0017 (MANUAL §19).
