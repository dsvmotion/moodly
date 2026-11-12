# AGENTS.md — Instrucciones para agentes de código (Claude Code y Codex)

> `CLAUDE.md` tiene exactamente este mismo contenido. Si cambias uno, cambia el otro en el mismo PR.

## Qué es este proyecto
Plataforma B2B de agentes de IA que ejecutan trabajo real dentro de empresas (pymes, medianas y cadenas multi-local).
Cada empresa tiene 4 agentes integrados (`reception`, `customer`, `sales`, `admin`; ADR 0023) que conocen el negocio, aprenden con el tiempo, trabajan contra objetivos y actúan como coach.
**Prioridad máxima del producto:** memoria que aprende (cruzada entre agentes y locales), objetivos del negocio y modo coach (MANUAL §5.12 y §6).
**Fuente de verdad completa: `docs/MANUAL.md`.** Léelo antes de diseñar cualquier cosa.

## Al empezar cada sesión, lee en este orden
1. `docs/STATUS.md` — qué está hecho y verificado, en curso, bloqueado y lo próximo.
2. `docs/scope.yaml` — el registro de alcance: cada unidad y hallazgo con su hito (M0–M5), responsable, estado y evidencia (plan del piloto, MANUAL §17.0).
3. Las secciones de `docs/MANUAL.md` que afectan a la tarea.
4. Los ADRs recientes en `docs/adr/`.

Si dos documentos discrepan, manda el de mayor rango: ADR aceptado > `docs/MANUAL.md` > `docs/design/` > prototipo `apps/site/plataforma` (solo visual) > `docs/audits/` (históricas). Ver ADR 0023.

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
- [ ] El título del PR lleva el id de su unidad o hallazgo (`[M0][P-01]`, `[M3][RC7]`…) y el cuerpo dice el estado y la evidencia para su fila de `docs/scope.yaml`, que pone al día V1 después del merge: los PRs no tocan ese archivo (`docs/WORKSTREAMS.md`, regla 1).

## Stack (ver MANUAL §3.2 para el estado de cada elección)
TypeScript strict · pnpm workspaces + Turborepo · Next.js (App Router) · Tailwind + shadcn/ui · Zod · Supabase Postgres (región UE) con RLS y pgvector · migraciones SQL con Supabase CLI · Vercel AI SDK · DBOS Transact para ejecución duradera y colas sobre Postgres (ADR 0027, aceptado; sustituye a pg-boss) · worker Node always-on en contenedor · Vitest · pgTAP · Playwright · GitHub Actions.

## Estructura
Ver MANUAL §3.3. Resumen: `apps/web`, `apps/worker`, `packages/{db,domain,agent-core,skills,integrations,channels,knowledge,templates,ui,evals,config}`.

## Frontend
Estructura de referencia: Langdock, Attio y Apollo.io (MANUAL §9): barra lateral con selector de organización y de alcance (organización/región/local), búsqueda y ⌘K, navegación principal, agentes, registros, vistas guardadas, favoritos y recientes; panel principal con los 7 patrones de pantalla (P1–P7). Toda pantalla nueva encaja en uno de esos patrones y usa los componentes de `packages/ui`. Se copia la estructura, nunca la identidad visual de esas marcas.

## Toolkit de skills (`.claude/`)
Las skills, los agentes y el hook de arranque que usan las sesiones viven en `.claude/` de este repositorio, copiados de [`dsvmotion/moodly-toolkit`](https://github.com/dsvmotion/moodly-toolkit). Viajan con el clon, así que cargan también en las sesiones en la nube. Un marketplace de plugins no carga allí (comprobado el 2026-11-10 con sesiones reales).
- **Qué hay:**
  - 74 skills en `.claude/skills/`, los 4 agentes de `impeccable` en `.claude/agents/` y el hook de arranque de `superpowers` (`.claude/hooks/session-start`, registrado en `.claude/settings.json`). Ningún servidor MCP;
  - las skills traen scripts que no corren solos: solo si el agente los lanza;
  - en `.claude/toolkit/`, la licencia y el origen de cada copia, con lo que se quitó en la revisión de seguridad.
- **No se editan aquí.** Se cambian en el toolkit y se traen con su script, desde un clon del toolkit: `python3 scripts/export-claude-dir.py <ruta a este repositorio>/.claude` (antes hay que quitar `skills/`, `agents/`, `hooks/` y `toolkit/` de `.claude/`). El PR dice de qué commit del toolkit salen. `.claude/**` decide las skills, los permisos y los hooks de todas las sesiones: cada PR que lo toca lo revisa una sesión Revisora y lo autoriza producto.
- **Quién usa qué:**
  - método de trabajo, de `superpowers` (`brainstorming`, `systematic-debugging`, `test-driven-development`, `writing-plans`…): todas las líneas;
  - diseño (`impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, las de animación como `animate` o `improve-animations`, y las referencias): V2 y V3;
  - legal (las que empiezan por `privacy-legal-`, `ai-governance-legal-`, `product-legal-` y `commercial-legal-`): V1 y V3. Ayudan a preparar y a revisar; no sustituyen a la asesoría legal.
- **Referencias:** no se instalan ni se copian enteras. Se consultan con `git clone --depth 1` en una carpeta temporal fuera del repositorio, solo lectura y sin ejecutar sus scripts. El commit revisado de cada una está en el README del toolkit.
  - `VoltAgent/awesome-design-md`: solo para estudiar cómo documentan su diseño otras marcas; nunca para copiar la identidad visual de una marca.
  - `DavidHDev/react-bits`: para copiar componentes concretos a `packages/ui` cuando se necesiten, adaptados a nuestros tokens. Licencia MIT + Commons Clause: usarlos en el producto, sí; redistribuir o vender la librería, no. Cada PR que lo use anota de qué componente sale.
  - `ComposioHQ/awesome-claude-skills`: catálogo para buscar ideas. No tiene licencia en la raíz: se comprueba la de cada skill antes de copiarla.
- **Si chocan:** este archivo manda sobre cualquier skill, también sobre el texto de arranque de `superpowers`. Y cuando las skills de diseño se contradicen entre sí o con nuestro sistema, mandan `packages/ui` y `docs/design/design-review.md`.

## Comandos
> Requisitos: Node 24 LTS (`.nvmrc`; con nvm: `nvm use`) y pnpm 11 vía corepack (`corepack enable`; la versión exacta está en `packageManager` de `package.json`).
> Base de datos: Docker en marcha y Supabase CLI 2.118.0 (la misma versión que fija el CI en `.github/workflows/ci.yml`). La configuración de Supabase vive en `packages/db/supabase`.
> Todos los comandos se ejecutan desde la raíz y Turborepo los lanza en cada workspace. Para uno solo: `pnpm --filter @repo/<nombre> <script>`.
> No inventes comandos que no existan todavía; si los creas, documéntalos aquí en el mismo PR.
- Instalar: `pnpm install`
- Levantar Supabase local: `pnpm db:start` (parar: `pnpm db:stop`)
- Worker en local (DBOS, ADR 0027): `pnpm db:seed` (da login al rol `dbos_worker` del esquema `dbos`), `pnpm --filter @repo/worker env:local` (escribe `apps/worker/.env.local`, también con la API local y su clave secreta), `pnpm turbo run build --filter=@repo/worker^...` (el worker usa compilados los paquetes del monorepo de los que depende) y `pnpm --filter @repo/worker dev`
- Imagen del worker (la que construye Railway): `docker build -f apps/worker/Dockerfile .` desde la raíz
- Worker en staging (W2): servicio `worker` del proyecto `moodly-staging` de Railway (región `europe-west4-drams3a`, 1 réplica), que se despliega desde `main` cuando cambian `apps/worker/**`, el `src/**` o el `package.json` de los paquetes que usa (`db`, `agent-core`, `config`, `integrations`, `knowledge` y `skills`; si usa otro, va en la imagen, lo comprueba `apps/worker/src/dockerfile.test.ts`, y en las rutas del servicio de Railway) o el lockfile. Variables: `WORKER_SYSTEM_DATABASE_URL`, `WORKER_EXECUTOR_ID`, `WORKER_APP_VERSION`, `LOG_LEVEL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (clave secreta propia del worker; MANUAL §4.4) y `AI_GATEWAY_API_KEY` (Vercel AI Gateway, ADR 0033 §7, también para los embeddings del conocimiento, ADR 0048; sin ella, los agentes pasan cada conversación a una persona y las fuentes de conocimiento no se indexan). Rol, conexión, lock y workflow de comprobación: Actions → «Staging · worker» (`.github/workflows/staging-worker.yml`, acciones `role`, `connect`, `lease`, `smoke-enqueue` y `smoke-finish`)
- Reaplicar migraciones desde cero: `pnpm db:reset` (borra también los usuarios de Auth: vuelve a ejecutar `pnpm db:seed`)
- Seed de desarrollo (idempotente, solo contra Supabase local): `pnpm db:seed`. Genera contraseñas nuevas en cada ejecución (y el secreto TOTP de los `org_admin`, que salen con MFA activado) y las guarda solo en `packages/db/.seed/credentials.local.json` (ignorado por git). No las copies a código, logs ni al chat.
- Regenerar los tipos de la base de datos tras una migración: `pnpm db:types`
- Regenerar los iconos de la PWA (los PNG se commitean): `node apps/web/scripts/pwa-icons.ts`. Si el Chromium de Playwright no está instalado, pasa su ruta en `CHROMIUM_PATH`.
- Web en local: `pnpm db:seed` y después `pnpm --filter @repo/web env:local` (escribe `apps/web/.env.local` con la URL, la clave publicable y `LOGIN_THROTTLE_KEY`, la clave de servidor del freno del login que genera el seed) y después `pnpm --filter @repo/web dev` → http://127.0.0.1:3000
- Tests e2e (Playwright; con Supabase levantado, seed aplicado y la web compilada con `pnpm build`): `pnpm --filter @repo/web e2e`. La primera vez: `pnpm --filter @repo/web exec playwright install chromium`. Si no se puede descargar el navegador, `CHROMIUM_PATH=/ruta/al/chrome` usa uno ya instalado.
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Tests unitarios: `pnpm test`
- Registro de alcance (P-08): `pnpm test` valida `docs/scope.yaml` (`packages/config/src/docs-status`): todas las filas se leen, sin ids repetidos, estados e hitos válidos y ninguna unidad `done` sin evidencia. `pnpm docs:status` imprime por stdout el resumen por hito M0–M5 (conteos y lo abierto); `--out <archivo>` lo escribe y `--check` solo valida. El resumen no se commitea.
- Tests de base de datos (pgTAP, con Supabase levantado): `pnpm test:db`
- Tests de integración (con Supabase levantado y el seed aplicado): `tenantDb` con `pnpm --filter @repo/db test:integration`; el worker (reanudación tras SIGKILL y outbox, ADR 0009) con `pnpm turbo run build --filter=@repo/worker^...` y `pnpm --filter @repo/worker test:integration`
- Subir de versión DBOS: en el mismo PR, la versión exacta de `@dbos-inc/dbos-sdk` en `apps/worker`, una migración nueva con el SQL de `pnpm --filter @repo/worker exec dbos schema --print-migrations <primera migración nueva>` y la versión del esquema que comprueba `19_dbos_schema.test.sql`
- Lint del esquema SQL (con Supabase levantado): `pnpm db:lint`
- Tests de la guarda de mergeo (`safe-merge.sh` y `check-sensitive.sh`): `bash scripts/merge-guard/tests/run.sh`
- Tests de la Revisora automática (SE01, `scripts/reviewer/`): `pnpm exec tsc -p scripts/reviewer` y `node --test scripts/reviewer/*.test.ts`
- Tests de la comprobación de configuración del despliegue a staging (`config-drift.sh`): `bash scripts/supabase/tests/config-drift.test.sh`
- Mergeo autónomo de un PR propio: `scripts/safe-merge.sh <n>`, o el procedimiento con el conector de GitHub (ver "Mergeo autónomo")
- Evals de los agentes (MANUAL §12.4, `packages/evals`): el set de ataque y las conversaciones de prueba de Recepción y Atención al cliente corren con un modelo falso dentro de `pnpm test` (umbral del 100 %) y, en GitHub, también como check obligatorio propio, «evals · modelo falso» (`ci.yml` y `required-checks.txt`, K-01). Con el modelo real, por Vercel AI Gateway (cuesta dinero, ~0,05 € por caso con el modelo `smart`; el presupuesto lo decide producto; en GitHub, el workflow «Evals · modelo real» (`.github/workflows/evals.yml`) corre solo en `main` (push que toca `agent-core`, `skills`, `evals`, `config`, el calendario o el conocimiento) y a mano desde `main` con `case` y `repeat`, nunca en PRs (P-05), con la clave propia `AI_GATEWAY_EVALS_API_KEY` en el entorno `evals` y tope de 2 € por corrida, que el código no deja superar; todavía no es obligatorio): `AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:agents`, con `--list` (los casos, sin llamar a nadie), `--case <id>`, `--agent reception|customer`, `--repeat <n>`, `--model <clave>` (otra clave de modelo para conversar, p. ej. `fast`, para comparar) y `--max-eur <x>` (tope de la corrida, 1 € por defecto). En una sesión en la nube, la clave la inyecta el proxy: `AI_GATEWAY_API_KEY=proxy-injected-placeholder NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`. Umbrales con el modelo real: seguridad 100 %, comportamiento 90 %, y un caso de comportamiento que falla se repite hasta 3 corridas: si no acierta ninguna, bloquea aunque la tasa pase el umbral (decisión de producto, 2026-11-09). La eval de embeddings: `pnpm --filter @repo/evals eval:embeddings`
- Build: `pnpm build`
- Todo lo que corre el CI: `pnpm check` (typecheck + lint + test + build) y, con Supabase levantado, `pnpm db:lint` + `pnpm test:db`, la integración de `tenantDb` y del worker, y el e2e (`pnpm db:seed` + `pnpm --filter @repo/db test:integration` + `pnpm turbo run build --filter=@repo/worker^...` + `pnpm --filter @repo/worker test:integration` + `pnpm --filter @repo/web e2e`)
- Migraciones a staging: las aplica `.github/workflows/deploy-staging.yml` (`supabase db push`) cuando el CI termina en verde sobre `main`; a mano, desde Actions → «Despliegue a staging» → Run workflow. Ese mismo despliegue aplica la configuración de `config.toml` (con su `[remotes.staging]`) al proyecto alojado con `supabase config push`, y falla si después queda alguna diferencia (`supabase config diff`), salvo las que el propio `config push` declara que no puede aplicar, que salen como aviso (`scripts/supabase/config-drift.sh`). La web de staging la despliega Vercel desde `main`.
- Salud y alerta de staging (PL-health): la web responde `GET /health` (sin sesión ni datos de organizaciones; una lectura con la clave publicable a la API de Supabase; 200 o 503 con `{status}`) y el worker `GET /health` en el puerto `PORT` (8080 en local; `apps/worker/src/health.ts`; 200 `ok`, 200 `starting` mientras espera el lock del executor o arranca DBOS —para que Railway no pare el contenedor viejo antes de tiempo—, y 503 `degraded` si falla la base de datos de sistema o el evento del outbox sin publicar más antiguo pasa de 120 s, o `stopping`). El cuerpo lleva solo `status`; el detalle del fallo va al log del worker. En local: `curl -s localhost:8080/health` con el worker en marcha. Configuración de las plataformas: Railway, servicio `worker` → Settings → Deploy → Healthcheck Path `/health` (y, para la alerta, un dominio público del servicio); Vercel no necesita nada (la ruta es pública). La alerta es `.github/workflows/staging-health.yml` («Staging · salud», cada 15 minutos y a mano): llama a las URLs de las variables de Actions `STAGING_WEB_HEALTH_URL` y `STAGING_WORKER_HEALTH_URL` (https; la que falte no se comprueba) y abre o actualiza el issue «staging caído», que cierra cuando vuelven a responder 200 (mismo patrón que `alerta-main`).
- Despliegue ordenado a staging, esquema antes que código (PL-deploy): tras `supabase db push` y `config push` (job `migrations`), el job `code` de ese mismo workflow lanza la web (API de Vercel con el commit exacto, secreto `VERCEL_TOKEN`) y el worker (API de Railway con el commit exacto, secreto `RAILWAY_TOKEN`, token de proyecto) y espera a los dos hasta `READY` y `SUCCESS` (con el healthcheck `/health`, si está). Si las migraciones fallan, el código no se despliega. Sin esos secretos el job no hace nada y sigue el despliegue desde git de cada plataforma. Para que sea el único camino, una vez creados los secretos hay que apagar el despliegue desde git: en Railway, `watchPatterns` del servicio `worker` a una ruta que nunca cambia (p. ej. `.no-auto-deploy`; el despliegue manual por API no mira los patrones) y, en Vercel, desactivar el despliegue de `main` desde git (`git.deploymentEnabled` del proyecto), comprobando que un despliegue por API sigue funcionando. El servicio `site` de Railway no entra en este orden (no usa la base de datos).
- Prueba del agente en staging (paso 4d-3, llama al modelo de verdad): Actions → «Staging · agente» → Run workflow, con uno de sus mensajes fijos (`.github/workflows/staging-agent.yml`). Prepara la conversación de prueba con Recepción en la organización de demo, escribe el mensaje y enseña qué hizo el agente: estado, modelo, tokens, coste y ejecuciones.
- Organización de demo y primer `org_admin` de staging (R-34): la persona crea su cuenta en el panel de Supabase (Authentication → Users → Add user, con su contraseña y el email confirmado) y lanza Actions → «Staging · organización de demo» → Run workflow con ese email (`.github/workflows/staging-demo.yml`, idempotente).

## Prohibido
- Inventar credenciales, cuentas o proveedores de integración. Pídelos.
- Aplicar migraciones o DDL a mano en un proyecto alojado (conector de Supabase, SQL editor, `db push` desde tu máquina): solo el CI migra staging y producción.
- Usar la service role de Supabase en `apps/web` para datos de usuario.
- Consultas del worker sin `organization_id` explícito. El worker accede a los datos de una organización solo con `createServiceDb().forOrganization(orgId)` (`@repo/db/service`); la única lectura entre organizaciones son los metadatos del outbox (`createServiceDb().outbox`, ADR 0009), y el tenant de un evento sale de la fila, nunca del payload; fuera de `packages/db` y `apps/web` nadie importa un cliente de Supabase (regla de lint y test estructural).
- Desactivar RLS, saltarse tests o bajar umbrales de evals para que algo pase.
- Escribir el nombre de la marca a mano (usa `BRAND_NAME`) o IDs de modelo LLM en código de negocio (usa `packages/config`).
- Tomar `organization_id`, `location_id` o destinatarios de los argumentos que genera el LLM.
- Escribir en tablas de tenants desde una función `SECURITY DEFINER` sin explicarlo en el PR y sin tests en negativo (ver "Base de datos: guardas"; con datos reales, además, revisión humana).
- Mergear un PR sin cumplir el procedimiento de la sección siguiente (CI en verde sobre el commit exacto y sin tests debilitados). Poner o quitar la etiqueta `revisado-humano`.

## Mergeo autónomo de tus propios PRs
**Decisión de producto (2026-10-22; la lista corta del hito M0, 2026-11-10, se vuelve a suspender el 2026-11-11):** mientras no haya datos reales de clientes, el agente mergea sus propios PRs con el procedimiento de abajo, **también los que tocan zonas sensibles**, sin esperar la etiqueta `revisado-humano` ni una sesión Revisora (producto, 2026-11-11: «sigue sin sensitive-paths, no quiero tener que hacer esto todo el rato»). La lista activa (`scripts/merge-guard/sensitive-paths.txt`) está vacía; la lista corta de M0 está en el historial de git (`aef3d84`) y la completa en `sensitive-paths.suspended.txt`. La guarda sigue corriendo en cada PR desde la rama base (`pull_request_target`, que GitHub ejecuta siempre con el workflow de `main`), lee el PR por la API sin ejecutar su código y publica el commit status `sensitive-paths` en el head del PR: con la lista vacía solo falla si el PR debilita o borra tests. En los PRs que tocan migraciones, RLS, funciones `SECURITY DEFINER`, auth, secretos, la guarda, los workflows, `.claude/` o estas reglas, el PR explica qué cambia y cómo se probó. **Antes de meter el primer dato real de un cliente se reactiva la lista completa** (con la revisión humana y F03, el status firmado por una App propia): es condición de salida a producción en `docs/STATUS.md`.

Solo se mergea si se cumple **todo** lo siguiente. Si algo falla o hay dudas, **no mergees**: para y avisa a producto.
1. **CI en verde sobre el head commit actual:** cada check de `scripts/merge-guard/required-checks.txt` existe y su ejecución más reciente sobre ese commit exacto está en `SUCCESS`, y el commit status más reciente de cada contexto de `required-statuses.txt` (la guarda, `sensitive-paths`) publicado por `github-actions[bot]` está en `success`.
2. **Ningún test debilitado:** sin `.skip`/`.only`/`.todo`/`.fixme` añadidos, sin pgTAP sin plan, sin tests borrados y sin fallos conocidos nuevos en la línea base de las evals (`packages/evals/baseline.json`, K-01) (`scripts/merge-guard/check-sensitive.sh` sobre los archivos y el diff del PR; el job `sensitive-paths` del CI lo comprueba en cada PR).
3. **Merge fijando el commit comprobado** (squash).

Cómo:
- **Con `gh` autenticado:** `scripts/safe-merge.sh <n>`, que hace los tres pasos.
- **Sin `gh` (sesiones en la nube):** los mismos pasos con el conector de GitHub: leer los check runs y los commit statuses del head, ejecutar el `check-sensitive.sh` de `origin/main` (nunca el del PR) sobre los archivos y el diff del PR, guardados en archivos, y no mergear si el status `sensitive-paths` más reciente del head publicado por `github-actions[bot]` no está en `success` (un status lo puede publicar cualquiera con permiso de escritura; solo vale el de la guarda); después, mergear con `merge_method: squash` y `expectedHeadSha` = el commit comprobado. Nunca mergear sin `expectedHeadSha`.

Antes de mergear, publica en el PR un comentario con el resumen, la evidencia (tests ejecutados, prueba en negativo si aplica) y la lista de archivos tocados.

Después del merge: verifica `pnpm check`, `pnpm test:db` y el e2e (`pnpm db:seed` + `pnpm --filter @repo/web e2e`) sobre `main`. Si algo falla, arréglalo o revierte enseguida y avisa.

**Lo que la guarda no detecta sigue siendo tu responsabilidad:** reescribir a la baja un test existente sin borrarlo ni saltarlo (aserciones más laxas, casos eliminados). Si un PR cambia aserciones existentes, explícalo en el PR y avisa a producto antes de mergear.

**La etiqueta `revisado-humano`** la ponen y la quitan solo las personas de producto; tú nunca. Mientras la lista activa esté vacía no hace falta. El job `invalidate-review` la sigue quitando con cada commit nuevo, para cuando se reactive.

Nunca desactives, relajes ni saltes tests o checks para conseguir un CI en verde.

## Requiere revisión humana (suspendido hasta el primer dato real)
Migraciones · políticas RLS · funciones `SECURITY DEFINER` · auth · secretos y credenciales · motor de políticas · techos de autonomía · reglas de plataforma de los prompts · la guarda, los workflows y `.claude/` · `AGENTS.md` y `CLAUDE.md`. Mientras no haya datos reales de clientes, el agente las mergea con el procedimiento anterior y explica en cada PR qué cambia y cómo lo probó (producto, 2026-11-11). Se vuelve obligatoria, con la lista completa, antes del primer dato real.

## Base de datos: guardas (ADR 0003)
- Las reglas que RLS no puede expresar por columna viven en triggers `guard_*` de `packages/db`. Ejemplos: qué campos puede cambiar cada rol, `organization_id` inmutable, que nunca falte un `org_admin`.
- Esas guardas **solo actúan cuando `current_user = 'authenticated'`**. La plataforma (service role, migraciones, cascadas de `auth`) no queda bloqueada, y el código que la usa debe respetar esas reglas por su cuenta.
- Una función `SECURITY DEFINER` se ejecuta como su dueño, no como `authenticated`. Dentro de ella **no actúan ni RLS ni las guardas**. Por eso ninguna función `SECURITY DEFINER` puede escribir en tablas de tenants sin explicarlo en el PR y cubrirlo con tests en negativo (y, con datos reales, revisión humana). Los helpers de RLS en `private` son `SECURITY DEFINER`, pero solo leen.
- Las guardas son listas blancas: una columna nueva queda protegida hasta que se decida explícitamente quién puede cambiarla.
- Toda política RLS nueva empieza por `(select private.session_is_active()) AND …`. Así, una sesión cerrada, caducada, baneada o borrada no ve nada aunque su JWT siga siendo válido; tampoco una sesión aal1 (solo contraseña) de quien tiene un segundo factor verificado (`14_mfa_reads`). Va envuelta en `(select …)` para que se evalúe una vez por consulta (InitPlan). Lo vigila un test estructural.
- Toda política de escritura (INSERT/UPDATE/DELETE) que admite a un `org_admin` o al equipo interno exige además `(select private.session_is_aal2())`: administrar pide el segundo factor (MFA). Lo vigila un test estructural (`13_admin_mfa`). En pgTAP, los `org_admin` actúan con `pg_temp.login_mfa()`/`act_as_mfa()`.

## Web: autenticación (apps/web)
- El acceso a datos se decide en el servidor, cerca de los datos: cada página o Server Action protegida llama a `requireUser()` (`src/lib/auth/session.ts`), que usa `getUser()` y detecta sesiones cerradas. El proxy (`getClaims()`) solo hace la redirección optimista. Nunca `getSession()` en servidor.
- El parámetro de vuelta tras el login pasa siempre por `safeNextPath()`.
- MFA: quien tiene un segundo factor verificado no pasa de `requireUser()` hasta completar `/login/mfa` (sesión aal2). Los códigos fallidos cuentan en el mismo freno que las contraseñas. Supabase Auth cierra las sesiones aal1 de una persona cuando verifica su factor en otra sesión: en los e2e, el tramo «contraseña → código» de un mismo usuario va dentro de `withMfaLock()` (`e2e/helpers.ts`).
- Logs (ADR 0032): en servidor, `logger` y `securityEvent()` de `src/lib/observability/logger.ts`, nunca `console.*`. Nunca emails, IPs, tokens ni contraseñas en claro (la censura y los seudónimos son la red, no la excusa). Toda acción que cambie permisos, accesos o datos de una organización emite su evento.
- Registro público cerrado con `[auth] enable_signup = false`. No toques `[auth.email] enable_signup`: en la CLI desactiva el proveedor de email entero, también el login.

## Trabajo en paralelo (Claude Code + Codex)
Una tarea, una rama. Nunca dos agentes sobre la misma migración a la vez.
