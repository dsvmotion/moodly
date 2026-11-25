# ola0-02: Koibox, «no se pudo comprobar a tiempo» (#338) y un solo TTL

Phase / wave: Ola 0 · M2 (int-koibox, ADR 0055)
Model: Sonnet · Effort: Medium
Can run in parallel with: preparación de ola0-01/03/04; merge en serie.

## Goal
Cerrar el incremento 2 de Koibox: la tarjeta avisa cuando un envío de clave caduca (#338, V15) y el plazo de 15 min tiene una sola fuente (`KEY_SUBMISSION_TTL_MS` de `@repo/config`), también en el worker.

## Estado al cierre (2026-11-24)
- #338, rama `v15/koibox-caducado`, head `d9a44fa`, borrador. V10 OK (la clave nunca va a sessionStorage, DOM ni URL; solo `{submissionId, sentAt, wasActive}`). CI: e2e aún corriendo al cierre.
- Falta (nota baja L1 de V10): el worker sigue con su propia `SUBMISSION_TTL_MS` (`apps/worker/src/integrations/key-submission.ts`, ~línea 49) y la comprobación «fresh» del SQL la usa. #337 ya está en main (aa79e63).

## Read only these
- docs/ARCHITECTURE.md, docs/specs/ola0-00-como-mergear.md
- apps/worker/src/integrations/key-submission.ts
- packages/config/src/index.ts (`KEY_SUBMISSION_TTL_MS`)

## Touch only these
- apps/worker/src/integrations/key-submission.ts (importar la constante de `@repo/config`, pasarla como parámetro al SQL del «fresh»)
- su test unitario si fija el valor

## Steps
1. En la rama de #338: `git merge origin/main` (sin rebase).
2. El worker importa `KEY_SUBMISSION_TTL_MS`; borrar la constante local; el SQL recibe el TTL como parámetro (`$n`), sin literal.
3. Tests: `pnpm --filter @repo/worker test` y `key-submission.integration.ts` (con Supabase y seed). Un push.
4. Reviewer: diff mínimo; merge según ola0-00.

## Acceptance criteria
- [ ] `git grep -n "SUBMISSION_TTL_MS" apps/worker` solo muestra el import de `@repo/config`.
- [ ] Integración `key-submission` verde (27/27 o más) y e2e de Koibox (7/7).
- [ ] Merge con CI verde sobre el commit exacto.
- [ ] STATUS: Koibox sigue «construido, sin verificar en real» (faltan KMS en staging y una cuenta Koibox Platinum).

## Verify commands
```
pnpm --filter @repo/worker test
pnpm turbo run build --filter=@repo/worker^... && pnpm --filter @repo/worker exec vitest run --config vitest.integration.config.ts src/integrations/key-submission.integration.ts
pnpm --filter @repo/web e2e -- integrations-koibox
```
(Si el comando de integración de un solo archivo no existe así, usar `pnpm --filter @repo/worker test:integration`.)

## Revisión del agente reviewer
- Sí (secretos de clientes): que el TTL efectivo del worker y de la BD sea el mismo y que nada registre la clave.
