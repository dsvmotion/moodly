# Report ola0-05: Docs del cierre de V1 (CLAUDE.md/AGENTS.md, runbook de KMS)

Spec: docs/specs/ola0-05-docs-cierre-v1.md · Date: 2026-11-25 · Branch/PR: `task/ola0-05-docs-cierre-v1` · PR: #347 (https://github.com/dsvmotion/moodly/pull/347)

## Result: PASS (con una salvedad: `pnpm test` corrido con Node 22, no con el 24 del repo)

Mi parte: pasos 1, 2, 3 y 6 de la spec. Los pasos 4 y 5 (`docs/scope.yaml`, `docs/STATUS.md`) son del Lead: abajo va el texto listo para copiar. No he tocado esos dos archivos.

**Línea de estado para STATUS.md:** `ola0-05` (parte del worker): CLAUDE.md/AGENTS.md al día con las variables de Nango, Koibox y AWS KMS (worker y web) y con los workflows «Staging · WhatsApp» y «Staging · simulacro de restauración»; runbook de KMS comprobado contra el código. Construido, **sin verificar en real**: WhatsApp (sin corrida con Meta) y KMS (sin claves). El simulacro de restauración ya tuvo su primera corrida real contra staging el 2026-11-25 (dato del Lead).

## Acceptance criteria
| Criterion | Pass/Fail | Evidence |
| --- | --- | --- |
| `diff CLAUDE.md AGENTS.md` vacío | Pass | `cp CLAUDE.md AGENTS.md` y `diff CLAUDE.md AGENTS.md` sin salida |
| `pnpm test` verde | Pass (Node 22) | `pnpm install --frozen-lockfile` y `pnpm test`: `Tasks: 20 successful, 20 total` (worker 355 tests, web 515, integrations 272, evals 318, db 99, agent-core 276, skills 82). La imagen trae Node v22.23.5 y el repo pide ≥24 (aviso de engine): **sin verificar con Node 24 en local**, lo cubre el CI del PR. `pnpm docs:status --check`: «docs/scope.yaml es válido.» |
| Ningún valor de secreto, ARN real ni id de cuenta | Pass | Solo nombres de variable y de workflow. Sin URLs internas nuevas |
| Cada nombre escrito existe en el código | Pass | Ver «Comprobación de nombres» |

## Qué cambia en las reglas (zona sensible: solo añade)
`CLAUDE.md` y `AGENTS.md` (idénticos). No se quita ni se relaja ninguna regla; el diff solo amplía líneas de «Comandos»:
1. **«Worker en staging (W2)»**, tras la frase de WhatsApp: `NANGO_API_KEY` + `NANGO_WEBHOOK_SIGNING_KEY` (+ `NANGO_HOST` opcional), `KOIBOX_API_BASE` (opcional), el bloque de AWS KMS (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SECRET_VAULT_KMS_KEY_ID`, `INTEGRATION_INGRESS_KMS_KEY_IDS`; todas o ninguna; nunca a la vez que las locales), las locales de desarrollo (`SECRET_VAULT_LOCAL_KEY`, `INTEGRATION_INGRESS_LOCAL_PRIVATE_KEY`) y las de la web (`INTEGRATION_INGRESS_PUBLIC_KEY`, `INTEGRATION_INGRESS_KEY_REF`, `NANGO_API_KEY`, `NANGO_HOST`). Dice que las claves de AWS solo viven en el worker.
2. Dos comandos nuevos: «Staging · WhatsApp» (`staging-whatsapp.yml`, acciones `setup` y `check`, runbook `docs/runbooks/whatsapp-staging.md`, «construido, sin verificar en real») y «Staging · simulacro de restauración» (`staging-restore-drill.yml`, solo desde `main`; la primera corrida real contra staging fue el 2026-11-25 (resultado y tiempos en la tabla del runbook, sin el id ni cifras en las reglas); harness local `bash scripts/supabase/tests/restore-drill.test.sh`, necesita Docker, Supabase local y seed, no corre en el CI; runbook `docs/runbooks/simulacro-de-restauracion.md`).

No he metido la frase de `eval:intents` de #260 (decisión pendiente de Diego).

## Comprobación de nombres (contra el código)
- `apps/worker/src/config.ts`: `NANGO_API_KEY`, `NANGO_WEBHOOK_SIGNING_KEY`, `NANGO_HOST`, `KOIBOX_API_BASE` (por defecto `https://api.koibox.cloud`, https o http en loopback), `AWS_REGION` (solo `eu-central-1`), `SECRET_VAULT_KMS_KEY_ID` (ARN, no alias), `INTEGRATION_INGRESS_KMS_KEY_IDS` (coma, como mucho dos, distintas de la de SecretVault), `SECRET_VAULT_LOCAL_KEY`, `INTEGRATION_INGRESS_LOCAL_PRIVATE_KEY`. `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` se exigen cuando hay KMS (`config.test.ts`). «Las dos claves o ninguna» y «nunca a la vez que las locales» salen de `config.test.ts` (líneas 96–99).
- Nango: con una sola de las dos claves, `nango` queda en `null` (no se monta `/webhooks/nango`; no es un error de arranque). Lo he escrito así.
- Web: `apps/web/src/lib/integrations/key-ingress.ts` (`INTEGRATION_INGRESS_PUBLIC_KEY`, `INTEGRATION_INGRESS_KEY_REF`) y `platform.ts` (`NANGO_API_KEY`, `NANGO_HOST`). `apps/worker/scripts/local-env.ts` escribe las dos locales: por eso cito `env:local`.
- Workflows: `.github/workflows/staging-whatsapp.yml` (acciones `check`/`setup`, `if: github.ref == 'refs/heads/main'`), `staging-restore-drill.yml` (`if: github.ref == 'refs/heads/main'`); los dos existen en `main`.
- No he listado `RAILWAY_GIT_COMMIT_SHA` ni `PORT` nuevos: el primero lo pone Railway y `PORT` ya estaba.

## Paso 3: runbook de KMS (`docs/runbooks/kms-staging.md`)
**Sin cambios: ya estaba corregido.** #337 (`aa79e63`) ya cambió el paso 4 a `INTEGRATION_INGRESS_KMS_KEY_IDS` (plural, lista separada por comas) y la rotación ya dice «`<ARN viejo>,<ARN nuevo>`» y vuelve a un solo ARN al final. `grep -rn "INTEGRATION_INGRESS_KMS_KEY_ID\b" docs apps packages` no devuelve nada fuera de la propia spec. También comprobé las frases del paso 6 contra el código: `claves de integraciones con AWS KMS` (`apps/worker/src/main.ts:68`) y `integrations.key_applied` (se emite como ``integrations.key_${outcome}`` en `key-submission.ts:384`, con `outcome = "applied"`). No toqué el archivo.

## Hallazgos de la Revisora automática sobre `8f4ded1` (COMMENT, sin aprobar: zona sensible)
1. **medium, `AGENTS.md:102`**: la frase quita «sin verificar en real» y no dice si la corrida salió en verde; remite a una tabla que en `main` seguía «pendiente». **Real en ese commit; resuelto** al rellenar la fila de staging en este PR (la corrida 45676891616 desde `c0707e1` terminó `RESULTADO: OK`, 109 s; recuentos y tiempos comprobados contra su log).
2. **medium, `CLAUDE.md:102`**: el mismo cambio en el espejo, afirmaba una corrida «por dato del Lead» sin evidencia en el diff. **Real; resuelto** por lo mismo: la evidencia ahora está en el diff, en la tabla del runbook.
3. **low, report línea 63**: el report decía que el runbook de `main` seguía en «pendiente». **Real; resuelto** (esa frase ya no aplica).
Queda un resto fuera de mi alcance: la línea 46 del runbook («Hasta entonces la puerta **no** está cumplida») sigue diciendo que falta la corrida. Por indicación del Lead no la toqué; conviene reescribirla en el PR de cierre de fase.

## Files changed
- `CLAUDE.md`, `AGENTS.md` (idénticos)
- `docs/runbooks/simulacro-de-restauracion.md` (solo la fila de staging de la tabla «Resultado», a petición del Lead: corrida 45676891616; comprobé recuentos y tiempos contra el log real de la corrida)
- `docs/reports/ola0-05-docs-cierre-v1.md`

## Deviations from spec (and why)
- Pasos 4 y 5 no hechos por mí: son del Lead (instrucción del Lead de la Ola 0).
- Paso 3 sin cambios: el runbook ya tenía la corrección (#337).
- Añadí `NANGO_WEBHOOK_SIGNING_KEY` (la spec solo citaba `NANGO_API_KEY` para el worker): sin ella el worker no monta el webhook de Nango.

## Texto propuesto para el Lead (para copiar)

### Filas nuevas de `docs/scope.yaml` (SE14–SE18), tras SE13
El formato es el de SE13 (`{id, name, milestone, owner, status, evidence, note}`). Los hitos y responsables salen de `docs/design/seguridad-objetivo.md` (tabla «Unidades nuevas propuestas»). Todas `planned`, sin evidencia.

```yaml
      - {id: "SE14", name: "Customer cloud and on-premise (Helm) deployment, on ADR 0028", milestone: "after", owner: "V1", status: "planned", evidence: [], note: "Depende de producto (plan Enterprise). Se cierra con una instalación de prueba en una cuenta limpia siguiendo solo la documentación y una actualización de versión sin perder datos. docs/design/seguridad-objetivo.md"}
      - {id: "SE15", name: "Public subprocessor list with change notices", milestone: "M3", owner: "V3", status: "planned", evidence: [], note: "Con V13; depende de la asesoría legal (F10). Se cierra con la página publicada desde un único registro, enlazada desde privacidad y DPA, y el procedimiento de aviso probado una vez"}
      - {id: "SE16", name: "Integrations mirror the source tool's permissions 1:1", milestone: "after", owner: "V1", status: "planned", evidence: [], note: "Depende de producto (qué integraciones) y de O-02. Se cierra con tests en negativo con una cuenta real: un documento sin permiso no aparece en la búsqueda ni en las respuestas"}
      - {id: "SE17", name: "Optional product analytics, off by default", milestone: "after", owner: "V2", status: "planned", evidence: [], note: "Si se construye: test de que sin consentimiento no se envía nada; si no, la afirmación «sin analítica de terceros» comprobada en la CSP"}
      - {id: "SE18", name: "Security monitoring and incident response", milestone: "M3", owner: "V1", status: "planned", evidence: [], note: "Depende de producción (PL-prod) y de la asesoría (plazos de aviso). Se cierra con alertas probadas con un evento provocado en producción y un simulacro de incidente con su registro"}
```

(Si el responsable de las filas ya no se escribe «V1/V2/V3», ajusta al valor que usen las filas vecinas; mira `owner:` de SE12/SE13.)

### Condición de «Supabase Pro» para `docs/STATUS.md` (condiciones de salida a producción)
Va en la línea «Antes del primer dato real» (hoy empieza por «Supabase Pro, lista completa…») y en el bloque Bloqueado, junto a «Restauración completa de Supabase desde el panel»:

> **Supabase Pro (backups diarios) en staging y producción antes del primer dato real.** Hoy staging está en Free (Diego, 2026-11-24): no hay copias diarias ni PITR, y la restauración completa desde el panel no se puede probar hasta pasar a Pro. Lo único probado es el simulacro con volcado propio (`Staging · simulacro de restauración`, PL-prod), con una primera corrida real desde `main` el 2026-11-25 (dato del Lead; la fila de staging del runbook la rellena este mismo PR).

### Filas a poner al día (de la spec; las decide el Lead)
`PL-prod` (evidencia #330 y la corrida real del 2026-11-25 que da el Lead), `OPS-01` (#293/#302 según decida Diego), `int-koibox` (#329, #333, #335, #337, #338: «construido, sin verificar en real»; falta una cuenta real de Koibox, claves de KMS y Nango), `OA02` (#313, #317), `OA03` (#315, lectura), `N-01` done (#311). No he verificado los estados actuales de esas filas ni de esos PRs: no estaban en mi alcance.

## Follow-ups for the lead (max 3)
- Contrastar con el CI del PR: este entorno solo tiene Node 22 (`pnpm test` pasó igualmente).
- `NANGO_WEBHOOK_SIGNING_KEY` ahora está en las reglas pero no en `docs/runbooks/kms-staging.md` ni en ningún runbook de Nango; si hay un runbook de Nango, convendría citarla allí (no lo he buscado: fuera de alcance).
- La frase de `eval:intents` (#260) sigue pendiente de Diego.
