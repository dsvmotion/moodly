# ola0-09b: limpieza de la Ola 0, simulacro de restauración

Phase / wave: Ola 0 (última subfase, con `ola0-09a`) · M1 (PL-prod)
Model: Opus · Effort: High
Skills: `systematic-debugging`, `verification-before-completion`
Reviewer required: yes (script y harness que leen la base de datos de staging)
Can run in parallel with: `ola0-09a`. No comparte archivos con ninguna otra spec.

## Goal
Cerrar lo que quedó abierto del simulacro de restauración tras su primera corrida real (filas 9–11 de `docs/reports/ola0-followups.md`): dos líneas sin explicar en el log, negativos que faltan en el harness y una frase del runbook.

## Lo que se sabe
- Corrida real 45676891616 (2026-11-25, `main` `c0707e1`): `RESULTADO: OK` en 109 s.
- En el log del Postgres desechable de esa corrida aparecen, sin que el simulacro las cuente:
  - `password authentication failed for user "postgres"`, 41 veces, desde `172.18.0.1`, entre las 18:37:52 y las 18:39:21 UTC (todo el volcado);
  - `supabase_admin@postgres ERROR:  role "supabase_realtime_admin" does not exist`, una vez.
- **Sin confirmar:** si la primera es la comprobación de salud del contenedor de servicio del workflow (que sondea con otra contraseña) y la segunda una migración de arranque de la imagen, anteriores a la restauración.

## Read only these
- docs/ARCHITECTURE.md, docs/reports/ola0-followups.md (filas 9–11), docs/reports/ola0-04-simulacro-restauracion.md
- scripts/supabase/restore-drill.sh, scripts/supabase/tests/restore-drill.test.sh
- .github/workflows/staging-restore-drill.yml
- docs/runbooks/simulacro-de-restauracion.md

## Touch only these (create / edit)
- scripts/supabase/tests/restore-drill.test.sh
- scripts/supabase/restore-drill.sh (solo si la investigación del paso 1 encuentra un error que hoy se traga)
- .github/workflows/staging-restore-drill.yml (solo si el origen de las 41 líneas es la comprobación de salud del contenedor)
- docs/runbooks/simulacro-de-restauracion.md
- docs/reports/ola0-09b-limpieza-simulacro.md

## Steps (checkpoint after each)
1. **Explica las dos líneas** con evidencia, no con una suposición: reprodúcelas en local con el harness (o léelas en el log de la corrida real con `get_job_logs`) y di de dónde sale cada una y en qué momento respecto a la restauración. Si alguna es un error de la restauración que el simulacro no cuenta, eso es un fallo: arréglalo con su caso en negativo. Si son ruido previo, déjalo escrito en el runbook y, si se puede sin tocar secretos, quita el ruido.
2. **Negativos que faltan en el harness:** filas por tabla que no cuadran, número de políticas distinto, una migración de menos en el destino, y un fallo en las fases de preparar y de restaurar. Cada uno tiene que hacer fallar el simulacro.
3. El harness hereda `set -e` del script; en la corrida real el script se llama con `||`. Que el harness lo ejecute igual que el workflow.
4. Runbook: di expresamente que staging está en Supabase Free (sin copias diarias) y qué cambia con Pro.
5. `reviewer` (model "opus"), un push con el report, CI verde, PR fuera de borrador. **No lances el workflow contra staging**: la corrida real la lanza el Lead después del merge.

## Acceptance criteria (checkable)
- [ ] El report dice el origen de cada una de las dos líneas, con la evidencia (comando y salida).
- [ ] El harness detecta cada negativo nuevo (salida en el report) y sigue detectando los 9 anteriores.
- [ ] `bash scripts/supabase/tests/restore-drill.test.sh` sale con 0 en local; `pnpm test` verde.
- [ ] Ninguna comprobación existente del script se relaja.
- [ ] El workflow sigue con `permissions: {}` arriba, `contents: read` en el job, acciones fijadas por SHA y los secretos solo en los pasos que los usan.

## Verify commands
```
pnpm db:start && pnpm db:seed
bash scripts/supabase/tests/restore-drill.test.sh   # necesita Docker; no corre en CI
pnpm test
```

## Out of scope
- La restauración del proyecto entero de Supabase (necesita Pro; tarea de Diego).
- Subir `supabase/setup-cli` a v3.2.0 en este workflow (lo propondrá Dependabot).

## Notes / decisions already made
- Rama `task/ola0-09b-limpieza-simulacro`, PR nuevo, título `[M1][PL-prod] Simulacro de restauración: negativos que faltaban y las dos líneas del log explicadas`.
- La puerta 3 de M1 ya está cumplida con la corrida 45676891616; esta spec no la reabre salvo que el paso 1 encuentre un error real de restauración. En ese caso, avisa al Lead antes de seguir.
- No mergea el worker: mergea el Lead (docs/WORKFLOW.md).
