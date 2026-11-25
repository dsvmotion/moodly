# ola0-11: el test de «Solo UE» de la ingesta de conocimiento falla a veces en CI

Phase / wave: Ola 0 · M1 (arreglo de un test que puso `main` en rojo)
Model: Opus · Effort: High
Skills: `systematic-debugging`, `test-driven-development`
Reviewer required: yes (test de integración del worker; que no se relaje ninguna aserción)
Can run in parallel with: `ola0-03` (#334) y `ola0-05` (docs). No comparte archivos con ninguna.

## Goal
Que `apps/worker/src/knowledge/ingest.integration.ts` deje de fallar de forma intermitente: el 2026-11-25 puso en rojo el CI de `main` sobre `677a813` (#341, un merge que solo tocaba docs y `.claude/`), con el commit anterior y el siguiente en verde con el mismo código del worker.

## Lo que se sabe (corrida 45672204038, job `e2e · Playwright por rol`, paso `pnpm --filter @repo/worker test:integration`)
- Fallaron 2 de 177 tests, los dos en ese archivo:
  1. «con «Solo UE», el texto no sale hacia el proveedor…» (empieza en la línea 272): `AssertionError: expected false to be true` en la línea 280, la aserción que busca en la salida del worker la línea «la política de modelos de la organización no deja indexar la fuente».
  2. «una fuente de toda la organización se indexa sin local…» (línea 294): `no llegó a pasar: la de la organización queda ready`, a los 45 s.
- El log del worker **sí** tiene esa línea para la fuente del test 1. El comportamiento es correcto; lo que falla es cuándo mira el test.
- **Hipótesis (sin confirmar):** el worker deja `status = 'error'` dentro del paso y escribe el aviso justo después. El test 1 espera solo a `status === "error"` y lee la salida enseguida; los tests vecinos (líneas 249–253 y 263–265) esperan además a que la entrega termine (`deliveries(id) === "SUCCESS"`), con un comentario que explica por qué. El test 1 no.
- **Cascada:** el test 1 borra la fila de `org_model_settings` después de sus aserciones. Al fallar antes, la política «Solo UE» se queda puesta y el test 2 no puede indexar.

## Read only these
- docs/ARCHITECTURE.md
- apps/worker/src/knowledge/ingest.integration.ts (el archivo entero: helpers `waitFor`, `status`, `deliveries`, `source`, y el `afterAll`/`afterEach` que usa `policySet`)
- apps/worker/src/knowledge/ingest.ts (solo dónde se escribe el estado y dónde el aviso)

## Touch only these (create / edit)
- apps/worker/src/knowledge/ingest.integration.ts
- docs/reports/ola0-11-test-ingesta-solo-ue.md

## Steps (checkpoint after each)
1. Confirma o descarta la hipótesis leyendo el código: en qué orden deja el worker el estado y el aviso, y qué garantiza que el aviso ya esté en la salida. Si la causa es otra, escríbela y arregla esa.
2. Reproduce el fallo antes de arreglar: una forma de forzar la ventana (por ejemplo, un retraso temporal antes del aviso en `ingest.ts`, solo en tu copia de trabajo y sin commitearlo) con la que el test falle igual que en CI. Guarda la salida.
3. Arregla el test, no el producto: que espere lo mismo que sus vecinos antes de leer la salida, y que la limpieza de `org_model_settings` ocurra aunque el test falle (`try/finally` o el gancho que ya exista).
4. Con el retraso del paso 2 puesto, el test arreglado pasa. Quita el retraso. Corre el archivo 10 veces seguidas.
5. `reviewer` (model "opus"). Un push con el report. CI verde. PR fuera de borrador.

## Acceptance criteria (checkable)
- [ ] El report enseña el fallo reproducido (mismo mensaje que en CI) y el mismo escenario pasando con el arreglo.
- [ ] `git diff origin/main...HEAD -- apps/worker/src/knowledge/ingest.ts` vacío: no cambia código de producto.
- [ ] Ninguna aserción existente se quita ni se afloja: las líneas `expect(` del archivo son las mismas o más.
- [ ] Si el test 1 falla, el test 2 ya no falla por arrastre (enséñalo forzando un fallo del 1).
- [ ] El archivo pasa 10 de 10 veces en local; los 5 checks obligatorios en verde sobre el head.

## Verify commands
```
pnpm db:start && pnpm db:reset && pnpm db:seed
pnpm turbo run build --filter=@repo/worker^...
for i in $(seq 10); do pnpm --filter @repo/worker exec vitest run --config vitest.integration.config.ts src/knowledge/ingest.integration.ts || break; done
pnpm --filter @repo/worker test:integration
```

## Out of scope
- Cambiar `ingest.ts` o el orden en que el worker escribe estado y aviso. Si crees que el producto debería cambiar, dilo en el report y no lo toques.
- Otros tests con el mismo patrón en otros archivos: apúntalos en el report como seguimiento.

## Notes / decisions already made
- Rama `task/ola0-11-test-ingesta-solo-ue`, PR nuevo con título `[M1][OPS-01] El test de «Solo UE» de la ingesta espera a que termine la entrega antes de leer el log`.
- No se relanza el CI de `main` para taparlo: `c0707e1` y los commits siguientes ya dan la señal.
- No mergea el worker: mergea el Lead (docs/WORKFLOW.md).
