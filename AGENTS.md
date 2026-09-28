# AGENTS.md — Instrucciones para agentes de código (Claude Code y Codex)

> `CLAUDE.md` tiene exactamente este mismo contenido. Si cambias uno, cambia el otro en el mismo PR.

## Qué es este proyecto
Plataforma B2B de agentes de IA que ejecutan trabajo real dentro de empresas (pymes, medianas y cadenas multi-local).
Cada empresa tiene 4 agentes integrados (`customer`, `sales`, `operations`, `admin`) que conocen el negocio, aprenden con el tiempo, trabajan contra objetivos y actúan como coach.
**Prioridad máxima del producto:** memoria que aprende (cruzada entre agentes y locales), objetivos del negocio y modo coach (MANUAL §5.12 y §6).
**Fuente de verdad completa: `docs/MANUAL.md`.** Léelo antes de diseñar cualquier cosa.

## Al empezar cada sesión, lee en este orden
1. `docs/STATUS.md` — qué está hecho y verificado, en curso, bloqueado y lo próximo.
2. Las secciones de `docs/MANUAL.md` que afectan a la tarea.
3. Los ADRs recientes en `docs/adr/`.

## Metodología obligatoria: construir → probar → verificar → siguiente
- Nada está hecho sin haberlo ejecutado y comprobado: test real, log real, flujo real. "En teoría funciona" no vale.
- Incrementos pequeños, cada uno comprobable de inmediato.
- Al cerrar una tarea: adjunta la evidencia (salida de tests, logs, capturas) en el PR.
- Si algo no se pudo verificar (falta credencial, entorno o datos), dilo explícitamente y márcalo como **Bloqueado** en `docs/STATUS.md`. No lo marques como hecho.

## Definición de hecho
- [ ] TypeScript `strict` sin errores y lint limpio.
- [ ] Tests del comportamiento nuevo, pasando en local y en CI.
- [ ] Si toca datos de clientes: tests pgTAP de aislamiento (RLS) pasando.
- [ ] Si toca agentes, skills, prompts o plantillas: evals afectadas pasando.
- [ ] Flujo afectado ejecutado de extremo a extremo, con evidencia en el PR.
- [ ] Migraciones reversibles o con plan de vuelta atrás.
- [ ] `docs/STATUS.md` actualizado; ADR nuevo si hubo decisión de arquitectura.

## Stack (ver MANUAL §3.2 para el estado de cada elección)
TypeScript strict · pnpm workspaces + Turborepo · Next.js (App Router) · Tailwind + shadcn/ui · Zod · Supabase Postgres (región UE) con RLS y pgvector · migraciones SQL con Supabase CLI · Vercel AI SDK · pg-boss · worker Node always-on · Vitest · pgTAP · Playwright · GitHub Actions.

## Estructura
Ver MANUAL §3.3. Resumen: `apps/web`, `apps/worker`, `packages/{db,domain,agent-core,skills,integrations,channels,knowledge,templates,ui,evals,config}`.

## Frontend
Estructura de referencia: Langdock, Attio y Apollo.io (MANUAL §9): barra lateral con selector de organización y de alcance (organización/región/local), búsqueda y ⌘K, navegación principal, agentes, registros, vistas guardadas, favoritos y recientes; panel principal con los 7 patrones de pantalla (P1–P7). Toda pantalla nueva encaja en uno de esos patrones y usa los componentes de `packages/ui`. Se copia la estructura, nunca la identidad visual de esas marcas.

## Comandos
> Requisitos: Node 24 LTS (`.nvmrc`; con nvm: `nvm use`) y pnpm 11 vía corepack (`corepack enable`; la versión exacta está en `packageManager` de `package.json`).
> Todos los comandos se ejecutan desde la raíz y Turborepo los lanza en cada workspace. Para uno solo: `pnpm --filter @repo/<nombre> <script>`.
> No inventes comandos que no existan todavía; si los creas, documéntalos aquí en el mismo PR.
- Instalar: `pnpm install`
- Levantar en local (Supabase + web + worker): PENDIENTE (tareas 2, 4 y 6 de la Fase 0)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Tests unitarios: `pnpm test`
- Tests de base de datos (pgTAP): PENDIENTE (tarea 2 de la Fase 0)
- Evals: PENDIENTE (cuando existan agentes)
- Build: `pnpm build`
- Todo lo que corre el CI (typecheck + lint + test + build): `pnpm check`

## Prohibido
- Inventar credenciales, cuentas o proveedores de integración. Pídelos.
- Usar la service role de Supabase en `apps/web` para datos de usuario.
- Consultas del worker sin `organization_id` explícito.
- Desactivar RLS, saltarse tests o bajar umbrales de evals para que algo pase.
- Escribir el nombre de la marca a mano (usa `BRAND_NAME`) o IDs de modelo LLM en código de negocio (usa `packages/config`).
- Tomar `organization_id`, `location_id` o destinatarios de los argumentos que genera el LLM.
- Mergear tu propio PR.

## Requiere revisión humana siempre
Migraciones · políticas RLS · auth · secretos y credenciales · motor de políticas · techos de autonomía · reglas de plataforma de los prompts.

## Trabajo en paralelo (Claude Code + Codex)
Una tarea, una rama. Nunca dos agentes sobre la misma migración a la vez.
