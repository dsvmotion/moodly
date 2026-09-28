# STATUS — estado real del proyecto

> Actualizar al cerrar cada tarea. Solo va en "Hecho y verificado" lo que se ha ejecutado y comprobado de verdad.

## Hecho y verificado
- (nada todavía — repositorio sin código)

## En curso
- (nada)

## Bloqueado
- Fase 1 depende de decisiones abiertas (MANUAL §18): vertical piloto (#3), BSP de WhatsApp (#4), proveedores LLM y embeddings (#5). No bloquean la Fase 0.

## Próximo (Fase 0 — Cimientos, MANUAL §17)
1. Scaffold del monorepo (pnpm + Turborepo, `apps/web`, `apps/worker`, `packages/*` vacíos), TypeScript strict, lint y un test trivial pasando en CI (GitHub Actions). Rellenar los comandos en `AGENTS.md`/`CLAUDE.md`.
2. Supabase local + primera migración: `organizations`, `regions`, `locations`, `users`, `memberships`, con RLS y tests pgTAP de aislamiento entre organizaciones y entre locales.
3. Auth + seed de una organización de prueba con 3 locales y un usuario de cada rol.
4. App shell en `apps/web` con `packages/ui` (MANUAL §9.2): barra lateral, selector de organización y alcance, búsqueda, ⌘K y `DataTable` base mostrando locales y usuarios reales del seed. Verificar con capturas que cada rol ve solo lo que le corresponde.
5. Catálogo `agent_types`, `agents`, `config_overrides`, `config_snapshots` + resolución de configuración con herencia y bloqueos, con tests.
6. Worker always-on con pg-boss: job de prueba encolado desde la web y procesado por el worker, con evidencia en logs.
7. Redactar ADRs 0001–0017 (MANUAL §19).
