# Report ola0-07: dependencias (#324, #325, #281)

Spec: docs/specs/ola0-07-dependencias-324-325-281.md · Date: 2026-11-25 · Branch/PR: `task/ola0-07-dependencias` (sin PR; PRs de trabajo: #324, #325, #281)

## Result: PASS (#324 y #325 listos para mergear; #281 propuesto para cierre)

Línea de estado para STATUS.md: MNT-01 · #324 y #325 al día con `main` (677a813), CI verde sobre su head; #281 sin contenido pendiente (sus 8 subidas ya están en `main`): se propone cerrarlo.

## Acceptance criteria
| Criterion | Pass/Fail | Evidence |
| --- | --- | --- |
| #324 con CI verde sobre el commit exacto | Pass | Head `407d763061d4599445a64dc4f5fd4a9a1c296e30` (base `main` 677a813). Los 5 checks de `required-checks.txt` en `success` (typecheck · lint · test · build; db · migraciones · pgTAP; e2e · Playwright por rol; seguridad; evals · modelo falso), más guarda y revisora. Status `sensitive-paths` = `success` (github-actions). No es borrador. |
| #325 con CI verde sobre el commit exacto | Pass | Head `13dd587237447da04f13199e99ed70e9791c24c2` (base `main` 677a813). Mismos 5 checks en `success`; `sensitive-paths` = `success`. No es borrador. |
| CLI de Supabase sigue en 2.118.0 (#325) | Pass | El diff solo cambia el pin; `with: version: 2.118.0` queda en los 6 sitios. El log del job «db · migraciones · pgTAP» (run 45676098285) dice «currently installed v2.118.0» con `setup-cli` 3.2.0. |
| Ninguna acción sin fijar por SHA | Pass | Reviewer (opus): 8 líneas en #324 (`73e46992…`, v6.1.1) y 6 en #325 (`689adcfb…`, v3.2.0), todas SHA de 40 caracteres. Los SHA se resolvieron contra las etiquetas con `git ls-remote` (v6.1.1 es anotada y su `^{}` apunta a `73e46992…`; v3.2.0 es ligera y apunta a `689adcfb…`). Ninguna línea `uses:` sin fijar en `.github/workflows` de ninguna rama. |
| #324/#325 no cambian permisos ni disparadores | Pass | Reviewer: cada hunk cambia solo el pin y el comentario de versión; sin cambios en `permissions:`, `on:`, secretos ni `with:`. Límite: no se comparó el código upstream entre versiones, solo los pines. |
| #281 comparado con `main` | Pass | Ver tabla abajo: todo está ya en `main` con la misma versión o una más nueva. |
| #3 (DBOS) | N/A | Ninguna de las tres sube DBOS. |

### Por qué fallaron el 23-11 y qué cambió
Los checks fallaban en 1–5 s sin llegar a ejecutar pasos. Tras `update_pull_request_branch` (un solo intento por PR, sin relanzar) el CI corre de verdad: typecheck 2 min, pgTAP 1,5 min, e2e ~25 min, todo en verde. No hizo falta investigar logs del fallo antiguo; no tocaron ni los PRs ni los workflows nada más que el pin.

### #281 frente a `main` (677a813)
| Paquete | #281 traía | `main` tiene | Dónde |
| --- | --- | --- | --- |
| `lucide-react` | 1.64.0 | 1.70.0 | `apps/site`, `packages/ui` |
| `next` | 16.4.3 | 16.4.5 | `apps/site`, `apps/web` |
| `@sentry/nextjs` | 11.10.0 | 11.11.0 | `apps/web` |
| `postcss` | 8.5.32 | 8.5.32 | `apps/web` |
| `turbo` | 2.11.10 | 2.11.10 | raíz |
| `typescript-eslint` | 8.72.1 | 8.72.1 | raíz |
| `ai` | 7.0.157 | 7.0.165 | `packages/agent-core` |
| `@tanstack/react-virtual` | 3.14.24 | 3.14.26 | `packages/ui` |

Comprobado en los `package.json` y en `pnpm-lock.yaml` de `origin/main`. Lo único de #281 que `main` no tiene es la fila `MNT-01` de `docs/scope.yaml` (commit d31b13c), que además va contra la regla de que los PRs no tocan ese archivo. **Recomendación: cerrar #281 sin mergear** y, si se quiere la fila MNT-01, que la añada el Lead en `docs/scope.yaml` (con #282 mergeado, dd9d2f5, y #279 cerrado). No he cerrado ni empujado nada a `claude/deps-nov13`.

## Files changed
- `docs/reports/ola0-07-dependencias.md` (este report). En los PRs no cambio nada: solo los puse al día con `main` (merge de `main` por `update_pull_request_branch`; sin rebase ni force push).

## Deviations from spec (and why)
- La spec dice «merge»: lo hace el Lead (flujo nuevo, `docs/WORKFLOW.md`).
- #281: sin CI ni resolución de conflictos, porque no queda nada que mergear.

## Follow-ups for the lead (max 3)
- Mergear #324 y #325 de uno en uno. `main` se mueve: la última puesta al día antes de cada merge es tuya; si sube `main`, el CI tarda ~25 min (e2e).
- Decidir el cierre de #281 (recomendado) y si se añade la fila MNT-01 a `docs/scope.yaml`.
- Después de #325, comprobar «Despliegue a staging» (usa `supabase/setup-cli` en `deploy-staging.yml`) y, de #324, el CI de `main`.
