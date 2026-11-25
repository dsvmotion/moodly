# Report ola0-10: la integración del worker en CI en la mitad de tiempo (#293)

Spec: docs/specs/ola0-10-ops01-integracion-293.md · Date: 2026-11-25 · Branch/PR: `claude/eloquent-fermi-mhq4p5` / #293

## Result: PASS (local). El CI sobre el head final se lo pasa el worker al Lead en su mensaje.

**Línea de estado (para `docs/STATUS.md`, la pone el Lead):**
- **`[M1][OPS-01]` Integración del worker más rápida (#293):** los workers de prueba programan el publicador del outbox cada segundo (en producción, cada 5 s) y el barrido de la entrada cada 5 s (en producción, cada minuto), con `schedulesTesting` de `createWorker` (solo tests; producción no cambia). La espera fija de 65 s de `ingress.integration.ts` pasa a contar dos barridos completos en `dbos.workflow_status`. Ninguna aserción cambia. Verificado en local sobre `main` `fd6bfea`: 1050 s → 551 s y 575 s (177/177), prueba en negativo y `pnpm check` 52/52.

## Acceptance criteria
| Criterion | Pass/Fail | Evidence (command output, test name, file) |
| --- | --- | --- |
| `git diff origin/main...HEAD -- docs/STATUS.md` vacío | Pass | 0 líneas. En el merge se tomó la versión de `main` entera (`git checkout --theirs`). |
| Fuera de `testing/` y de los tests, los tiempos por defecto son los de `main` | Pass | `PUBLISH_SCHEDULE` (`*/5 * * * * *`) y `SWEEP_SCHEDULE` (`23 * * * * *`) sin cambios; los parámetros nuevos de `startOutbox`/`startIngestQueue` valen eso por defecto. `main.ts` no pasa `schedulesTesting` (solo lo usan `src/testing/*-worker.ts`, fuera de la imagen por `tsconfig.build.json`). Lo comprobó también el reviewer. |
| `pnpm --filter @repo/worker test:integration` verde, con duración antes/después | Pass | Antes (`origin/main` `fd6bfea`, worktree aparte): **1050 s**, 177/177. Después: **551 s** y **575 s**, 177/177 (dos corridas). Por archivo, abajo. |
| Prueba en negativo: con un solo barrido contado, el test falla | Pass | Ver «Prueba en negativo». |
| Los 5 checks obligatorios en verde sobre el head; duración del e2e | Pendiente | Se comprueba tras el push; el resultado y la duración de `e2e · Playwright por rol` van en el mensaje al Lead. |
| Ninguna aserción existente cambiada | Pass | `check-sensitive.sh` de `origin/main` sobre los archivos y el diff del PR: salida 0. Sin `.skip/.only/.todo/.fixme` añadidos. Los dos ajustes de la espera nueva (abajo) son cotas de espera, no aserciones. |

### Por archivo (reporter JSON, segundos)
| Archivo | Antes | Después |
| --- | ---: | ---: |
| `ingress/ingress.integration.ts` | 269.3 | 66.8 |
| `agents/converse.integration.ts` | 250.2 | 100.3 |
| `reminders/reminders.integration.ts` | 138.0 | 116.0 |
| `waitlist/offers.integration.ts` | 110.2 | 59.7 |
| `knowledge/ingest.integration.ts` | 58.1 | 24.1 |
| `notifications/approval-email.integration.ts` | 39.9 | 30.3 |
| `outbox-backfill.integration.ts` (nuevo desde el 13-11) | 25.1 | 20.9 |
| `outbox.integration.ts` | 24.9 | 22.5 |
| `ingress/one-reply.integration.ts` (nuevo desde el 13-11) | 22.3 | 19.3 |
| resto (13 archivos) | 19.9 | 21.0 |

### Prueba en negativo
Fallo inyectado a mano en `ingest.ts` (no commiteado; se revirtió con `git checkout` y la diff de `ingest.ts` frente al head quedó vacía): el barrido vuelve a «rebobinar» un workflow que ya terminó en dead_letter, **solo la segunda vez que lo ve**.
- Con la espera del PR (dos barridos contados): el test falla.
  `× y si sigue fallando después de rebobinar, … dead_letter con 5 intentos y un solo rebobinado` · `AssertionError: expected [ …(2) ] to have a length of 1 but got 2` · `Tests 1 failed | 21 passed (22)`.
- Con la espera cambiada a mano a **un solo barrido contado** y el mismo fallo: el test pasa las dos veces (`Tests 22 passed (22)` ×2), es decir, no ve el fallo. Por eso se cuentan dos.
- Con el código real y la espera de dos barridos: `Tests 22 passed (22)`.

### Otras comprobaciones
- `pnpm --filter @repo/worker test`: 33 archivos, 355 tests en verde. `pnpm check`: `Tasks: 52 successful, 52 total`.
- Entorno: Supabase CLI 2.118.0, Node 24.22.3, `pnpm db:reset` + `pnpm db:seed`, `pnpm turbo run build --filter=@repo/worker^...`.
- Reviewer (opus): **PASS**. Tres notas de severidad baja; dos aplicadas (abajo). La tercera, que un worker de test apuntado a la base de sistema de staging dejaría sus programaciones hasta el siguiente arranque, no pide cambio: los workers de test solo usan las URLs locales y no van en la imagen.

## Files changed
- Merge de `origin/main` (`c971ff2`), con tres conflictos: `docs/STATUS.md` (la versión de `main` entera), `apps/worker/src/worker.ts` (`startBackfills` de `main` más las programaciones de prueba) y `apps/worker/src/testing/ingress-worker.ts` (`channels.send` de `main` más el barrido cada 5 s).
- `apps/worker/src/testing/backfill-worker.ts`, `one-reply-worker.ts`: el publicador cada segundo, como el resto de workers de test (entraron después del 13-11).
- `apps/worker/src/ingress/ingress.integration.ts`: la espera nueva con cota de 50 s en vez de 150 s y un segundo antes de leer el log del worker.
- `docs/reports/ola0-10-ops01-integracion.md` (este archivo).
- Sin cambios respecto a #293: `events/outbox.ts`, `ingress/ingest.ts` y los otros workers de test.

## Deviations from spec (and why)
- Dos ajustes a la espera nueva de `ingress.integration.ts`, por la revisión. Ninguna aserción cambia:
  - La cota pasa de 150 s a 50 s. Antes, 100 s + 45 s + 150 s superaban el límite del test (200 s), y el fallo habría salido por el timeout de vitest en vez de por «pasan dos barridos más». Con el barrido cada 5 s, dos vueltas tardan unos 10 s.
  - Hay un segundo de espera antes de leer `output`, para que el log del segundo barrido llegue entero por el pipe.
- `outbox-worker.ts` y `three-steps-worker.ts` siguen con los tiempos de producción. Existían antes del 13-11 y #293 los dejó así a propósito; la spec solo pide el modo rápido para los workers nuevos.
- Los tiempos absolutos de esta máquina son más altos que los del cuerpo de #293 (840 s → 408 s), porque `main` tiene ahora 177 tests y no 108. La proporción se mantiene: −45 %.

## Follow-ups for the lead (max 3)
- El cuerpo del PR #293 aún tiene las cifras del 13-11. Las nuevas son 1050 s → 551/575 s y 177 tests. No lo he editado: la tabla está en este report.
- Lo más lento del worker ahora: `reminders` (116 s, sigue el reloj de la cita) y `converse` (100 s). Acortar `reminders` obligaría a cambiar los márgenes del escenario, es decir, el test: es una decisión aparte.
