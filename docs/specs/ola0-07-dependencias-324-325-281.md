# ola0-07: dependencias (#324, #325, #281)

Phase / wave: Ola 0 · M1 (MNT-01)
Model: Sonnet · Effort: Medium
Can run in parallel with: preparación del resto; merge en serie.

## Goal
Dejar al día las dependencias abiertas sin mezclar subidas de DBOS (que tienen procedimiento propio).

## Estado al cierre
| PR | Qué | Estado | Falta |
| --- | --- | --- | --- |
| #324 | `pnpm/action-setup` 6.1.0 → 6.1.1 (Dependabot) | V10 OK en el cambio (pines comprobados contra las etiquetas) | sus checks fallaron el 23-11 en 1–2 s (runners que no arrancaban); relanzar con update-branch y CI verde |
| #325 | `supabase/setup-cli` 3.0.1 → 3.2.0 (Dependabot) | igual que #324 | igual; comprobar que la versión de la CLI sigue siendo 2.118.0 (CLAUDE.md) |
| #281 | las 8 actualizaciones de #279 sin DBOS (V8, 13-11) | sin revisar desde el 13-11; muy por detrás de main | poner al día (posibles conflictos con #326, que ya subió 15 paquetes), revisar qué queda, CI; si todo está ya en main, proponer a Diego cerrarlo |

## Steps
1. #324 y #325: update-branch, CI verde, comprobación de que las acciones siguen fijadas por SHA, merge (de uno en uno).
2. #281: comparar con main; quitar lo que #326 ya subió; si queda algo, CI y merge; si no, recomendar cierre a Diego (no cerrar sin su ok).
3. Si alguna sube DBOS: seguir «Subir de versión DBOS» de CLAUDE.md (migración + `19_dbos_schema`), en PR aparte.

## Acceptance criteria
- [ ] Cada PR mergeado (o propuesto para cierre) con CI verde sobre el commit exacto.
- [ ] Ninguna acción de GitHub sin fijar por SHA.

## Verify commands
```
pnpm install --frozen-lockfile && pnpm check
```

## Revisión del agente reviewer
- #324/#325 tocan workflows (zona sensible): comprobar pines y que no cambian permisos. #281: no.
