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
> Base de datos: Docker en marcha y Supabase CLI 2.118.0 (la misma versión que fija el CI en `.github/workflows/ci.yml`). La configuración de Supabase vive en `packages/db/supabase`.
> Todos los comandos se ejecutan desde la raíz y Turborepo los lanza en cada workspace. Para uno solo: `pnpm --filter @repo/<nombre> <script>`.
> No inventes comandos que no existan todavía; si los creas, documéntalos aquí en el mismo PR.
- Instalar: `pnpm install`
- Levantar Supabase local: `pnpm db:start` (parar: `pnpm db:stop`). Worker: PENDIENTE (tarea 6 de la Fase 0)
- Reaplicar migraciones desde cero: `pnpm db:reset` (borra también los usuarios de Auth: vuelve a ejecutar `pnpm db:seed`)
- Seed de desarrollo (idempotente, solo contra Supabase local): `pnpm db:seed`. Genera contraseñas nuevas en cada ejecución y las guarda solo en `packages/db/.seed/credentials.local.json` (ignorado por git). No las copies a código, logs ni al chat.
- Regenerar los tipos de la base de datos tras una migración: `pnpm db:types`
- Web en local: `pnpm --filter @repo/web env:local` (escribe `apps/web/.env.local` con la URL y la clave publicable) y después `pnpm --filter @repo/web dev` → http://127.0.0.1:3000
- Tests e2e (Playwright; con Supabase levantado, seed aplicado y la web compilada con `pnpm build`): `pnpm --filter @repo/web e2e`. La primera vez: `pnpm --filter @repo/web exec playwright install chromium`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Tests unitarios: `pnpm test`
- Tests de base de datos (pgTAP, con Supabase levantado): `pnpm test:db`
- Lint del esquema SQL (con Supabase levantado): `pnpm db:lint`
- Tests de la guarda de mergeo (`safe-merge.sh` y `check-sensitive.sh`): `bash scripts/merge-guard/tests/run.sh`
- Mergeo autónomo de un PR propio: `scripts/safe-merge.sh <n>` (ver "Mergeo autónomo")
- Evals: PENDIENTE (cuando existan agentes)
- Build: `pnpm build`
- Todo lo que corre el CI: `pnpm check` (typecheck + lint + test + build) y, con Supabase levantado, `pnpm db:lint` + `pnpm test:db` y el e2e (`pnpm db:seed` + `pnpm --filter @repo/web e2e`)

## Prohibido
- Inventar credenciales, cuentas o proveedores de integración. Pídelos.
- Usar la service role de Supabase en `apps/web` para datos de usuario.
- Consultas del worker sin `organization_id` explícito.
- Desactivar RLS, saltarse tests o bajar umbrales de evals para que algo pase.
- Escribir el nombre de la marca a mano (usa `BRAND_NAME`) o IDs de modelo LLM en código de negocio (usa `packages/config`).
- Tomar `organization_id`, `location_id` o destinatarios de los argumentos que genera el LLM.
- Escribir en tablas de tenants desde una función `SECURITY DEFINER` sin revisión humana (ver "Base de datos: guardas").
- Mergear tu propio PR, salvo con `scripts/safe-merge.sh` (siguiente sección). Poner o quitar la etiqueta `revisado-humano`.

## Mergeo autónomo de tus propios PRs
**Solo con `scripts/safe-merge.sh <n>`.** Nunca con `gh pr merge` directamente ni con scripts fuera del repo. Si el script falla por cualquier motivo, **no mergees**: para y avisa a producto con la salida del script. Con cualquier duda, tampoco mergees.

El script aborta ante cualquier error (`set -euo pipefail`) y solo mergea si se cumple todo lo siguiente:
1. **CI en verde sobre el head commit actual.** Espera con `gh pr checks <n> --watch` y después confirma con la API de GitHub que cada check de `scripts/merge-guard/required-checks.txt` existe, que su ejecución más reciente sobre ese commit exacto está en `SUCCESS`, y que el head no ha cambiado durante la espera.
2. **Ninguna zona sensible ni test debilitado.** Compara los archivos del PR con `scripts/merge-guard/sensitive-paths.txt` y busca en el diff `.skip`/`.only`/`.todo`/`.fixme`, pgTAP sin plan y tests borrados. Ese archivo es la **lista única** de zonas sensibles: la usan el script y el job de CI `sensitive-paths`. Incluye, entre otras:
   - migraciones, rollbacks y cualquier `.sql`;
   - `config.toml` de Supabase;
   - autenticación y sesión: proxy, `lib/auth`, `lib/supabase`, login, logout y redirecciones tras el login;
   - secretos: `.env*`, `local-env.ts` y el seed;
   - motor de políticas y techos de autonomía;
   - `.github/` y `scripts/` (incluida la propia guarda);
   - configuración de tests, lint, TypeScript, turbo y build;
   - dependencias (`package.json`, lockfile y workspace);
   - `AGENTS.md`, `CLAUDE.md` y `docs/MANUAL.md`.

   `docs/STATUS.md` y `docs/adr/**` no son sensibles por sí mismos.
3. **Merge fijando el commit revisado:** `gh pr merge <n> --squash --delete-branch --match-head-commit <sha>`.

Antes de lanzar el script, publica en el PR un comentario con el resumen, la evidencia y la lista de archivos tocados.

Después del merge: `git checkout main && git pull` y verifica `pnpm check`, `pnpm test:db` y el e2e (`pnpm db:seed` + `pnpm --filter @repo/web e2e`) sobre `main`. Si algo falla, avisa enseguida.

**Lo que el script no puede detectar sigue siendo tu responsabilidad:** reescribir a la baja un test existente sin borrarlo ni saltarlo (aserciones más laxas, casos eliminados). Si un PR cambia aserciones existentes, no lo mergees: pide revisión.

**La etiqueta `revisado-humano`** la ponen y la quitan solo las personas de producto; tú nunca. Sin ella, el job `sensitive-paths` falla en los PRs que tocan zonas sensibles. Aunque la tenga, un PR sensible nunca se mergea de forma autónoma: `safe-merge.sh` lo rechaza igual.

Nunca desactives, relajes ni saltes tests o checks para conseguir un CI en verde.

## Requiere revisión humana siempre
Migraciones · políticas RLS · funciones `SECURITY DEFINER` · auth · secretos y credenciales · motor de políticas · techos de autonomía · reglas de plataforma de los prompts.

## Base de datos: guardas (ADR 0003)
- Las reglas que RLS no puede expresar por columna viven en triggers `guard_*` de `packages/db`. Ejemplos: qué campos puede cambiar cada rol, `organization_id` inmutable, que nunca falte un `org_admin`.
- Esas guardas **solo actúan cuando `current_user = 'authenticated'`**. La plataforma (service role, migraciones, cascadas de `auth`) no queda bloqueada, y el código que la usa debe respetar esas reglas por su cuenta.
- Una función `SECURITY DEFINER` se ejecuta como su dueño, no como `authenticated`. Dentro de ella **no actúan ni RLS ni las guardas**. Por eso ninguna función `SECURITY DEFINER` puede escribir en tablas de tenants sin revisión humana. Los helpers de RLS en `private` son `SECURITY DEFINER`, pero solo leen.
- Las guardas son listas blancas: una columna nueva queda protegida hasta que se decida explícitamente quién puede cambiarla.
- Toda política RLS nueva empieza por `(select private.session_is_active()) AND …`. Así, una sesión cerrada, caducada, baneada o borrada no ve nada aunque su JWT siga siendo válido. Va envuelta en `(select …)` para que se evalúe una vez por consulta (InitPlan). Lo vigila un test estructural.

## Web: autenticación (apps/web)
- El acceso a datos se decide en el servidor, cerca de los datos: cada página o Server Action protegida llama a `requireUser()` (`src/lib/auth/session.ts`), que usa `getUser()` y detecta sesiones cerradas. El proxy (`getClaims()`) solo hace la redirección optimista. Nunca `getSession()` en servidor.
- El parámetro de vuelta tras el login pasa siempre por `safeNextPath()`.
- Registro público cerrado con `[auth] enable_signup = false`. No toques `[auth.email] enable_signup`: en la CLI desactiva el proveedor de email entero, también el login.

## Trabajo en paralelo (Claude Code + Codex)
Una tarea, una rama. Nunca dos agentes sobre la misma migración a la vez.
