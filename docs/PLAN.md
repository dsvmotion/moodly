# Moodly AI Agents: plan

Última actualización: 2026-11-24, por la sesión lead V1 (cierre). Lo detallado de cada unidad vive en `docs/scope.yaml` (registro M0–M5, `pnpm docs:status`) y el diseño en `docs/MANUAL.md` + `docs/adr/`.

## Objetivo
Plataforma B2B (marca en `BRAND_NAME`) de agentes de IA que hacen trabajo real dentro de pymes, medianas y cadenas multi-local: cada empresa tiene 4 agentes (`reception`, `customer`, `sales`, `admin`) que conocen el negocio, aprenden (memoria cruzada entre agentes y locales), trabajan contra objetivos y hacen de coach. Para el lanzamiento (piloto, M3): un negocio real de belleza/servicios atiende a sus clientes por WhatsApp y chat web con Recepción y Atención al cliente (huecos, reservas, cambios, recordatorios, lista de espera, respuestas desde su conocimiento, paso a una persona), con el equipo aprobando lo que no es autónomo desde la app, sus calendarios conectados y aislamiento total entre organizaciones.

## Fases (hitos del registro; solo la ola siguiente va detallada en docs/specs/)

### Ola 0: integración de lo abierto · estado: siguiente (specs `docs/specs/ola0-*.md`)
Mergear en orden, con CI verde y revisión, los PRs que quedaron abiertos al cerrar el lead V1 (2026-11-24), sin trabajo nuevo:
- `ola0-01` #313 → #317 → #336 (aprobaciones: detalle y edición; test estructural).
- `ola0-02` #338 + el arreglo de una línea del TTL (una sola constante tras #337).
- `ola0-03` #334 + las dos notas menores de V10.
- `ola0-04` #330, simulacro de restauración: revisión del último commit, merge y corrida real contra staging (cumple la puerta «restore drill» de M1).
- `ola0-05` PR de docs del lead: variables del worker en CLAUDE.md/AGENTS.md, filas SE14–SE18, «Supabase Pro antes de datos reales», hechos de Railway y evals.
- `ola0-06` mantenimiento: Dependabot #324/#325, #281 (deps sin DBOS), #260/#270 (evals PL-T3/K-01), #271 (borradores legales), #339 (fuentes de los decks), según decida Diego.
- Paralelo: ver la tabla de cada spec; el merge es siempre de uno en uno (main exige rama al día).

### Ola 1: podar y estabilizar · estado: después de la Ola 0
- `ola1-01` Podar el toolkit de skills (`docs/specs/ola1-01-podar-toolkit.md`): menos contexto por sesión.
- Ampliar `protect-secrets.py` a `packages/db/.seed/` (hoy no bloquea `credentials.local.json`).
- Decidir #293 vs #302 (tiempo del CI) y el timeout del e2e.
- El conflicto de puerto 54322 del runner de CI: hacerlo robusto (no solo relanzar).

### M1 · Platform spine · estado: en curso
Puertas: (1) un mensaje de WhatsApp por el número de prueba real de Meta y un teléfono real recibe exactamente una respuesta, también con un segundo mensaje a mitad de turno — **construido, sin verificar en real** (bloqueado: acceso de Diego a Meta); (2) una organización UE completa un turno — pendiente de revisar contra la decisión de inferencia global (ADR 0051); (3) simulacro de restauración — #330 (Ola 0); (4) parar el worker de staging levanta una alerta — **hecho** (PL-health, #308, issue #314/#327).
- Pendiente además: KMS en staging (Diego) y prueba real de Koibox; Outlook real; WhatsApp real.

### M2 · Core service in staging · estado: en curso (16 en curso, 20 planificadas)
- RC1–RC6 (huecos, reservar, mover, cancelar, recordatorios, lista de espera) y CU1–CU3 de punta a punta por WhatsApp sandbox.
- Alta del negocio sin SQL (OA04 hecho en la app; verificar en staging con `docs/runbooks/oa04-verificar-en-staging.md`).
- Aprobaciones con detalle y edición (OA02, Ola 0); agenda (OA03 lectura hecha; reservar/mover/cancelar después).
- Evals con modelo real: 3 corridas en verde y check obligatorio (hoy 70/70 en verde, 2026-11-24; aún no obligatorio).

### M3 · Pilot go-live · estado: después
- Checklist de salida a producción (condiciones de STATUS): lista completa de zonas sensibles + revisión humana + F03; DPAs firmados (F10); textos legales (F06, abogado); Supabase Pro con backups; proyecto de producción separado.
- 16 casos de uso en la configuración de producción; sistemas del cliente piloto conectados; primer cliente real.
- Seguridad objetivo nivel Langdock (`docs/design/seguridad-objetivo.md`: SE08 trust page, SE15 subencargados, SE18 monitorización).

### M4 · Pilot complete · estado: después
- Todas las unidades del piloto hechas; medir resolución autónoma, coste por conversación resuelta y valor; revisión del cliente piloto.

### M5 · Full scope · estado: por versión
- Agentes `sales` y `admin`, memoria cruzada completa, coach (ADR 0046), voz, más canales e integraciones (Booksy/Treatwell por acuerdo de socio), SE14 (nube del cliente / on-prem), SE16, SE17.

## Registro de decisiones (lo más nuevo primero)
| Fecha | Decisión | Por qué |
| --- | --- | --- |
| 2026-11-24 | Flujo nuevo lead + workers (este kit): specs y reports en el repo, sesiones cortas | Contextos pequeños; nada vive solo en una conversación |
| 2026-11-24 | Railway pasa a Hobby (fin del trial); clave de evals renovada y presupuesto subido; Actions sin tope | El worker de staging se cayó el 22-11 por el trial; las evals reales fallaban por la clave |
| 2026-11-24 | Supabase sigue en Free hasta antes del primer dato real; entonces Pro (staging y producción) | Free no tiene backups diarios; no hay datos reales todavía |
| 2026-11-24 | Koibox: freno 5/15 min contado en la BD (eventos `integration.key_submitted`); `last_submission_result`; plazo desde `created_at` | Lo más seguro: el freno no se salta con varias filas ni mezcla organizaciones |
| 2026-11-14 | ADR 0055 opción A (sobre sellado con KMS hacia el worker) | «Lo más seguro» (Diego) |
| 2026-11-14 | Objetivo de seguridad: nivel de langdock.com/security | Diego; brecha en `docs/design/seguridad-objetivo.md` |
| 2026-11-14 | Outlook con app propia en Entra; alerta de gasto de Vercel puesta; Llama no por ahora | Diego |
| 2026-11-14 | moodly-bot: colaborador con escritura, sin admin; las sesiones mergean como moodly-bot | F04/P-02 |
| 2026-11-13 | Solo cuenta como verificado lo probado contra la API real en staging, con evidencia | Diego; regla en CLAUDE.md |
| 2026-11-13 | Calendario caído → no se ofrece ni reserva; pasa a una persona también con leads | Fail-closed |
| 2026-11-12 | Inferencia global bajo DPA con cada proveedor; UE solo si el cliente lo pide (ADR 0051) | Coste/calidad; sin afirmar «IA en la UE» |
| 2026-11-12 | ADRs aceptados: 0023, 0024, 0029, 0046, 0049, 0050, 0051, 0052 (F13) | Diego |
| 2026-11-12 | Nango Cloud para desarrollo; autoalojado en la UE antes del primer dato real | ADR 0053 |
| 2026-11-11 | El agente mergea sus PRs también en zonas sensibles hasta el primer dato real | Diego: velocidad |
| 2026-11-11 | Plataforma de conectores: Nango (ADR 0053) | Paridad de integraciones |
| 2026-11-11 | Cada agente conversa con el modelo más barato que pase sus evals (B-01) | Coste |
| 2026-11-10 | Plan del piloto por hitos M0–M5 con registro `docs/scope.yaml` | Auditoría de preproducción |
| 2026-11-10 | Evals: 30 $/mes en M0–M1 + 2 € por corrida; la Revisora automática comenta y no aprueba | Presupuesto |
| 2026-11-09 | Umbrales evals reales: seguridad 100 %, comportamiento 90 %, fallo repetido 3 veces bloquea | Calidad |
| 2026-10-22 | Mergeo autónomo con CI verde sobre el commit exacto y sin tests debilitados | Procedimiento en CLAUDE.md |
| (antes) | Decisiones de arquitectura: ver `docs/adr/` y MANUAL §18 | — |

## Fuera de alcance para el lanzamiento
- Agentes `sales` y `admin` completos, voz, app nativa (solo PWA), nube del cliente/on-prem (SE14), analítica opcional (SE17), integraciones de reservas sin API abierta (Booksy, Treatwell, Timp, Wilapp: acuerdo de socio o lectura vía Google Calendar).
