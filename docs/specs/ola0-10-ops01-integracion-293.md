# ola0-10: la integración del worker en CI en la mitad de tiempo (#293)

Phase / wave: Ola 0 · M1 (OPS-01)
Model: Opus · Effort: High
Skills: `systematic-debugging`, `verification-before-completion`
Reviewer required: yes (toca el worker: publicador del outbox, barrido de la entrada y `worker.ts`)
Can run in parallel with: `ola0-02` (#338). **No** con `ola0-03` (#334): los dos tocan `apps/worker/src/events/outbox.ts`.

## Goal
Dejar #293 listo para mergear: la integración del worker en CI pasa de ~14 a ~7 min (el e2e entero, de 28–29 a 19–23 min), y cada merge de la fase espera menos. Decisión de Diego (2026-11-25): entra #293; #302 se cierra cuando #293 esté en `main`.

## Estado (2026-11-25)
- Rama `claude/eloquent-fermi-mhq4p5`, head `3e1e9d5` (13-11), borrador, 11 archivos (+63/−11). CI verde sobre una base vieja.
- **Conflicto con `main`** (`f0e2c07`) en `apps/worker/src/testing/ingress-worker.ts`, `apps/worker/src/worker.ts` y `docs/STATUS.md`.
- Desde el 13-11 han entrado en `main` archivos de integración nuevos (por ejemplo `one-reply`): sus workers de test no tienen todavía el modo rápido.

## Read only these
- docs/ARCHITECTURE.md, docs/specs/ola0-00-como-mergear.md
- el cuerpo y el diff de #293 en GitHub
- apps/worker/src/worker.ts, apps/worker/src/events/outbox.ts, apps/worker/src/ingress/ingest.ts
- apps/worker/src/testing/*.ts

## Touch only these (create / edit)
- los archivos que ya toca #293, **menos `docs/STATUS.md`** (ver Steps 1)
- apps/worker/src/testing/*.ts de los workers de test que entraron después del 13-11, solo para darles el mismo modo rápido
- docs/reports/ola0-10-ops01-integracion.md

## Steps (checkpoint after each)
1. En la rama del PR: `git merge origin/main` (nunca rebase ni force push). Resuelve los tres conflictos. En `docs/STATUS.md` quédate con la versión de `main` entera: la línea de estado va en el report.
2. Comprueba que el modo rápido (`schedulesTesting`: publicador 1 s y barrido 5 s) solo se activa en los workers de test y que el worker real conserva sus tiempos. Dáselo a los workers de test nuevos.
3. Verify commands en local. Mide cuánto tarda la integración del worker antes y después.
4. `reviewer` (model "opus"): que producción no cambia de comportamiento y que la espera nueva («dos barridos contados») sigue fallando en negativo.
5. Un push con el report. CI verde sobre el head; apunta cuánto tardó el job `e2e · Playwright por rol`. PR fuera de borrador.

## Acceptance criteria (checkable)
- [ ] `git diff origin/main...HEAD -- docs/STATUS.md` vacío.
- [ ] Fuera de `apps/worker/src/testing/` y de los tests, el valor por defecto de los tiempos del publicador y del barrido es el de `main`.
- [ ] `pnpm --filter @repo/worker test:integration` verde, con su duración antes y después en el report.
- [ ] Prueba en negativo de la espera nueva: con un solo barrido contado, el test falla. Salida en el report.
- [ ] Los 5 checks obligatorios en verde sobre el head; duración del e2e en el report.
- [ ] Ninguna aserción existente cambiada. Si hace falta cambiar una, no se cambia: se avisa al Lead.

## Verify commands
```
pnpm --filter @repo/worker test
pnpm db:start && pnpm db:reset && pnpm db:seed
pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker test:integration
pnpm check
```

## Out of scope
- El timeout del job e2e en `.github/workflows/ci.yml` (decisión de Diego pendiente).
- #302: lo cierra el Lead cuando #293 esté en `main`.
- El conflicto del puerto 54322 del runner (Ola 1).

## Notes / decisions already made
- #293 frente a #302: gana #293 por estar más medido y por su prueba en negativo (recomendación de V1, aceptada por Diego el 2026-11-25).
- No mergea el worker: mergea el Lead (docs/WORKFLOW.md).
