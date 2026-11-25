# ola0-08: PRs abiertos que esperan una decisión de Diego (no se mergean hasta entonces)

Phase / wave: Ola 0
Model: Sonnet · Effort: Medium
Can run in parallel with: todo; esta spec no cambia código hasta que Diego decida.

## Goal
Que ningún PR abierto quede olvidado: para cada uno, qué es, en qué estado quedó y qué decisión desbloquea. El worker no toca nada hasta que Diego decida; luego aplica ola0-00.

| PR | Qué | Estado (2026-11-24) | Decisión / siguiente paso |
| --- | --- | --- | --- |
| #293 | OPS-01: integración del worker en CI de ~14 → ~7 min (`schedulesTesting`: publicador 1 s y barrido 5 s solo en tests; espera fija de 65 s → «dos barridos contados») | borrador, `3e1e9d5`, CI verde el 13-11; e2e entero 28–29 → 19–23 min | Elegir **uno** con #302 (ver STATUS, «Decisiones para Diego»). Después: merge de main, CI, merge |
| #302 | OPS-01: lo mismo por otra vía (barrido y publicador rápidos) | borrador, `12a375c`, CI verde; local 14 → ~7 min (108/108), en CI el e2e 23m52s frente a 25–29 | Igual; al poner al día hay que revisar los archivos de integración nuevos (p. ej. `one-reply`) y volver a medir |
| #196 | `docs/design/modelo-precios.md` reescrito (planes 149/399/200 € por sede, coste medido, cobro de WhatsApp) + 1 línea de STATUS | borrador, `f1c7c3e`, solo Markdown, CI verde el 11-11 sin comprobar contra el main actual | Diego decide si entra. **Al hacer squash, quitar del mensaje el nombre de modelo de la línea `Co-Authored-By`** (CLAUDE.md prohíbe IDs de modelo en commits; no se pudo reescribir sin force push) |
| #339 | `docs/decks/`: fuentes de los dos decks (inversores y empresas piloto), 127 archivos, solo docs | borrador, `39cc77c`, del 24-11 | Diego decide si las fuentes viven en el repo (es la única copia aparte de los artefactos publicados). Revisar que no hay datos personales ni de terceros antes de mergear |
| #271 | Borradores legales F06/F10 para un abogado (18 archivos, V13) | borrador, `81f6b0c`, 51 commits por detrás | No se mergea como texto legal final: el abogado revisa (F06). Decidir si entran como borradores en `docs/legal/` o se quedan en la rama hasta la revisión |
| #260 | Una frase en CLAUDE.md/AGENTS.md: el comando `eval:intents` | `cd88e7c`, retenido «para producto» (instrucciones de sesiones) | Aprobar o cerrar; si entra, se puede juntar con ola0-05 |
| #270 | PL-T3: un mensaje `complex` nunca va por el camino barato (`COMPLEX_THRESHOLD = 1`; `EVALS_MIN_TESTS` 243 → 245) | `fb9ecf1`, 13-11; no se ha corrido `eval:intents` con el modelo real | El umbral lo decidió producto el 12-11. Falta: poner al día, CI, correr `eval:intents` real antes de encender el enrutado (`INTENT_ROUTING` sigue apagado) |
| #159 | CU2 B20-4b: skill `ask_team` (el agente pregunta al equipo en vez de inventar) | borrador, `f7c7cfd`, 11-11, muy por detrás; **la skill no está en main** | Rehacer sobre main actual (spec nueva en la Ola 1/M2), no rebasar el PR viejo |
| #160 | CU2: el agente ve lo que dejó esperando | borrador, `21698e0`, apilado sobre #159 | **Superado**: la capa «waiting for the team» ya está en main (`packages/agent-core/src/runtime/prompt.ts`, CU3 #298). Proponer a Diego cerrarlo |

## Acceptance criteria
- [ ] Cada fila tiene una decisión de Diego apuntada en `docs/PLAN.md` (registro de decisiones) antes de tocar el PR.
- [ ] Ningún PR se cierra ni se borra su rama sin el visto bueno de Diego.
