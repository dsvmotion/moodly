<!-- Generado por `pnpm docs:status` desde docs/scope.yaml. No editar a mano. -->
# Estado por hito (generado)

Fuente: `docs/scope.yaml` (registro a 2026-11-10, commit c290ee3). Regenerar: `pnpm docs:status`.
El historial y el detalle viven en `docs/STATUS.md`; esto es solo el resumen del registro.

| Hito | Nombre | Total | done | in_progress | blocked | planned |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| M0 | Safe to build fast | 15 | 7 | 4 | 0 | 4 |
| M1 | Platform spine | 14 | 0 | 2 | 1 | 11 |
| M2 | Core service in staging | 36 | 0 | 13 | 0 | 23 |
| M3 | Pilot go-live | 48 | 0 | 5 | 1 | 42 |
| M4 | Pilot complete | 32 | 0 | 1 | 0 | 31 |
| M5 | Full scope | 0 | 0 | 0 | 0 | 0 |
| stretch | - | 4 | 0 | 0 | 0 | 4 |
| after | - | 168 | 0 | 0 | 0 | 168 |

## En curso o bloqueado

Solo `in_progress` y `blocked`; las `planned` solo se cuentan arriba.

### M0 · Safe to build fast

- `P-01` · V1 · in_progress · La guarda corre desde main con pull_request_target, lee el PR por la API y publica sensit… · PR #168; 05c1c93
- `P-08` · V1 + V3 · in_progress · docs/STATUS.generated.md se genera desde este registro (pnpm docs:status) y pnpm test com… · branch claude/p08-status-desde-scope
- `F03` · sin responsable · in_progress · Connect the reviewer identity and verify it is the one posting reviews: Until verified, t… · Declared by the founder on 2026-11-10:…; Declared by the founder on 2026-11-10:…
- `SE01` · V1 + Founder · in_progress · Merge guard run from the base branch and a separate agent identity: Findings P-01 and P-0… · GitHub App Moodly Reviewer created and…

### M1 · Platform spine

- `F05` · sin responsable · in_progress · Meta Business verification, WhatsApp number and templates · sin evidencia
- `ch-whatsapp` · V1 · blocked · WhatsApp: Waiting for Meta Business verification, a number and approved templates (STATUS… · sin evidencia
- `PL-T6` · V1 · in_progress · All model providers behind the router; EU by default, US on request: Router exists with o… · sin evidencia

### M2 · Core service in staging

- `F07` · sin responsable · in_progress · Pilot client: letter of intent and the list of systems it uses: Conversations with candid… · sin evidencia
- `RC1` · V1 · in_progress · Find slots: Works on the internal test channel only; no real channel yet · sin evidencia
- `RC2` · V1 · in_progress · Book: Works on the internal test channel only; no real channel yet · sin evidencia
- `RC3` · V1 · in_progress · Reschedule: Works on the internal test channel only; no real channel yet · sin evidencia
- `RC4` · V1 · in_progress · Cancel: Works on the internal test channel only; no real channel yet · sin evidencia
- `RC5` · V1 · in_progress · Reminders with opt-out: Works on the internal test channel only; no real channel yet · sin evidencia
- `RC6` · V1 · in_progress · Waitlist and offers: Works on the internal test channel only; no real channel yet · sin evidencia
- `CU1` · V1 · in_progress · Answers from knowledge: prices, hours, services, policies: Text sources only; internal te… · sin evidencia
- `CU2` · V1 · in_progress · Ask the team and learn the answer: Table and trigger on main; the skill is in PR #159 and… · sin evidencia
- `OA01` · V2 · in_progress · Inbox with takeover and reply: Takeover merged in #154; the worker can still post after a… · sin evidencia
- `OA02` · V2 · in_progress · Approvals with detail and edit: List with approve and reject exists; no detail, no edit · sin evidencia
- `OA06` · V2 · in_progress · Knowledge from text and files: Text sources only · sin evidencia
- … y 1 más en `docs/scope.yaml`.

### M3 · Pilot go-live

- `F06` · sin responsable · in_progress · Legal entity and counsel: DPA, privacy policy, terms · sin evidencia
- `pilot_booking_system` · V1 · blocked · Needs the pilot client (STATUS, Bloqueado). The founder is talking to candidate businesse… · sin evidencia
- `OA15` · V2 · in_progress · Account lifecycle: invite, reset, recovery, remove a member: Copy-paste invitations and M… · sin evidencia
- `OA17` · V2 · in_progress · Phone layout and installable app: Installable; the phone layout is the desktop one reflow… · sin evidencia
- `SE04` · V1 + V2 · in_progress · Customer audit log with access transparency: audit_logs and time-boxed support grants exi… · sin evidencia
- `SE06` · V4 · in_progress · Standing attack set for agents in CI: The policy attack set runs in CI; the real-model se… · sin evidencia

### M4 · Pilot complete

- `E3` · V1 + V2 · in_progress · Corrections become knowledge, with provenance: knowledge_requests table and answer trigge… · sin evidencia

### M5 · Full scope

Nada en curso.

## Avisos

Ninguno: toda unidad `done` tiene evidencia.
