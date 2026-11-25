# Report ola1-01: skills visibles y ocultas, sin hook de arranque

Spec: docs/specs/ola1-01-podar-toolkit.md · Date: 2026-11-25 · Branch/PR: `claude/ola1-01-skills-visibles`

## Result: PARTIAL

Diego decidió no borrar ninguna skill (2026-11-25): todas siguen en `.claude/skills/`, 20 quedan visibles y 54 ocultas, con un índice para encontrarlas, y se quita el hook de arranque.

## Acceptance criteria
| Criterion | Pass/Fail | Evidence (command output, test name, file) |
| --- | --- | --- |
| No se borra ninguna skill | Pass | `ls .claude/skills \| wc -l` → 74; el diff de `.claude/skills` son 51 líneas `+disable-model-invocation: true` y nada más |
| El listado de arranque baja | Pass (medido en archivos) | Descripciones visibles: ~7.000 → ~1.800 tokens (caracteres ÷ 4); el hook inyectaba ~900 más |
| Una sesión nueva arranca sin errores y lista las 20 visibles | Sin verificar | Solo se puede comprobar abriendo una sesión sobre esta rama |
| `diff CLAUDE.md AGENTS.md` vacío | Pass | `diff -q CLAUDE.md AGENTS.md` sin salida |
| El cambio sale del toolkit | Fail | El commit del script existe solo en local: GitHub devolvió 403 al push a `dsvmotion/moodly-toolkit` desde la sesión. Parche: `docs/reports/ola1-01-toolkit.patch` (se aplica con `git am` sobre `main` del toolkit, `480bdf1`) |

## Files changed
- `.claude/skills/*/SKILL.md` (51, una línea de frontmatter), `.claude/toolkit/SKILLS-INDEX.md` (nuevo), `.claude/hooks/session-start` (borrado), `.claude/settings.json` (sin `SessionStart`)
- `CLAUDE.md`, `AGENTS.md`: sección del toolkit, lectura de `scope.yaml` por resumen y fila, y verificación tras el merge por el CI de `main`
- `docs/specs/ola0-00-como-mergear.md`, `docs/STATUS.md`

## Deviations from spec (and why)
- La spec proponía borrar ~44 skills; se ocultan en vez de borrarse, por decisión de Diego.
- Verificación tras el merge: `ci.yml` corre entero en cada push a `main` (jobs `check`, `evals`, `db`, `e2e`, `security` y `alerta-main`), que es lo mismo que se repetía en local. Se cambia la regla para no ejecutarlo dos veces.

## Follow-ups for the lead (max 3)
- Aplicar el parche en `dsvmotion/moodly-toolkit` y mergearlo antes de mergear este PR.
- Abrir una sesión sobre esta rama y comprobar que lista 20 skills y que una oculta se usa desde el índice.
- Mover el detalle de «Comandos» de `CLAUDE.md` a `docs/COMMANDS.md` (unos 3.300 tokens por sesión) después de `ola0-05`, que añade comandos a esa sección.
