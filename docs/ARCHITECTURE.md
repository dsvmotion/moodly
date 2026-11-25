# Arquitectura (≤150 líneas; generada del código a 2026-11-24, main `aa79e63`; la mantiene el lead)

Fuente de verdad del diseño: `docs/MANUAL.md` y los ADRs de `docs/adr/` (rango: ADR aceptado > MANUAL > docs/design > prototipo > audits; ADR 0023).
Este archivo es solo el mapa para no explorar a ciegas.

## Stack
- TypeScript strict · pnpm 11 workspaces + Turborepo · Node 24 (`.nvmrc`).
- Web: Next.js 16 (App Router) · Tailwind + shadcn/ui (`packages/ui`) · Zod · Supabase Auth (MFA aal2 para administrar).
- Datos: Supabase Postgres (UE) con RLS en todo, pgvector, migraciones SQL con Supabase CLI 2.118.0, guardas `guard_*` (ADR 0003).
- Worker: Node always-on en Docker (Railway, `europe-west4`), DBOS Transact para ejecución duradera y colas sobre Postgres (ADR 0027).
- Modelos: Vercel AI SDK por Vercel AI Gateway (ADR 0033, 0051: inferencia global bajo DPA); IDs de modelo solo en `packages/config`.
- Integraciones: Nango (ADR 0053) para OAuth (Google/Outlook); nativas con clave del cliente (Koibox) selladas con KMS (ADR 0034, 0055).
- Tests: Vitest · pgTAP · Playwright · evals propias (`packages/evals`). CI: GitHub Actions.

## Mapa de carpetas (una línea cada una)
- `apps/web/`: la app (Next.js). `src/app/app/*` pantallas: inbox, approvals, calendar, agents, knowledge, contacts, goals, tasks, coach, memory, analytics, activity, settings. `src/app/login` (+MFA), `src/app/health`.
- `apps/web/src/lib/auth/session.ts`: `requireUser()`; todo acceso a datos se decide en servidor. Logs: `src/lib/observability/logger.ts`.
- `apps/worker/`: el worker. `src/main.ts` arranque (config estricta, lease de executor, DBOS), `src/worker.ts` composición.
- `apps/worker/src/agents/`: el turno del agente (`converse.ts`, `prepare`), router de modelos, aprobaciones (`approvals.ts`), resumen continuo.
- `apps/worker/src/ingress/`: entrada de canales (webhook firmado → `inbound_events` → `ingest.ts`), «una sola respuesta» (`one-reply`).
- `apps/worker/src/channels/`: envío por canal (WhatsApp Cloud API, chat web).
- `apps/worker/src/events/`: outbox `domain_events` → workflows DBOS por consumidor (ADR 0009), relleno de consumidores tardíos.
- `apps/worker/src/integrations/`: Nango webhook, calendario (busy de Google/Outlook), Koibox, alta de claves (`key-submission.ts`).
- `apps/worker/src/secrets/`: SecretVault y claves de ingreso con AWS KMS (`kms.ts`) o par local en dev.
- `apps/worker/src/{reminders,waitlist,booking,knowledge,notifications,usage}/`: recordatorios, lista de espera, reservas, ingesta de conocimiento, avisos por email (Resend), libro de consumo y topes.
- `apps/worker/src/health.ts`: `GET /health` (ok/starting/degraded/stopping).
- `apps/site/`: web pública (moodlycrm.com, Railway `site`); estados de cada función salen de `docs/scope.yaml` al compilar. `apps/site/plataforma`: prototipo (solo visual).
- `packages/db/`: `supabase/` (config.toml, `migrations/`, `rollbacks/`, `tests/database/*.test.sql` pgTAP), `src/tenant-db.ts` (cliente RLS de la web), `src/service.ts` (`createServiceDb().forOrganization(orgId)` del worker), seed.
- `packages/agent-core/`: runtime del agente, motor de políticas y aprobaciones, skills, modelos (`models/`).
- `packages/skills/`: las skills de los agentes (find_slots, book_appointment, search_knowledge, request_human…).
- `packages/channels/`: contrato de canal, mensaje normalizado, estados de entrega.
- `packages/integrations/`: catálogo de plataforma (Nango), lectores de calendario, Koibox, `key-ingress/sealed-key.ts` (sobre sellado).
- `packages/knowledge/`: fuentes, chunking, embeddings, `KnowledgeRetriever`.
- `packages/domain/`: tipos y reglas de dominio compartidas.
- `packages/config/`: config tipada (modelos, BRAND_NAME, TTLs), `docs-status` (valida `docs/scope.yaml`).
- `packages/evals/`: set de ataque y conversaciones de prueba (modelo falso en `pnpm test`; real con `eval:agents`), `baseline.json`.
- `packages/templates/`, `packages/ui/`: plantillas de mensajes y componentes de UI.
- `scripts/merge-guard/`: guarda de mergeo (`check-sensitive.sh`, listas), `scripts/safe-merge.sh`, `scripts/supabase/`, `scripts/deploy/`.
- `.github/workflows/`: `ci.yml`, `deploy-staging.yml`, `staging-*.yml` (salud, agente, worker, WhatsApp, demo), `evals.yml`, `sensitive-paths.yml`, `revisora.yml`.
- `docs/`: MANUAL, STATUS, PLAN, scope.yaml (registro M0–M5), WORKSTREAMS (histórico), adr/, design/, runbooks/, specs/, reports/, prompts/, audits/ (histórico).
- `.claude/`: skills, agentes y hooks de las sesiones (toolkit `dsvmotion/moodly-toolkit` + kit de flujo de trabajo).

## Flujos principales
1. **Mensaje entrante → respuesta.** Webhook del canal (firma verificada) → `inbound_events` → la cuenta de canal da la organización (nunca el payload) → workflow DBOS del turno → `converse` (prompt por capas + skills con política) → respuesta autónoma o borrador en `approvals` → envío por el canal y estado de entrega. Un mensaje nuevo a mitad de turno releva al anterior: una sola respuesta.
2. **Aprobaciones.** Lo que la política no deja autónomo queda en `approvals`; el equipo aprueba/edita/rechaza en `/app/approvals` (aal2 para admin); aprobar ejecuta la acción con el mismo hash.
3. **Outbox.** Cambios de dominio escriben `domain_events` en la misma transacción; el worker los publica a workflows por consumidor; un consumidor nuevo rellena eventos anteriores (24 h, solo `agent.approval`).
4. **Integraciones.** OAuth por Nango (webhook `/webhooks/nango` → `integrations`); claves de cliente: la web sella con la pública de ingreso → `integration_secret_submissions` (solo inserción, 5/15 min) → el worker abre con KMS, verifica con el proveedor, re-sella con SecretVault, borra el envío; caduca a los 15 min desde `created_at`.
5. **Acceso a datos.** Web: cliente de Supabase con la sesión del usuario (RLS + guardas). Worker: rol `moodly_worker` bajo RLS con `set_config('moodly.organization_id')` por transacción y `organization_id` explícito en cada consulta (test estructural `tenant-sql-org`). Service role solo en la plataforma.
6. **Despliegue.** CI verde en `main` → `deploy-staging.yml`: migraciones (`db push` + `config push`) → web (Vercel) y worker (Railway) con el commit exacto. Producción: no existe aún.

## Comandos (todos desde la raíz; detalle en CLAUDE.md → Comandos)
- Instalar: `pnpm install` · Supabase local: `pnpm db:start` · seed: `pnpm db:seed` · reset: `pnpm db:reset` · tipos: `pnpm db:types`
- Run web: `pnpm --filter @repo/web env:local && pnpm --filter @repo/web dev` (http://127.0.0.1:3000)
- Run worker: `pnpm --filter @repo/worker env:local && pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker dev`
- Test: `pnpm test` · pgTAP: `pnpm test:db` · integración: `pnpm --filter @repo/db test:integration`, `pnpm --filter @repo/worker test:integration` · e2e: `pnpm --filter @repo/web e2e`
- Typecheck / lint: `pnpm typecheck` · `pnpm lint` · `pnpm db:lint`
- Build: `pnpm build` · todo el CI rápido: `pnpm check`
- Evals con modelo real: `pnpm --filter @repo/evals eval:agents` (cuesta dinero; ver CLAUDE.md)
- Registro de alcance: `pnpm docs:status`

## Convenciones
- Ninguna consulta del worker sin `organization_id` explícito; el tenant sale de la fila o del runtime, nunca del LLM ni del payload.
- Toda política RLS empieza por `(select private.session_is_active())`; escrituras de admin exigen `session_is_aal2()`.
- `SECURITY DEFINER` que escribe en tablas de tenants: explicado en el PR y con tests en negativo.
- Migraciones con rollback en `packages/db/supabase/rollbacks/`; timestamp siempre posterior a la última de `main`.
- pgTAP numerados `NN_nombre.test.sql`: el número no se repite.
- Integraciones con terceros: solo «verificado» tras prueba real en staging; si no, «construido, sin verificar en real».
- PR: título `[Mx][ID] …`; `docs/scope.yaml` lo actualiza el lead; merge squash con el commit comprobado y CI verde sobre él.
