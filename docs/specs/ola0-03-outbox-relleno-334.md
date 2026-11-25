# ola0-03: relleno del outbox, seguimiento (#334) y sus dos notas menores

Phase / wave: Ola 0 · M1 (W3, ADR 0009)
Model: Sonnet · Effort: Medium
Can run in parallel with: preparación de ola0-01/02/04; merge en serie.

## Goal
Mergear #334 (V8): la ventana `since` del primer intento se mantiene en los reintentos y un solo criterio de estados con la entrada de canales (solo `ERROR` se reintenta; `CANCELLED` y `MAX_RECOVERY` se aparcan), más las dos notas bajas de V10.

## Estado al cierre (2026-11-24)
- Rama `claude/w3-backfill-followup`, head `8799dd4`, borrador. CI verde. V10 OK. Integración del worker con el rol real 143/143.
- **Aserción cambiada a propósito:** un test unitario pasa de «MAX_RECOVERY se reintenta» a «se aparca» (mismo criterio que `ingest`). V10: no rebaja nada. Hay que contárselo a Diego antes del merge (CLAUDE.md).

## Read only these
- docs/specs/ola0-00-como-mergear.md
- apps/worker/src/workflow-status.ts, apps/worker/src/events/outbox.ts, apps/worker/src/health.ts

## Touch only these
- apps/worker/src/events/outbox.ts, apps/worker/src/health.ts (si se elige la opción a), sus tests, docs/runbooks (si se elige la nota)

## Steps
1. `git merge origin/main` en la rama (sin rebase).
2. Nota (a) de V10: lo aparcado hoy solo deja un `log.error` en cada arranque. Preferido: `/health` devuelve `degraded` mientras haya un relleno aparcado (así lo ve la alerta de staging), con test; alternativa mínima: una línea en el runbook que diga cómo verlo.
3. Nota (b): un `warn` si no se puede leer el `since` del intento 1.
4. Un push; reviewer; merge según ola0-00 tras el visto bueno de Diego a la aserción cambiada.

## Acceptance criteria
- [ ] `pnpm --filter @repo/worker test` verde; `outbox-backfill.integration.ts` verde con el rol real.
- [ ] Prueba en negativo: con `MAX_BACKFILL_ATTEMPTS = 1` o sin reutilizar el `since`, el test falla.
- [ ] Si se toca `/health`: test de `degraded` con un relleno aparcado.
- [ ] Diego avisado de la aserción cambiada antes del merge.

## Verify commands
```
pnpm --filter @repo/worker test
pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker test:integration
```

## Revisión del agente reviewer
- Sí, ligera: que un reintento no entregue dos veces (mismo `deliveryWorkflowId`) y que nada se pierda sin traza.
