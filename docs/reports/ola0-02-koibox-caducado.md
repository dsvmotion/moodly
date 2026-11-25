# Report ola0-02: Koibox, «no se pudo comprobar a tiempo» (#338) y un solo TTL

Spec: docs/specs/ola0-02-koibox-caducado-338.md · Date: 2026-11-25 · Branch/PR: `v15/koibox-caducado` · #338

## Result: PASS

**Línea de estado (int-koibox):** `in_progress`. El incremento 2 está construido: la tarjeta avisa cuando un envío caduca y hay un solo plazo de 15 min (`KEY_SUBMISSION_TTL_MS` de `@repo/config`) en la web, el worker y la transacción. Koibox sigue **«construido, sin verificar en real»** y **Bloqueado** para la prueba real: faltan KMS en staging y una cuenta Koibox Platinum. Todas las pruebas usan dobles: el par local de ingreso y un verificador falso.

## Acceptance criteria
| Criterio | Pass/Fail | Evidencia |
| --- | --- | --- |
| `git grep -n "SUBMISSION_TTL_MS" apps/worker` solo muestra el import de `@repo/config` | Pass | `git grep -nw SUBMISSION_TTL_MS apps/worker` sale vacío: no queda la constante local. Todas las coincidencias de `git grep -n` son `KEY_SUBMISSION_TTL_MS`: el import de `@repo/config` en `key-submission.ts:2`, sus usos (:260, :338) y los tests. |
| El SQL del «fresh» recibe el TTL como parámetro, sin literal | Pass | `make_interval(secs => $4::double precision / 1000)` con `ttlMs` (`key-submission.ts:165`). El sueño de DBOS y el plazo de los reintentos usan el mismo `ttlMs`. |
| Integración `key-submission` verde (27/27 o más) | Pass | `vitest run --config vitest.integration.config.ts src/integrations/key-submission.integration.ts` contra Supabase local con el seed: **30/30** (27 + 3 nuevos). |
| e2e de Koibox (7/7) | Pass | `pnpm --filter @repo/web e2e`: **262/262** en local, de ellos los 7 de `integrations-koibox.e2e.ts`. El argumento de filtro no se aplicó, así que corrió la suite entera. |
| Unit, typecheck y lint del worker | Pass | `pnpm --filter @repo/worker test`: 33 archivos y 355/355 tests. `typecheck` y `lint` limpios. `pnpm build`: 14/14. |
| Merge con CI verde sobre el commit exacto | Lo hace el Lead | El PR queda listo (fuera de borrador y con el CI del head final en verde). No he mergeado. |
| STATUS: Koibox sigue «construido, sin verificar en real» | Pass | Arriba, en la línea de estado. `docs/STATUS.md` no se toca. |

### Prueba en negativo del TTL único (pedida por el Lead)
Tests nuevos en `key-submission.integration.ts`, describe «la caducidad cuenta desde el envío»:
1. «el plazo de la transacción es el que recibe el worker, no un literal del SQL»: con `ttlMs` de 5 min, un envío de hace 10 min debe quedar `expired`.
2. «sin plazo explícito, el del worker es KEY_SUBMISSION_TTL_MS»: un envío de `KEY_SUBMISSION_TTL_MS + 1 min` atrás queda `expired`.
3. Un envío de `KEY_SUBMISSION_TTL_MS − 1 min` atrás, sin plazo explícito, se aplica: `applied`.

En los dos casos de abajo cambié el código temporalmente y después lo dejé como estaba (30/30 otra vez):
- **SQL con literal:** `make_interval(secs => 900) and $4::double precision is not null`. Resultado: **1 failed | 29 passed**.
  ```
  × el plazo de la transacción es el que recibe el worker, no un literal del SQL: con 5 min, uno de hace 10 caduca
  AssertionError: expected { outcome: 'applied', …(1) } to match object { outcome: 'expired' }
  ```
- **Plazo por defecto distinto del de config:** `options.ttlMs ?? 30 * 60 * 1000`. Resultado: **1 failed | 29 passed**.
  ```
  × sin plazo explícito, el del worker es KEY_SUBMISSION_TTL_MS de @repo/config (el mismo de la web): un minuto después, caducado
  AssertionError: expected { outcome: 'applied', …(1) } to match object { outcome: 'expired' }
  ```

## Files changed
- `apps/worker/src/integrations/key-submission.ts`: importa `KEY_SUBMISSION_TTL_MS` de `@repo/config` y borra la constante local `SUBMISSION_TTL_MS`. El comentario de cabecera dice que el plazo es uno solo.
- `apps/worker/src/integrations/key-submission.integration.ts`: los 3 tests de arriba. Ninguna aserción existente cambia.
- `docs/reports/ola0-02-koibox-caducado.md`: este report.
- Del PR desde antes, sin cambios (commit `d9a44fa`, revisado por V10): la tarjeta y `key-check.ts` de la web, `KEY_SUBMISSION_TTL_MS` en `@repo/config` y es/en. Además, el merge de `origin/main` (`2c3a94e`), que solo trae `main`.

## Deviations from spec (and why)
- Los tests nuevos van en `key-submission.integration.ts`, no en el test unitario. El test unitario no fijaba el valor, y la prueba en negativo del «fresh» que pidió el Lead necesita la base de datos. Son 3 tests añadidos: no cambia ninguna aserción ni ningún archivo fuera del módulo.
- El SQL ya recibía el TTL como `$4` antes de este PR. El cambio real es la fuente del valor por defecto.

## Reviewer
Agente `reviewer` (opus) sobre la spec: **PASS**, sin hallazgos bloqueantes. Confirma lo siguiente:
- El TTL efectivo es el mismo en el worker, en la comprobación de la BD y en la web.
- Ningún log lleva la clave: solo ids y `err.name`. La tarjeta guarda en sessionStorage solo `{submissionId, sentAt, wasActive}`.
- No queda ningún otro uso de `SUBMISSION_TTL_MS`.
- `2c3a94e` solo trae `main`.

Dos notas bajas, fuera de alcance:
- El freno de envíos de la BD (`20261124100000_integration_submission_result_limit.sql:229`) tiene su propio `interval '15 minutes'`. Es otra cosa, cuántos envíos se aceptan cada 15 min, y no decide la caducidad. Pero alguien podría pensar que cambia con `KEY_SUBMISSION_TTL_MS`.
- Dos comentarios del worker dicen «15 min» con el número escrito (`key-submission.ts:36, :343`).

## Notas del entorno local
- Supabase 2.118.0 y Docker en el contenedor de la sesión, con Node 22. El proyecto pide Node 24 y pnpm solo avisa.
- La primera corrida de `pnpm --filter @repo/worker test:integration` dio 16 fallos en `converse.integration.ts`, todos por tiempo («no llegó a pasar»).
  - Causa: el worker de ese test arrancaba con cola en el outbox, eventos `integration.key_submitted` con unos 47 s de retraso. Venían de mis corridas repetidas de `key-submission` sobre la misma base de datos sin resetear.
  - No es de este PR. El job «e2e · Playwright por rol» corre `pnpm --filter @repo/worker test:integration`, `converse` incluido, sobre una base de datos limpia, y salió en **verde** sobre `f366cfd`: https://github.com/dsvmotion/moodly/actions/runs/45671192823/job/139406611987.

## CI sobre `f366cfd` (head antes de este report)
Los 5 checks de `required-checks.txt` están en `success`: typecheck · lint · test · build; db · migraciones · pgTAP; e2e · Playwright por rol; seguridad · dependencias y secretos; evals · modelo falso. El status `sensitive-paths` de `github-actions[bot]` también está en `success`. El commit de este report solo añade este archivo. El resultado del CI sobre el head final va en el mensaje al Lead.

## Follow-ups for the lead (max 3)
- Nota baja del reviewer: dar nombre propio a la ventana del freno de envíos (15 min), o comentarla en una migración futura, para no confundirla con el TTL.
- Prueba real de Koibox: hacen falta KMS en staging y una cuenta Koibox Platinum. Hasta entonces sigue **Bloqueado**.
