# ola0-01: aprobaciones con detalle y edición (#313 → #317) y el test estructural (#336)

Phase / wave: Ola 0 · M2 (OA02) y M1 (control 3.2)
Model: Sonnet · Effort: Medium
Can run in parallel with: la preparación de ola0-02/03/04 (archivos distintos); el merge, en serie (ola0-00).

## Goal
Mergear en este orden, sin cambios de código: #313 (detalle de cada aprobación; una reserva pasada no se aprueba), #317 (corregir el texto de una respuesta al aprobarla; va encima de #313) y #336 (el test estructural `tenant-sql-org` cuenta las tablas tras una coma en FROM y en DELETE … USING).

## Estado al cierre del lead (2026-11-24)
| PR | Rama | Head | CI | Revisión | Falta |
| --- | --- | --- | --- | --- | --- |
| #313 | claude/m2-oa02-detalle-aprobacion | 40a3fe6 | verde | V10 OK (resolución del conflicto de imports) | poner al día con main (aa79e63+) y revisar el merge |
| #317 | claude/m2-oa02-editar-respuesta | 6f42eff | verde | V10 OK (filtros de #331 intactos; migración movida idéntica) | tras #313: poner al día, revisar, merge |
| #336 | claude/m1-3-2-from-coma-using | cd32992 | verde | V10 OK (8/8 también sobre main 91f25da) | poner al día y merge (solo test) |

## Read only these
- docs/specs/ola0-00-como-mergear.md
- los tres PRs en GitHub (cuerpo y diff)

## Touch only these
- nada en el código; solo comentarios/merge en GitHub. Si `update-branch` da conflicto en #313/#317: `apps/worker/src/agents/approvals.ts` y `apps/worker/src/agents/converse.integration.ts` (conservar siempre los filtros `organization_id = $2` de #331 y añadir lo de OA02 encima).

## Steps (checkpoint after each)
1. #313: update-branch → reviewer (solo main en el merge) → CI verde → comprobaciones ola0-00 → merge → verificar main.
2. #317: igual. Atención: su migración es `20261124120000_approval_edits` (con rollback) y su pgTAP `62_approval_edits`; si en `main` ya hay una migración posterior a 20261124120000, renombrar a un slot nuevo (el contenido no cambia) y explicarlo en el PR.
3. #336: igual.

## Acceptance criteria (checkable)
- [ ] Los tres PRs mergeados en orden con el `sha` comprobado.
- [ ] `main` verificado tras cada uno (check, test:db, integración db y worker, e2e).
- [ ] En staging, «Despliegue a staging» verde tras #317 (aplica 20261124120000).
- [ ] OA02 sigue «construido, sin verificar en real» en STATUS hasta que alguien apruebe en staging una respuesta corregida y la vea llegar a la conversación (tarea manual de Diego).

## Verify commands
```
pnpm check && pnpm db:reset && pnpm test:db && pnpm db:seed
pnpm --filter @repo/db test:integration
pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker test:integration
pnpm --filter @repo/web e2e
```

## Revisión del agente reviewer
- #317 **sí** (migración, guarda `guard_approval`, aprobaciones = permisos del agente). #313 y #336: solo comprobar que el merge con main no cambia su diff.

## Out of scope
- Reservar/mover/cancelar desde la agenda (OA03, después).
