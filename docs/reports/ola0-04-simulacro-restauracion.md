# Report ola0-04: simulacro de restauración (#330), pasos 1 y 2

Spec: docs/specs/ola0-04-simulacro-restauracion-330.md · Fecha: 2026-11-25 · Rama/PR: `ops/pl-prod-restore-drill` / #330

**Línea de estado (para STATUS, la pone el Lead):** `[M1][PL-prod]` simulacro de restauración: revisado (`cb61562..0bd6533` más el arreglo de la revisión), harness local 9/9 negativos detectados, rama al día con `main`. **Falta la corrida real contra staging desde `main`** (pasos 3 y 4, Lead, tras el merge): hasta entonces la puerta de M1 «un simulacro de restauración» **no** está cumplida.

## Resultado: PARTIAL (pasos 1 y 2 hechos sin el merge; los pasos 3 y 4 son del Lead)

## Criterios de aceptación
| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Revisión del último commit sin hallazgos bloqueantes | Pasa | Reviewer (opus) sobre `cb61562..0bd6533`: **PASS**. Un hallazgo medio y uno bajo, arreglados en esta rama (abajo); el reviewer revisó también el diff del arreglo: **PASS**. |
| #330 mergeado con CI verde sobre el commit exacto | No es de este worker | Rama al día con `main` (merge `8cf71af`, sin rebase). El CI sobre el head final se le pasa al Lead en el mensaje. El merge lo hace el Lead. |
| Corrida real en staging en verde | No es de este worker | No se ha lanzado (instrucción del Lead). |
| El runbook sigue diciendo lo que no prueba | Pasa | `docs/runbooks/simulacro-de-restauracion.md`: §1, la restauración del proyecto entero no está probada (necesita Pro); §5, tras una restauración real hay que relanzar «Staging · worker» `role` y `rls-role`. Lo confirma el reviewer. |

## Revisión (reviewer, opus) y qué se hizo
- **Comprobado sin hallazgos:**
  - el diff propio del PR frente a `main` son solo los 4 archivos de la spec;
  - cada comprobación falla cerrada: las fases van encadenadas con `&&`, `dump` tiene `|| exit 1` y una variable vacía hace fallar su comparación;
  - de la restauración de datos solo se imprimen SQLSTATE y recuentos (`VERBOSITY=sqlstate`);
  - el workflow solo lee staging (`link` + `db dump`), tiene `contents: read`, las acciones fijadas por SHA, ningún artefacto ni caché, y el volcado vive en una carpeta `0700` que se borra al salir;
  - `0bd6533` arregla una regresión real (`^ERROR` no casaba con `psql:<archivo>:<línea>: ERROR:`).
- **Medio, arreglado:** los errores del propio psql al leer un archivo (`psql:<archivo>:<línea>: error: invalid command …`, en minúsculas) no los detectaba ninguna búsqueda. Ahora cuentan `: error:` en roles y esquema (se imprimen; esos archivos no llevan filas) y en datos (solo se cuentan, porque pueden citar una línea de datos). Hay dos casos nuevos en el harness, y uno de ellos exige además que el informe no repita el texto.
- **Bajo, arreglado:** un rol propio sin su `ALTER ROLE … WITH` en el volcado del origen no comprobaba atributos (fallaba abierto). Ahora es un descuadre. Tiene caso nuevo en el harness.
- **Bajos, sin tocar** (seguimiento abajo): el harness hereda `set -e` del script, que en producción no actúa porque se llama con `||`; faltan negativos de filas por tabla, número de políticas, migraciones y fases de preparar y restaurar; `if: github.ref == main` no protege si la regla de ramas del entorno `staging` no se limita a `main` (no se ha podido comprobar desde aquí); el runbook no dice expresamente «staging está en Free».
- **Revisora automática (nivel 2, sobre `31471bd`; COMMENT, zona sensible):**
  - medio, arreglado: `permissions: {}` arriba y `contents: read` solo en el job `drill` (`staging-restore-drill.yml`);
  - bajo (lo vio también el reviewer), arreglado: `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` salen del `env` del job y van solo a los 3 pasos que los usan (comprobarlos, `link` y el simulacro), así que `checkout` y `setup-cli` ya no los ven;
  - medio, **no se arregla en el diff**: `workflow_dispatch` ejecuta el YAML de la rama elegida, así que solo una regla de ramas del entorno `staging` limitada a `main` impide que otra rama reciba sus secretos. Es configuración de GitHub, no comprobada desde aquí. Va en el primer punto del seguimiento.

## Verificación (ejecutada en esta sesión)
- `bash scripts/supabase/tests/restore-drill.test.sh`, con Docker y Supabase local (CLI 2.118.0, `pnpm db:start` + `pnpm db:seed`) y un destino `public.ecr.aws/supabase/postgres:17.6.1.054`:
  - con el script del PR antes del arreglo (`0bd6533` más el merge con `main`): línea base OK y 6 de 6 negativos detectados;
  - **rojo**, el harness nuevo contra el script anterior: exit 1, «3 fallo(s) pasan sin que el simulacro los detecte». Son exactamente los 3 casos nuevos;
  - **verde**, el harness nuevo contra el script arreglado: exit 0, línea base OK y **9 de 9 negativos detectados**, en 75 s.
- `pnpm test`: 20 de 20 tareas en verde (sobre el merge con `main`).
- `bash -n` de los dos scripts: OK.

## Archivos tocados
- `scripts/supabase/restore-drill.sh`: `: error:` cuenta como error, y un rol sin atributos en el origen falla.
- `scripts/supabase/tests/restore-drill.test.sh`: 3 casos en negativo nuevos.
- `.github/workflows/staging-restore-drill.yml`: permisos por job y secretos solo en los pasos que los usan (YAML comprobado con `yaml.safe_load`: `permissions` `{}`, `drill.permissions` `{contents: read}`, el `env` del job solo con `DISPOSABLE_PG_PASSWORD`). Sin corrida real: el workflow solo corre desde `main`.
- `docs/reports/ola0-04-simulacro-restauracion.md`: este report.
- Merge de `origin/main` (`8cf71af`): conflicto en `docs/STATUS.md`, resuelto **con la versión de `main`**. Así, el PR ya no toca STATUS: su línea «En curso» y la nota de la condición de salida 2 se caen, y el STATUS nuevo de `main` ya pone el simulacro en «Construido, no verificado en real».

## Desviaciones de la spec (y por qué)
- La spec pide «Touch only these: nada, salvo hallazgos de la revisión». Los arreglos son hallazgos de la revisión (reviewer y Revisora), dentro de los archivos de la spec, y solo añaden aserciones: ninguna existente se relaja.
- La descripción del PR mencionaba `docs/STATUS.md`. Ahora dice que el PR ya no lo toca (actualizada en este paso).

## Seguimiento para el Lead (máx. 3)
- Antes de lanzar la corrida real, comprobar que la regla de ramas del entorno `staging` solo admite `main`. El `if:` del workflow no basta: un dispatch desde otra rama ejecuta el YAML de esa rama.
- PR pequeño, si se quiere: «staging está en Free» en el runbook; y los negativos que faltan en el harness (filas, políticas, migraciones, fases).
- Después de la corrida real: el RTO en la tabla del runbook y la puerta en STATUS, solo si sale en verde (paso 4 de la spec).
