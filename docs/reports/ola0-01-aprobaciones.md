# Report ola0-01: aprobaciones (#313 → #317) y test estructural (#336)

Spec: docs/specs/ola0-01-aprobaciones-313-317-336.md · Date: 2026-11-25 · Branch/PR: #313, #317, #336 (preparación; el merge lo hace el Lead)

## Result: PARTIAL (en curso: #313 y #336 en preparación; #317 revisado, pendiente de que #313 llegue a `main`)

Estado: OA02 (#313, #317) y control 3.2 (#336) — preparados por el worker, sin mergear. OA02 sigue «construido, sin verificar en real» hasta la prueba manual en staging.

## Acceptance criteria
| Criterion | Pass/Fail | Evidence |
| --- | --- | --- |
| #313 al día con `main` sin cambiar su diff | Pass | Merge `51d6eea` (padres `40a3fe6` + `f0e2c07`), `git show --cc` vacío, mismo patch-id (`93250728a319`, 15 archivos, +857/−82). Filtros `organization_id = $2` de #331 intactos en `approvals.ts` y `converse.integration.ts` (reviewer, opus). |
| #336 al día con `main` sin cambiar su diff | Pass | Merge `9f4c814` (update-branch de GitHub; padres `cd32992` + `f0e2c07`), `git show --cc` vacío, diff idéntico byte a byte (1 archivo, `tenant-sql-org.test.ts`). |
| #317 revisado (migración, guarda, worker, web) | Pass | reviewer (opus) sobre `40a3fe6..6f42eff`: sin hallazgos bloqueantes; sin aserciones existentes cambiadas; slot `20261124120000` > última de `main` (`20261124100000`); pgTAP `62` libre, `plan(34)` = 34 aserciones; rollback restaura `guard_approval` exacto. |
| CI de los 5 checks obligatorios en verde sobre el head | Pass (#313, #336) | #313 `51d6eea` y #336 `9f4c814`: typecheck·lint·test·build, db·pgTAP, e2e, seguridad, evals modelo falso = success; status `sensitive-paths` de github-actions[bot] = success. #317: pendiente de poner al día tras #313. |
| PRs fuera de borrador | Pass (#313, #336) | `ccr/ready_for_review` → draft=false, mergeable_state=clean. #317 sigue en borrador hasta ponerlo al día. |
| Merge en orden + `main` verificado + staging tras #317 | n/a (Lead) | Lo hace el Lead (nota del Lead, 2026-11-25). |

## Files changed
- Ninguno en código. Merge de `main` en `claude/m2-oa02-detalle-aprobacion` (`51d6eea`) y en `claude/m1-3-2-from-coma-using` (`9f4c814`, por la API).
- Este report.

## Deviations from spec (and why)
- #313: `update-branch` de GitHub devolvió 500 tres veces seguidas (el head no cambió entre intentos). Hice el mismo merge en local con `git merge origin/main` (limpio, sin conflictos) y lo empujé a la rama del PR, sin rebase ni force push, como permite ola0-00.
- No hay merge ni verificación de `main`: los hace el Lead.

## Follow-ups for the lead (max 3)
- #336: la Revisora (no obligatoria) pide cambios solo por el título `[M1][3.2]` (no casa con `[Mx][ID]` ni tiene fila en scope.yaml). Sin hallazgos de código. No lo toqué: decide el Lead.
- #317, no bloqueante (reviewer): `valid_reply_edit` (migración, l.56) usa `btrim` (solo espacios, cuenta code points) y Zod `.trim()` cuenta unidades UTF-16; un texto de solo `"\n"` o uno largo con emojis pasa la BD y falla en el worker. Falla de forma segura (la ejecución acaba `failed`), pero nadie avisa a la persona (`approvals.ts:302-310`). Candidato a fila en `scope.yaml` o fix spec.
- #317, nit: en `converse.integration.ts` el primer test de OA02 restaura la autonomía fuera de `finally`.
- #313, low (Revisora nivel 2, confirmado): `actions.ts:34` ignora el `error` del select de `approvals`; si falla la lectura se salta la comprobación de hora pasada y aprueba (fail-open). Arreglo: devolver error si el select falla. No lo toqué (spec sin cambios de código); decide el Lead.
- #313, nit (ya revisado antes): un test de integración lee `public.executions where id = $1` sin filtro de organización (solo test).
