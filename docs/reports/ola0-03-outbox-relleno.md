# Report ola0-03: relleno del outbox, seguimiento (#334) y sus dos notas menores

Spec: docs/specs/ola0-03-outbox-relleno-334.md · Date: 2026-11-25 · Branch/PR: `claude/w3-backfill-followup` / #334

## Result: PASS (local). El CI sobre el head final se lo pasa el worker al Lead en su mensaje.

**Línea de estado (para `docs/STATUS.md`, la pone el Lead):**
- **`[M1][W3]` Relleno del outbox, seguimiento (#334):** un relleno que terminó en `ERROR` se relanza (hasta 3 intentos) con la ventana `since` del primer intento; un solo criterio de estados con la entrada de canales (`workflow-status.ts`: solo `ERROR` se reintenta; `CANCELLED` y `MAX_RECOVERY_ATTEMPTS_EXCEEDED` se aparcan). Nuevo: `/health` del worker responde 503 `degraded` mientras un relleno siga en `MAX_RECOVERY_ATTEMPTS_EXCEEDED` (lo ve la alerta de staging) y vuelve a `ok` al reanudarlo, sin reiniciar; `warn` si un reintento no puede leer el `since` del intento 1; runbook `docs/runbooks/outbox-relleno-aparcado.md`. Verificado en local: unitarios 360/360, integración del worker con el rol real 177/177, pruebas en negativo. Aserción cambiada a propósito («MAX_RECOVERY se reintenta» → «se aparca»), con el visto bueno de Diego (2026-11-25).

## Acceptance criteria
| Criterion | Pass/Fail | Evidence (command output, test name, file) |
| --- | --- | --- |
| `pnpm --filter @repo/worker test` verde | Pass | `Test Files 33 passed (33)`, `Tests 360 passed (360)`. `typecheck` y `lint` limpios. |
| `outbox-backfill.integration.ts` verde con el rol real | Pass | Con el head final: `Tests 1 passed (1)`, 36 s. La integración entera del worker (`pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker test:integration`, Supabase local + `pnpm db:seed`, rol `moodly_worker`): `Test Files 22 passed (22)`, `Tests 177 passed (177)`, 526 s. Esa corrida es del commit anterior al último ajuste del reviewer (que solo toca `countParkedBackfills`); el archivo del relleno se volvió a correr después. |
| Prueba en negativo: con `MAX_BACKFILL_ATTEMPTS = 1` o sin reutilizar el `since`, el test falla | Pass | `MAX_BACKFILL_ATTEMPTS = 1`: `no llegó a pasar: el segundo intento termina y lo dice`. Sin el `since` del primero: `expected '2026-11-24T19:03:27.811Z' to be '2026-11-24T19:03:16.461Z'`. Además: sin el `warn` nuevo falla `toContain('backfill: no se pudo leer el since…')`, y sin vigilar el aparcado falla `expected { status: 200, … } to deeply equal { status: 503, … }`. Código restaurado después de cada una. |
| Si se toca `/health`: test de `degraded` con un relleno aparcado | Pass | Unitarios en `health.test.ts` (aparcado → 503 `degraded` y `checks.backfill: "fail"`; sin aparcados → 200; lectura fallida → 503) y `events.test.ts` (`countParkedBackfills` relee el estado cada vez; `ERROR` y `CANCELLED` no cuentan). Integración: con el relleno en `MAX_RECOVERY_ATTEMPTS_EXCEEDED`, el `/health` real del worker de prueba responde `503 {"status":"degraded"}` y el log lleva `salud del worker degradada`; tras `DBOSClient.resumeWorkflow` termina en `SUCCESS`, `/health` vuelve a `200 {"status":"ok"}` y ninguna ejecución se repite. Los RED se vieron antes de implementar. |
| Diego avisado de la aserción cambiada antes del merge | Pass | Visto bueno de Diego del 2026-11-25 (lo trae el Lead). `git diff origin/main...HEAD` en los tests: la única aserción existente que cambia es esa (`nextBackfillAttempt(["MAX_RECOVERY_ATTEMPTS_EXCEEDED", …])` pasa de `2` a `null`); el resto son casos añadidos. `check-sensitive.sh` de `origin/main` sobre los archivos y el diff del PR: salida 0. |

### Nota (a) y la alerta de staging
- Hecha la opción preferida, con un ajuste del reviewer: solo `MAX_RECOVERY_ATTEMPTS_EXCEEDED` pone `/health` en `degraded`. Un `CANCELLED` lo decidió una persona y, si contara, la alerta no se cerraría sin rellenar lo que no se quiso (no se puede «desaparcar» sin correrlo). Sigue sin reintentarse y deja su línea en el log de cada arranque. `MAX_RECOVERY` sí se desaparca: `dbos workflow resume <id>` (DBOS `resumeWorkflows` lo pasa a `ENQUEUED`), y `/health` vuelve solo a `ok`.
- **Hoy en staging no hay nada aparcado:** en los logs del servicio `worker` de Railway (lectura, filtro `backfill`, desde el 1 de noviembre) solo hay un relleno, `agent.approval`/`approval.decided`, `backfill: 0 eventos encolados` (2026-11-24 20:29 UTC), sin ningún `aparcado` ni `falló`. Con este cambio no salta la alerta.
- Lo que sigue solo en el log: un relleno con tres `ERROR` (`agotó sus intentos`; DBOS no reanuda un `ERROR`) y un `CANCELLED`. Lo dice el runbook.

## Files changed
- `apps/worker/src/events/outbox.ts`: `countParkedBackfills`, el último intento de cada par queda vigilado, `parkedBackfills()` y el `warn` sin `since` del intento 1.
- `apps/worker/src/health.ts`: probe opcional `parkedBackfills`; con él, `checks.backfill` y `detail.parkedBackfills`.
- `apps/worker/src/worker.ts`: cablea `parkedBackfills` en el probe (3 líneas).
- `apps/worker/src/health.test.ts`, `apps/worker/src/events/events.test.ts`: tests nuevos.
- `apps/worker/src/outbox-backfill.integration.ts`, `apps/worker/src/testing/backfill-worker.ts`: `/health` real con `HEALTH_PORT` (solo el proceso de prueba), reanudación y tercer intento sin `since`. La programación del publicador de prueba no cambia.
- `docs/runbooks/outbox-relleno-aparcado.md`: cómo verlo y reanudarlo.
- De antes en el PR (sin tocar en esta vuelta): `apps/worker/src/workflow-status.ts`, `apps/worker/src/ingress/ingest.ts`.

## Deviations from spec (and why)
- `apps/worker/src/worker.ts` y `apps/worker/src/testing/backfill-worker.ts` no están en «Touch only these»: el probe de `/health` se construye en `worker.ts` y, sin el servidor de salud en el proceso de prueba, la integración no puede ver el `degraded` de verdad. Cambios mínimos.
- Nota (a) con `CANCELLED` fuera de `/health` (arriba, y lo pidió el reviewer).
- Hecho también el runbook (la spec lo daba como alternativa; con la alerta hace falta saber qué hacer).

## Follow-ups for the lead (max 3)
- Reviewer: un único hallazgo medio (el `CANCELLED`), arreglado. Quedan menores sin tocar: un `import` a media hoja en `ingress/ingest.ts:65` (fuera de mi lista); un tope de 3 s de la consulta a DBOS que salta sale como `backfill: fail`, igual que un aparcado (el runbook lo distingue por `parkedBackfills`); y el test de reanudación reanuda un relleno que ya había terminado, no uno a medias.
- Local con Node 22 (el repo pide 24); el CI corre con 24.
