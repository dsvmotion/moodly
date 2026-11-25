# Ola 0: seguimientos de los reports y dónde acaba cada uno

Qué es: la lista de todo lo que los workers, el agente `reviewer` y la Revisora automática dejaron apuntado durante la Ola 0. La fase no se cierra mientras quede una fila en «sin clasificar» (`docs/WORKFLOW.md`, «Closing a phase»). La mantiene el Lead; última puesta al día: 2026-11-25 20:30 UTC.

Destinos posibles: **spec** (con su archivo), **fila** de `docs/scope.yaml`, **Diego** (decisión o tarea manual), **descartado** (con motivo).

## Para la limpieza de la fase (`ola0-09`, spec por escribir cuando entren #317, #334 y #312)
| # | De dónde sale | Qué | Destino propuesto |
| --- | --- | --- | --- |
| 1 | `reviewer` sobre #338 | Si `keySubmissionStatus` devuelve `null` o lanza, la tarjeta de Koibox deja de sondear y se queda en «comprobando» con el campo desactivado hasta recargar (`key-integration-card.tsx`) | spec `ola0-09a` |
| 2 | `reviewer` sobre #338 | Ningún test cubre «el envío ya se borró y después se sondea» | spec `ola0-09a` |
| 3 | Revisora sobre #338 | Dos comentarios de `apps/worker/src/integrations/key-submission.ts` dicen «15 min» a mano | spec `ola0-09a` |
| 4 | Revisora sobre #293 | `schedulesTesting` guarda programaciones de prueba en la base de sistema de DBOS: documentarlo en `worker.ts` | spec `ola0-09a` |
| 5 | report `ola0-01` | `converse.integration.ts`: el primer test de OA02 restaura la autonomía fuera de `finally` | spec `ola0-09a` |
| 6 | report `ola0-01` | Un test de integración de #313 lee `public.executions where id = $1` sin filtro de organización (solo test) | spec `ola0-09a` |
| 7 | report `ola0-11` | Barrer en los demás `*.integration.ts` del worker el patrón «leer el log justo después del cambio de estado» | spec `ola0-09a` |
| 8 | report `ola0-03` | Un `import` a media hoja en `apps/worker/src/ingress/ingest.ts:65` | spec `ola0-09a` |
| 9 | report `ola0-04` | El runbook del simulacro no dice expresamente «staging está en Free» | spec `ola0-09b` |
| 10 | report `ola0-04` | Faltan negativos en el harness del simulacro: filas por tabla, número de políticas, migraciones, fases de preparar y restaurar; el harness hereda `set -e` | spec `ola0-09b` |
| 11 | Lead, corrida real 45676891616 | Dos líneas sin explicar en el log del Postgres desechable: `password authentication failed for user "postgres"` (41 veces) y `role "supabase_realtime_admin" does not exist` | spec `ola0-09b` |

## Para M2 (no caben en una limpieza)
| # | De dónde sale | Qué | Destino propuesto |
| --- | --- | --- | --- |
| 12 | report `ola0-01` (`reviewer` sobre #317) | `valid_reply_edit` usa `btrim` y cuenta code points; Zod `.trim()` cuenta unidades UTF-16. Un texto de solo saltos de línea, o uno largo con emojis, pasa la base de datos y falla en el worker; falla seguro, pero nadie avisa a la persona | spec nueva de M2 (OA02) |
| 13 | report `ola0-01` | Si la aprobación llega con `execution` nula, la web se salta la comprobación de hora pasada; la guarda de la base de datos (BK001) la sigue bloqueando | fila OA02 de `scope.yaml` (nota) |
| 14 | report `ola0-02` | El freno de envíos de la base de datos tiene su propio `interval '15 minutes'` (migración `20261124100000`), distinto del plazo `KEY_SUBMISSION_TTL_MS` | fila int-koibox de `scope.yaml` (nota) |
| 15 | report `ola0-03` | Un tope de 3 s en la consulta a DBOS sale como `backfill: fail`, igual que un relleno aparcado; el runbook lo distingue | fila W3 de `scope.yaml` (nota) |

## Del Lead, en el PR de docs de la fase (#345)
| # | Qué | Estado |
| --- | --- | --- |
| 16 | Fila de `scope.yaml` para el control 3.2 (#331, #336) | pendiente |
| 17 | Fila `MNT-01` de `scope.yaml` (#324, #325; #281 la traía) | pendiente |
| 18 | Filas SE14–SE18 y la condición «Supabase Pro antes del primer dato real» (texto en el report de `ola0-05`) | pendiente |
| 19 | Poner al día PL-prod, OPS-01, int-koibox, OA02, OA03 y N-01 en `scope.yaml` | pendiente |
| 20 | `docs/PLAN.md`: la numeración `ola0-06…` no coincide con las specs y no menciona #312 | pendiente |
| 21 | `docs/specs/ola1-01-podar-toolkit.md` sigue proponiendo borrar skills | pendiente |
| 22 | `docs/STATUS.md` en 60 líneas o menos | pendiente |
| 23 | Mover «Comandos» de `CLAUDE.md` a `docs/COMMANDS.md` (aplazado hasta después de `ola0-05`) | spec para la Ola 1 |

## De Diego
| # | Qué | Para qué |
| --- | --- | --- |
| 24 | Visto bueno a que #317 lleve el arreglo de «reserva pasada» | mergear #317 y lanzar `ola0-06` (#312) |
| 25 | #334: dos archivos fuera de la spec y `/health` 503 con un relleno aparcado | mergear #334 |
| 26 | Cerrar #281 (todo está ya en `main`) y #302 (#293 ya entró) | cerrar la cola |
| 27 | Que la regla de ramas del entorno `staging` de GitHub solo admita `main` | proteger los secretos de staging |
| 28 | Resto de `docs/specs/ola0-08-prs-en-espera-de-decision.md`: #196, #339, #271, #260, #270, #159, #160; timeout del job e2e | cerrar la cola |
| 29 | Rama `claude/export-skills-visibles` del toolkit: borrarla en GitHub (la sesión no puede) | orden |

## Para la Ola 1 (ya en `docs/PLAN.md`)
- El puerto 54322 ocupado en el runner («Supabase local (mínimo)»): volvió a pasar el 2026-11-25 en #348; un relanzamiento lo resolvió.
- La puerta 2 de M1 (una organización UE completa un turno) no tiene spec ni dueño.

## Descartado
| # | Qué | Motivo |
| --- | --- | --- |
| — | Hallazgo medio de la Revisora sobre #338 (el aviso de caducado no saldría si el envío ya se borró) | No es real: el estado se lee del marcador de la integración, no de la tabla de envíos (`reviewer`, 2026-11-25) |
| — | Notas bajas del `reviewer` sobre #348 (pino asíncrono; un `finally` puede tapar el error original) | El worker las razonó en su report; no cambian el resultado del test |
