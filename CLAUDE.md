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
- Mergear tu propio PR, salvo con el mergeo autónomo permitido (siguiente sección) y cumpliendo todas sus condiciones.

## Mergeo autónomo de tus propios PRs
Permitido **solo si se cumplen TODAS** estas condiciones. Si falla cualquiera, o tienes cualquier duda, **no mergees**: para y pide revisión humana.

1. **CI en verde en todos los jobs.** `gh pr checks <n> --watch --fail-fast` termina con código 0, y en la lista aparecen y pasan todos los jobs del CI (hoy: `typecheck · lint · test · build`, `db · migraciones · pgTAP` y `e2e · Playwright por rol`). Si falta alguno, se ha saltado o sigue pendiente, no está en verde.
2. **El PR no toca ninguna zona sensible.** Se comprueba con la lista completa de archivos del PR (`gh pr diff <n> --name-only`). Son sensibles:
   - Migraciones y rollbacks: `packages/db/supabase/migrations/**` y `packages/db/supabase/rollbacks/**`.
   - Cualquier SQL que defina o cambie políticas RLS, funciones SQL o funciones `SECURITY DEFINER`, esté donde esté.
   - Autenticación y sesión: `apps/web/src/proxy.ts`, `apps/web/src/lib/auth/**`, `apps/web/src/lib/supabase/**`, `apps/web/src/app/login/**`, el logout (`apps/web/src/app/app/actions.ts`) y cualquier código de redirecciones tras el login.
   - Secretos, credenciales y variables de entorno: `**/.env*`, `apps/web/scripts/local-env.ts` y el seed (`packages/db/src/seed/**`, que usa la clave secreta local).
   - Motor de políticas y techos de autonomía de los agentes (MANUAL §5.4 y §5.6), cuando existan.
   - CI: `.github/workflows/**`.
   - Configuración de tests, checks o umbrales: `**/vitest.config.*`, `**/playwright.config.*`, `**/eslint.config.*`, `**/tsconfig*.json`, `turbo.json`, el `config.toml` de pgTAP/Supabase y cualquier umbral de evals.
   - Tests debilitados: borrar o reescribir a la baja tests existentes, o añadir `.skip`/`.only`/`todo`.
   - Reglas del repo: `AGENTS.md` y `CLAUDE.md`.
   - Supabase: `packages/db/supabase/config.toml`.
   - Dependencias: añadir, quitar o actualizar dependencias. Cualquier cambio en `package.json` (dependencias o scripts), `pnpm-lock.yaml` o `pnpm-workspace.yaml`.
3. **Comentario previo en el PR.** Antes de mergear, publica un comentario con:
   - el resumen del cambio;
   - la evidencia (tests y CI);
   - la lista completa de archivos tocados;
   - la confirmación explícita de que ninguno está en la lista del punto 2.

Si se cumplen las tres, mergea fijando el commit revisado:

```
gh pr merge <n> --squash --delete-branch --match-head-commit <SHA del head con el CI en verde>
```

Después: `git checkout main && git pull`, y verifica que todo pasa sobre `main`: `pnpm check`, `pnpm test:db` y el e2e (`pnpm db:seed` + `pnpm --filter @repo/web e2e`). Si algo falla sobre `main`, avisa enseguida.

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
