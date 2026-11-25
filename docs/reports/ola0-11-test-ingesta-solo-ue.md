# Report ola0-11: el test de «Solo UE» de la ingesta de conocimiento falla a veces en CI

Spec: docs/specs/ola0-11-test-ingesta-solo-ue.md · Date: 2026-11-25 · Branch/PR: `task/ola0-11-test-ingesta-solo-ue` · PR: (ver el PR con el título `[M1][OPS-01] El test de «Solo UE»…`)

## Result: PASS

**Status line (for STATUS.md / scope.yaml, OPS-01):** el test de «Solo UE» de `ingest.integration.ts` espera también a que termine la entrega antes de leer la salida del worker y quita la política en un `finally`. Fallo de CI reproducido en local, arreglado en el test sin tocar producto, 10/10 en local y la suite de integración del worker (177/177) en verde.

## Causa (hipótesis de la spec, confirmada)
- `apps/worker/src/knowledge/ingest.ts:101-103`: `ingestSource` (dentro del paso `index`) deja `status = 'error'` con `finishProcessing` y devuelve `{ kind: "blocked" }`.
- `ingest.ts:160`: el aviso «la política de modelos de la organización no deja indexar la fuente» lo escribe el handler **después** de volver del paso. Después termina el workflow de entrega (`SUCCESS`).
- El test esperaba solo a `status === "error"` y leía la salida enseguida: si el sondeo (cada 250 ms) caía entre la escritura del estado y el aviso, la aserción de la línea 280 fallaba. Los tests vecinos ya esperaban también a `deliveries(id) === "SUCCESS"`.
- Arrastre: el test borraba `org_model_settings` después de sus aserciones. Al fallar antes, «Solo UE» seguía puesta, el test siguiente no podía indexar la fuente de toda la organización y agotaba los 45 s. En el log de la reproducción sale un segundo aviso «no deja indexar» para la fuente de ese test, que es la prueba de ese arrastre.

## Acceptance criteria
| Criterion | Pass/Fail | Evidence |
| --- | --- | --- |
| Fallo reproducido, con el mismo mensaje que en CI, y el mismo escenario pasando con el arreglo | Pass | Con un retraso temporal de 2 s antes del aviso en `ingest.ts` (solo en la copia de trabajo) y el test de `main`: `× con «Solo UE»…` → `AssertionError: expected false to be true` en `ingest.integration.ts:280:120`, y `× una fuente de toda la organización…` → `Error: no llegó a pasar: la de la organización queda ready` (45026 ms), `Tests 2 failed \| 5 passed (7)`. Con el mismo retraso y el test arreglado: `Tests 7 passed (7)`. |
| `git diff origin/main...HEAD -- apps/worker/src/knowledge/ingest.ts` vacío | Pass | Retraso quitado con `git checkout`; el diff da 0 líneas. |
| Ninguna aserción se quita ni se afloja | Pass | `expect(` en `main`: 28; en el head: 28. `diff` de las líneas `expect(…` de las dos versiones: idénticas. Solo cambia la condición de espera (más estricta) y la limpieza va a un `finally`. |
| Si el test 1 falla, el test 2 ya no falla por arrastre | Pass | Forzando el fallo del 1 (quitando el aviso en la copia de trabajo): `× con «Solo UE»…` (`AssertionError … ingest.integration.ts:283:122`) y `✓ una fuente de toda la organización… 765ms`, `Tests 1 failed \| 6 passed (7)`. |
| 10 de 10 en local | Pass | `run 1 rc=0 Tests 7 passed (7)` … `run 10 rc=0 Tests 7 passed (7)`. |
| Suite de integración del worker | Pass | `pnpm --filter @repo/worker test:integration`: `Test Files 22 passed (22)`, `Tests 177 passed (177)`. |
| Typecheck y lint del worker | Pass | `pnpm --filter @repo/worker typecheck` y `lint` sin errores. |
| Los 5 checks obligatorios en verde sobre el head | Ver el PR | Se comprueba en el PR antes de sacarlo de borrador. |

Entorno: sesión en la nube montada con el anexo B de `docs/reports/2026-11-24-cierre-v1.md` (Node 24.22.3, Supabase CLI 2.118.0, Docker). `pnpm db:start && pnpm db:reset && pnpm db:seed` y `pnpm turbo run build --filter=@repo/worker^...` en verde antes de las corridas.

## Files changed
- `apps/worker/src/knowledge/ingest.integration.ts`: el test de «Solo UE» espera a `status === "error"` **y** `deliveries(id) === "SUCCESS"` antes de leer la salida (como sus vecinos, con el mismo comentario), y sus aserciones van en `try` con un `finally` que borra `org_model_settings` y pone `policySet = false`.
- `docs/reports/ola0-11-test-ingesta-solo-ue.md`: este report.

## Deviations from spec (and why)
- none

## Follow-ups for the lead (max 3)
- En este archivo, los otros dos tests que leen `worker.output()` («si el texto cambia mientras se indexa» y «si los embeddings fallan») ya esperan a `SUCCESS` antes. No he buscado el patrón (leer la salida tras esperar solo al estado) en los demás `*.integration.ts` del worker, que queda fuera de alcance: si se quiere, una spec corta de barrido.
- Producto (no tocado): el aviso de «blocked» se escribe fuera del paso, después de `status = 'error'`. Es correcto (el log no tiene que ser durable), pero si algún día se quiere que la salida y el estado vayan juntos para quien lo mire, el aviso podría ir dentro del paso. No lo propongo como cambio.
