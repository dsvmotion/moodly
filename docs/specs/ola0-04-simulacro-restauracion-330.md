# ola0-04: simulacro de restauración (#330) y la corrida real contra staging

Phase / wave: Ola 0 · M1 (puerta «A restore drill is done»; PL-prod)
Model: Sonnet · Effort: Medium (High si hay que tocar el script)
Can run in parallel with: preparación del resto; merge en serie.

## Goal
Mergear #330 (V14) y lanzar la corrida real «Staging · simulacro de restauración» desde `main`, para cumplir la puerta de M1 con evidencia real.

## Estado al cierre (2026-11-24)
- Rama `ops/pl-prod-restore-drill`, head **`0bd6533`**, fuera de borrador. CI recién lanzada al cierre.
- V10 OK sobre `cb61562`. Después: `4decb81` (las 4 notas bajas de V10: roles comparados con el origen y sus atributos; RLS falla con 0 tablas; las fases propagan su error; `FATAL` y `psql: error:` cuentan) y `0bd6533` (arreglo de una regresión que V14 introdujo: `^ERROR` no casaba con el prefijo `psql:<archivo>:<línea>:`; ahora `ERROR:` en cualquier parte, solo el SQLSTATE; caso nuevo en el harness que fallaba antes). **Ninguno de los dos commits está revisado.**
- Local (V14): simulacro OK en 18 s (123 tablas / 1881 filas, RLS en 41 tablas, 147 políticas, 2 roles propios, 72 migraciones = repo); harness 6/6 fallos detectados; `pnpm test` 20/20.

## Read only these
- docs/specs/ola0-00-como-mergear.md
- scripts/supabase/restore-drill.sh, scripts/supabase/tests/restore-drill.test.sh
- .github/workflows/staging-restore-drill.yml, docs/runbooks/simulacro-de-restauracion.md

## Touch only these
- nada, salvo hallazgos de la revisión (en la rama de #330)

## Steps
1. Reviewer sobre `cb61562..0bd6533`: que cada comprobación falle cerrada, que no se imprima ningún dato (solo conteos, nombres de tabla, SQLSTATE), que el workflow solo lea staging y no suba artefactos.
2. Poner al día con main, CI verde, merge según ola0-00.
3. Lanzar desde `main`: `gh api -X POST repos/dsvmotion/moodly/actions/workflows/staging-restore-drill.yml/dispatches -f ref=main`. Guardar el id de la corrida y su resultado.
4. Con el resultado real: rellenar el RTO del simulacro lógico en la tabla del runbook (PR pequeño) y marcar la puerta en STATUS/PLAN **solo si la corrida salió verde**.

## Acceptance criteria
- [ ] Revisión del último commit sin hallazgos bloqueantes.
- [ ] #330 mergeado con CI verde sobre el commit exacto.
- [ ] Corrida real en staging en verde, con su enlace en STATUS.
- [ ] El runbook sigue diciendo lo que **no** prueba: la restauración del proyecto entero de Supabase (necesita Pro; staging está en Free, sin backups diarios) y que tras una restauración real hay que relanzar «Staging · worker» `role` y `rls-role` (las contraseñas de `dbos_worker` y `moodly_worker` no viajan en el volcado).

## Verify commands
```
bash scripts/supabase/tests/restore-drill.test.sh   # necesita Docker y Supabase local; no corre en CI
pnpm test
```

## Revisión del agente reviewer
- Sí (lee datos de staging y usa sus secretos).
