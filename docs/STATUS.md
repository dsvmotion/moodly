# Status (≤60 líneas; lo terminado vive en docs/reports/)

Fase / ola actual: Ola 0, integración (docs/PLAN.md) · Lead de la Ola 0 desde el 2026-11-25 · main `e504000` (#347)
Historial completo anterior: `docs/reports/2026-11-24-status-anterior.md` · Cierre de V1: `docs/reports/2026-11-24-cierre-v1.md`

## Handoff (para el próximo lead)
- Lee antes: `docs/reports/2026-11-25-panorama.md` (contexto) y `docs/reports/ola0-followups.md` (seguimientos y su destino). PR de docs de la fase: #345 (borrador hasta el cierre).
- Hecho el 25-11: 13 PRs en `main` (lista en `docs/PLAN.md`, Ola 0). **Puerta 3 de M1 cumplida** (simulacro real, [corrida 45676891616](https://github.com/dsvmotion/moodly/actions/runs/45676891616)). CI de `main` y «Despliegue a staging» en verde sobre `e504000`, el último commit (21:25 UTC).
- `main` en rojo dos veces, las dos resueltas: `677a813` (test intermitente de la ingesta, arreglado en #348) y `102987d` (puerto 54322 ocupado en el runner, paso «Supabase local (mínimo)»; el commit siguiente pasó).
- En vuelo: nada. Ningún worker en marcha. Sin archivar: `ola0-01` (session_016SLeJRETZZKuCE4L1VuebH, #317) y `ola0-03` (session_016SLeJPsPktFVp4HZsQo7wk, #334).
- **Primero, preguntas para Diego:** (1) ¿#317 lleva el arreglo de «reserva pasada»? (comentario 7168631756 del PR); (2) ¿#334 con dos archivos fuera de spec y `/health` 503 con un relleno aparcado?; (3) ¿cerrar #281 y #302?; (4) ¿adelantar a esta fase el arreglo del puerto 54322?; (5) el resto de `ola0-08`.
- Con (1) y (2): poner al día y mergear #317 y #334, lanzar `ola0-06` (#312), y después `ola0-09a` y `ola0-09b` (specs escritas). Luego, cierre de fase: `scope.yaml`, STATUS y PLAN (filas 16–23 de los seguimientos).
- Cómo: `docs/specs/ola0-00-como-mergear.md`. Sacar de borrador: ruta REST `ccr/ready_for_review`. No listar las corridas de `main` con el conector (salida enorme): usar un subagente.

## a) Ola 0 — integración (en orden)
| # | PR | Estado | Le falta |
| --- | --- | --- | --- |
| 1 | #313 aprobaciones: detalle | CI verde, V10 OK (40a3fe6) | update-branch, re-OK del merge, merge (`ola0-01`) |
| 2 | #317 aprobaciones: editar | CI verde, V10 OK (6f42eff); migración 20261124120000 | tras #313: igual; reviewer completo (`ola0-01`) |
| 3 | #336 test estructural 3.2 | CI verde, V10 OK (cd32992) | update-branch y merge (`ola0-01`) |
| 4 | #338 Koibox «caducado» | V10 OK (d9a44fa) | una sola constante de TTL en el worker tras #337, CI, merge (`ola0-02`) |
| 5 | #334 relleno del outbox | CI verde, V10 OK (8799dd4); cambia una aserción a propósito | 2 notas menores de V10 (aviso en /health o runbook; warn del `since`); ok de Diego a la aserción (`ola0-03`) |
| 6 | #330 simulacro de restauración | head 0bd6533; V10 OK solo hasta cb61562 | revisión de 4decb81..0bd6533, merge, corrida real en staging (`ola0-04`) |
| 7 | PR de docs del cierre | por abrir | variables KMS/Koibox/ingreso en CLAUDE.md/AGENTS.md, comandos nuevos, SE14–SE18, «Supabase Pro antes de datos reales», runbook KMS (`ola0-05`) |
| 8 | #312 CU3 pendientes vigentes | borrador (eb90b79), sin revisión | update-branch, reviewer, evals reales tras merge (`ola0-06`) |
| 9 | #324, #325 Dependabot; #281 deps | V10 OK en #324/#325; CI caído el 23-11 | relanzar CI y merge; #281 comparar con #326 (`ola0-07`) |

## b) Decisiones para Diego
- **#293 vs #302** (ambos aceleran la integración del worker en CI, ~14 → ~7 min): #293 midió en CI el e2e entero 28–29 → 19–23 min y su espera nueva es más estricta (prueba en negativo); #302 midió 23m52s frente a 25–29. Recomendación de V1: **#293** (más medido y con la prueba en negativo), cerrar #302.
- **Timeout del job e2e:** 45 → 30–35 min (con #293 el e2e tarda 19–23 min).
- **#196** (modelo de precios 149/399/200 € por sede): ¿entra? Si sí, quitar el nombre de modelo de la línea `Co-Authored-By` al hacer squash.
- **#339** (`docs/decks/`, fuentes de los dos decks): ¿viven en el repo? Es la única copia aparte de los artefactos publicados.
- **#271** (borradores legales): ¿entran como borradores o se quedan en la rama hasta el abogado? · **#260** (frase `eval:intents`): ¿sí o cerrar? · **#270** (umbral `complex`): correr `eval:intents` real antes. · **#159** (skill `ask_team`, CU2): rehacer sobre main · **#160**: superado, ¿cerrar?
- **Agente de lanzamiento y redes (GTM):** ¿se arranca? Si sí: repos de diseño/motion/UX que usará, sector y país de inicio; no hay conectores de Instagram/LinkedIn/Threads/X y cada publicación la aprueba una persona.
- **Producto abierto:** email y dominio de contacto de los decks; reparto entre cofundadores; términos de la nota de 200.000 €.
- **Toolkit:** decidido (2026-11-25): no se borra ninguna skill; 20 visibles, 54 ocultas con índice y sin hook de arranque (`docs/reports/ola1-01-podar-toolkit.md`). El script está en el `main` del toolkit (`1b6cb02`) y una sesión real desde `677a813` lo confirmó: lista las 20 visibles, arranca sin el texto del hook y usa una oculta desde el índice.
- **Heredadas** (Realtime público, Fluid de Vercel, mensaje del sistema en el paso a persona, bandeja, marca, `/app-movil`, lote C de reservas…): report de cierre §5.

## c) Tareas manuales de Diego
- Claves KMS y usuario IAM (`docs/runbooks/kms-staging.md`; la variable del worker es `INTEGRATION_INGRESS_KMS_KEY_IDS`, en plural).
- App de Outlook en Entra (`docs/runbooks/outlook-azure.md`).
- Cuenta Koibox Platinum para la prueba real.
- Prueba real de WhatsApp (`docs/runbooks/whatsapp-staging.md`): hoy bloqueada por el acceso a Meta.
- Aprobar en staging una respuesta corregida y verla llegar (tras #317).
- Verificar OA04 en staging (`docs/runbooks/oa04-verificar-en-staging.md`) y la bandeja en vivo (M-10, 2 min).
- Restauración completa de Supabase desde el panel (necesita Pro; staging en Free).
- Textos legales F06 con un abogado (#271). Confirmación escrita de no-entrenamiento del AI Gateway (o Enterprise) antes de datos reales.
- Comprobar que el despliegue de `main` desde git de Vercel está apagado (`git.deploymentEnabled`).
- Antes del primer dato real: Supabase Pro, lista completa de zonas sensibles + revisión humana + F03, DPAs (F10), Nango autoalojado en la UE.

## d) Construido, no verificado en real
WhatsApp (gate 1 de M1) · Outlook · Google Calendar: reservar contra ocupado y fallo real · Koibox de punta a punta · worker con KMS · OA02 aprobar con edición · OA04 en staging · OA03 agenda · CU3 por WhatsApp · M-10 bandeja en vivo · alerta de despliegue FAILED/atascado · relleno del outbox en staging · enrutado por intención (apagado) · avisos por email de tope y de aprobaciones. Detalle: report de cierre §3.

## e) Notas
- CI: el e2e a veces muere en «Supabase local (mínimo)» con el puerto 54322 ocupado, antes de ningún test; se arregla relanzando una vez. Si GitHub lo cancela por concurrencia del mismo PR, cancelar la corrida vieja y relanzar.
- Verificado hoy: evals con modelo real en main 70/70 (0,86 €); main 9c41ef6: pgTAP 2031, worker 172, e2e 258; alerta «staging caído» cerrada. Sobre aa79e63 (#337) solo el CI de main (verde) y el despliegue: la verificación local completa se cortó por un reinicio de la sesión (llegó a check y pgTAP 2031 en verde).
- `protect-secrets.py` no protege `packages/db/.seed/credentials.local.json`: ampliarlo (Ola 1).
- Más lecciones (REST en vez de GraphQL, Docker en la sandbox, reinicios): report de cierre §4.
