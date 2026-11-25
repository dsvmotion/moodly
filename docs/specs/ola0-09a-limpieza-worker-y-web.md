# ola0-09a: limpieza de la Ola 0, worker y web

Phase / wave: Ola 0 (última subfase, con `ola0-09b`)
Model: Opus · Effort: High
Skills: `test-driven-development`, `verification-before-completion`
Reviewer required: yes (toca el worker y la tarjeta del alta de claves)
Can run in parallel with: `ola0-09b`. **Solo cuando #317, #334 y #312 estén en `main`**: comparten `converse.integration.ts`, `ingest.ts` y `worker.ts`.

## Goal
Cerrar los seguimientos pequeños que dejaron los reports, el agente `reviewer` y la Revisora automática durante la Ola 0 (filas 1–8 de `docs/reports/ola0-followups.md`), sin cambiar comportamiento de producto salvo el punto 1.

## Read only these
- docs/ARCHITECTURE.md, docs/reports/ola0-followups.md (filas 1–8)
- apps/web/src/app/app/settings/integrations/key-integration-card.tsx y key-actions.ts (misma carpeta)
- apps/web/src/lib/integrations/key-check.ts, key-flow.ts, key-flow.test.ts
- apps/worker/src/integrations/key-submission.ts (cabecera y línea ~92)
- apps/worker/src/worker.ts (la opción `schedulesTesting`)
- apps/worker/src/agents/converse.integration.ts
- apps/worker/src/ingress/ingest.ts (línea ~65)

## Touch only these (create / edit)
- apps/web/src/app/app/settings/integrations/key-integration-card.tsx
- apps/web/src/lib/integrations/key-flow.test.ts (o el test que ya cubra el sondeo)
- apps/worker/src/integrations/key-submission.ts (solo comentarios)
- apps/worker/src/worker.ts (solo el comentario de `schedulesTesting`)
- apps/worker/src/agents/converse.integration.ts
- apps/worker/src/ingress/ingest.ts (solo mover el `import`)
- docs/reports/ola0-09a-limpieza-worker-y-web.md

## Steps (checkpoint after each)
1. **Tarjeta de Koibox.** Hoy, si `keySubmissionStatus` devuelve `null` (error de base de datos, sesión sin segundo factor) o lanza, el sondeo se para y la tarjeta se queda en «comprobando» con el campo desactivado hasta recargar. Que reprograme el sondeo (con un tope de intentos) o que enseñe un estado «no disponible» y deje el campo usable. Test primero: uno que falle hoy.
2. **Test que falta:** «el envío ya se borró y después se sondea» → la tarjeta llega a «no se pudo comprobar a tiempo». Hoy pasa (el estado se lee del marcador de la integración); el test lo fija.
3. `key-submission.ts`: los dos comentarios con «15 min» a mano citan `KEY_SUBMISSION_TTL_MS`.
4. `worker.ts`: el comentario de `schedulesTesting` dice que las programaciones se guardan en la base de sistema de DBOS y que un worker de test nunca debe apuntar a una base compartida.
5. `converse.integration.ts`: el primer test de OA02 restaura la autonomía en un `finally`; la lectura de `public.executions where id = $1` lleva además el filtro de organización.
6. `ingest.ts`: el `import` de media hoja, arriba con los demás.
7. **Barrido, sin arreglar:** busca en los demás `apps/worker/src/**/*.integration.ts` el patrón que rompió `ingest.integration.ts` (leer `worker.output()` justo después de esperar un cambio de estado, sin esperar a que termine la entrega). Lista en el report cada caso con archivo y línea. No los toques: si hay alguno, el Lead abre spec.
8. `reviewer` (model "opus"), un push con el report, CI verde, PR fuera de borrador.

## Acceptance criteria (checkable)
- [ ] El test nuevo del paso 1 falla sin el cambio (salida en el report) y pasa con él.
- [ ] El test del paso 2 pasa y falla si la tarjeta deja de leer el reloj del navegador (prueba en negativo en el report).
- [ ] `git grep -n "15 min" apps/worker/src/integrations/key-submission.ts` vacío.
- [ ] Ninguna aserción existente cambia; las líneas `expect(` de cada archivo de test son las mismas o más.
- [ ] El report lista el resultado del barrido del paso 7 (o «ninguno»).
- [ ] Los 5 checks obligatorios en verde sobre el head.

## Verify commands
```
pnpm --filter @repo/web test
pnpm --filter @repo/worker test
pnpm db:start && pnpm db:reset && pnpm db:seed
pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker test:integration
pnpm --filter @repo/web e2e -- integrations-koibox
```

## Out of scope
- El desajuste `btrim`/Zod de las respuestas corregidas y avisar a la persona cuando la ejecución falla (M2, OA02).
- El freno de envíos de la base de datos y su `interval '15 minutes'`.
- Cualquier caso que encuentre el barrido del paso 7.

## Notes / decisions already made
- Rama `task/ola0-09a-limpieza-worker-y-web`, PR nuevo, título `[M0][P-08] Limpieza de la Ola 0: tarjeta de Koibox, comentarios y tests del worker`.
- Koibox sigue «construido, sin verificar en real».
- No mergea el worker: mergea el Lead (docs/WORKFLOW.md).
