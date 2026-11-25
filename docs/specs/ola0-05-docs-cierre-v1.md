# ola0-05: PR de docs del cierre de V1 (CLAUDE.md/AGENTS.md, scope.yaml, STATUS)

Phase / wave: Ola 0
Model: Sonnet · Effort: Medium
Can run in parallel with: preparación del resto; merge en serie. Hacerlo **después** de que entre `chore/workflow-kit` (toca los mismos archivos).

## Goal
Llevar al repo lo que quedó apuntado por el lead V1 y no está escrito en las reglas: variables nuevas del worker y de la web, comandos nuevos, las filas SE14–SE18 y la condición «Supabase Pro antes del primer dato real».

## Read only these
- CLAUDE.md (= AGENTS.md: los dos idénticos, se cambian en el mismo PR)
- docs/scope.yaml (filas SE*, OA*, OPS-01, F05, int-koibox, PL-prod)
- docs/design/seguridad-objetivo.md (define SE14–SE18)
- docs/runbooks/kms-staging.md

## Touch only these
- CLAUDE.md y AGENTS.md (idénticos), docs/scope.yaml, docs/STATUS.md, docs/runbooks/kms-staging.md

## Steps
1. **CLAUDE.md/AGENTS.md → Comandos → «Worker en staging»**, añadir a la lista de variables (texto a adaptar):
   - `KOIBOX_API_BASE` (opcional; `https://api.koibox.cloud` por defecto; solo https, o http en loopback).
   - AWS KMS (ADR 0034/0055, #337): `AWS_REGION` (solo `eu-central-1`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SECRET_VAULT_KMS_KEY_ID` (ARN completo) e `INTEGRATION_INGRESS_KMS_KEY_IDS` (lista de ARN aceptados, separados por comas; dos durante una rotación). Todo o nada: a medias, el worker no arranca. Sin ellas, en dev usa `SECRET_VAULT_LOCAL_KEY` / `INTEGRATION_INGRESS_LOCAL_PRIVATE_KEY`.
   - Web (Vercel): `INTEGRATION_INGRESS_PUBLIC_KEY` (SPKI DER en base64) e `INTEGRATION_INGRESS_KEY_REF` (ARN o `local:v1`); `NANGO_API_KEY` (+ `NANGO_HOST` opcional). La web nunca recibe credenciales de AWS.
2. **Comandos** nuevos: «Staging · WhatsApp» (`.github/workflows/staging-whatsapp.yml`, acciones `setup` y `check`; runbook `docs/runbooks/whatsapp-staging.md`) y, cuando #330 esté en main, «Staging · simulacro de restauración» (`staging-restore-drill.yml`; harness local `bash scripts/supabase/tests/restore-drill.test.sh`, necesita Docker).
3. Corregir `docs/runbooks/kms-staging.md` paso 4: la variable del worker es `INTEGRATION_INGRESS_KMS_KEY_IDS` (plural, lista), no `INTEGRATION_INGRESS_KMS_KEY_ID`; en la rotación, la lista lleva vieja y nueva.
4. **docs/scope.yaml**: adoptar las filas que propone #328 (texto en `docs/design/seguridad-objetivo.md`):
   - `SE14` Customer cloud + on-prem/Helm · after · V1 · planned
   - `SE15` Public subprocessor list with change notices · M3 · V3 · planned
   - `SE16` Integrations mirror the source tool's permissions 1:1 · after · V1 · planned
   - `SE17` Optional analytics, off by default · after · V2 · planned
   - `SE18` Security monitoring and incident response · M3 · V1 · planned
   y poner al día: `PL-prod` (evidencia #330 y la corrida real cuando exista), `OPS-01` (#293/#302 según decida Diego), `int-koibox` (#329, #333, #335, #337, #338: construido, sin verificar en real), `OA02` (#313, #317), `OA03` (#315 lectura), `N-01` done (#311).
5. **docs/STATUS.md → condiciones de salida a producción**: «Supabase Pro (backups diarios) en staging y producción antes del primer dato real; hoy staging está en Free (Diego, 2026-11-24)».
6. `pnpm test` (valida scope.yaml) y `diff CLAUDE.md AGENTS.md`.

## Acceptance criteria
- [ ] `diff CLAUDE.md AGENTS.md` vacío.
- [ ] `pnpm test` verde (el test del registro lee todas las filas, sin ids repetidos).
- [ ] Ningún valor de secreto, ARN real ni id de cuenta en el PR (solo nombres de variable).

## Verify commands
```
diff CLAUDE.md AGENTS.md && pnpm test && pnpm docs:status | head -20
```

## Revisión del agente reviewer
- Ligera: CLAUDE.md/AGENTS.md son zona sensible; comprobar que solo añaden y no relajan ninguna regla.
