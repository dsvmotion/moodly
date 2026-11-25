# ola1-01: podar el toolkit de skills (`.claude/skills/`, 74 skills)

Phase / wave: Ola 1
Model: Sonnet · Effort: Medium
Can run in parallel with: cualquier spec que no toque `.claude/`.

## Goal
Que cada sesión cargue solo las skills que este proyecto usa: hoy entran 74 descripciones en el contexto de cada sesión (y el hook de `superpowers` inyecta su texto de arranque en cada inicio, `/clear` y compactación), lo que cuesta tokens y dispersa. **Esta spec no quita nada por sí sola: la tabla es la propuesta; Diego aprueba la lista antes de tocar `.claude/`.**

## Cómo se midió «¿se ha usado?»
Búsqueda del nombre de cada skill en los cuerpos de los 300 PRs, en los mensajes de todos los commits y en `docs/` (2026-11-24). El PR que instaló el toolkit (#166) no cuenta. «Sin evidencia» = no aparece en el repo; pudo usarse en una sesión sin dejar rastro, así que la recomendación también pesa si encaja con el producto (web Next.js, sin app nativa, sin librerías de animación ni Sonner en `package.json`).

## Tabla
| Skill | Para qué sirve | ¿Usada en el trabajo real? | Recomendación |
| --- | --- | --- | --- |
| using-superpowers (+ hook `session-start`) | Arranque: obliga a buscar skills antes de cada respuesta | Se inyecta en cada sesión; choca con `docs/WORKFLOW.md` (sesiones cortas por spec) | Quitar el hook; mantener la skill solo si se invoca a mano |
| brainstorming | Explorar un diseño antes de construir | Sin evidencia | Mantener (lo pide CLAUDE-WORKFLOW-RULES §2) |
| writing-plans | Plan escrito antes de tocar código | Sí (`docs/superpowers/plans/2026-10-18-pwa-fase0.md`) | Mantener |
| executing-plans | Ejecutar un plan paso a paso | Sí (mismo plan) | Mantener |
| subagent-driven-development | Ejecutar un plan con subagentes | Sin evidencia | Quitar (lo cubre WORKFLOW lead/worker) |
| dispatching-parallel-agents | Lanzar agentes en paralelo | Sin evidencia | Quitar (idem) |
| systematic-debugging | Depurar con método antes de arreglar | Sin evidencia | Mantener |
| test-driven-development | Test antes que código | Sin evidencia (pero la práctica de «prueba en negativo» es constante) | Mantener |
| verification-before-completion | No decir «hecho» sin verificar | Sin evidencia (regla ya en CLAUDE.md) | Mantener |
| requesting-code-review | Pedir revisión al terminar | Sin evidencia | Mantener (encaja con el agente `reviewer`) |
| receiving-code-review | Responder a una revisión con rigor | Sin evidencia | Mantener |
| finishing-a-development-branch | Decidir cómo integrar una rama | Sin evidencia | Quitar (lo fija ola0-00) |
| using-git-worktrees | Aislar trabajo en worktrees | Sin evidencia | Quitar |
| writing-skills | Crear/editar skills | Sin evidencia | Quitar (el toolkit vive en otro repo) |
| diagnosing-superpowers | Diagnosticar una sesión de superpowers que fue mal | Sin evidencia | Quitar |
| impeccable (+4 agentes `impeccable-*`) | Diseñar, auditar y pulir frontend | Sin evidencia | Mantener (la principal de diseño) |
| ui-ux-pro-max | Base de datos de estilos, paletas y guías UI/UX (3,4 MB) | Sin evidencia | Quitar o mantener solo una de las dos con impeccable (decide V2/V3) |
| design-taste-frontend | Criterio estético para frontend | Sin evidencia | Quitar (solapa con impeccable) |
| emil-design-eng | Filosofía de pulido de UI de Emil Kowalski | Sin evidencia | Quitar (solapa) |
| apple-design | Diseño y movimiento estilo Apple para web | Sin evidencia | Quitar |
| break-ui | Probar una UI con datos extremos | Sin evidencia | Mantener (útil para e2e) |
| prototype | Varias versiones de un componente con selector | Sin evidencia (los «prototype» del repo son `apps/site/plataforma`) | Quitar |
| pick-ui-library | Elegir librería para una tarea de frontend | Sin evidencia | Quitar |
| mobile-native | Que la web se sienta nativa en el móvil | Sin evidencia | Mantener (PWA, OA17) |
| animate | Construir una animación | Sin evidencia | Mantener una de animación (esta) |
| improve-animations | Auditoría de animaciones | Sin evidencia | Quitar |
| review-animations | Revisión de código de animación | Sin evidencia | Quitar |
| remove-animations | Quitar animaciones sobrantes | Sin evidencia | Quitar |
| find-animation-opportunities | Buscar dónde animar | Sin evidencia | Quitar |
| animation-performance | Animaciones dentro del presupuesto de frame | Sin evidencia | Quitar |
| animation-vocabulary | Glosario de efectos de animación | Sin evidencia | Quitar |
| choreograph | Coordinar varias animaciones | Sin evidencia | Quitar |
| gestures | Arrastrar/deslizar con el dedo | Sin evidencia | Quitar |
| animate-expo | Animaciones en React Native/Expo | Sin evidencia (no hay app nativa) | Quitar |
| ask-sonner | Toasts con Sonner | Sin evidencia (Sonner no está en `package.json`) | Quitar |
| write-swift | Swift moderno | Sin evidencia (no hay Swift) | Quitar |
| privacy-legal-dpa-review | Revisar un DPA | Sí (#271) | Mantener |
| privacy-legal-pia-generation | Evaluación de impacto de privacidad | Sí (#271) | Mantener |
| privacy-legal-use-case-triage | ¿Hace falta PIA/DPIA? | Sin evidencia | Mantener (DPIA antes del primer dato real) |
| privacy-legal-reg-gap-analysis | Brecha frente a una norma | Sin evidencia | Mantener |
| privacy-legal-dsar-response | Responder solicitudes de acceso/borrado | Sin evidencia | Mantener (M3: export/borrado por contacto) |
| privacy-legal-policy-monitor | Política de privacidad al día con la práctica | Sin evidencia | Quitar (hasta tener política publicada) |
| privacy-legal-cold-start-interview / -customize / -matter-workspace | Configurar el plugin y separar clientes de un despacho | Sin evidencia | Quitar (perfil de despacho multi-cliente) |
| ai-governance-legal-ai-inventory | Inventario de sistemas de IA (EU AI Act) | Sí (#271) | Mantener |
| ai-governance-legal-use-case-triage | Clasificar un caso de uso de IA | Sin evidencia | Mantener |
| ai-governance-legal-aia-generation | Evaluación de impacto de IA | Sin evidencia | Mantener |
| ai-governance-legal-vendor-ai-review | Revisar la IA de un proveedor | Sin evidencia | Mantener (proveedores de modelos) |
| ai-governance-legal-reg-gap-analysis / -policy-starter / -policy-monitor | Brecha regulatoria, política de IA y su vigilancia | Sin evidencia | Quitar 2 de 3; mantener policy-starter |
| ai-governance-legal-cold-start-interview / -customize / -matter-workspace | Configuración y espacios por cliente | Sin evidencia | Quitar |
| product-legal-marketing-claims-review | Revisar afirmaciones de marketing | Sí (#271; encaja con SE02/N-01) | Mantener |
| product-legal-launch-review | Revisión legal de un lanzamiento | Sin evidencia | Mantener (M3) |
| product-legal-feature-risk-assessment / -is-this-a-problem | Riesgo de una función / consulta rápida | Sin evidencia | Mantener is-this-a-problem; quitar la otra |
| product-legal-cold-start-interview / -customize / -matter-workspace | Configuración | Sin evidencia | Quitar |
| commercial-legal-vendor-agreement-review | Revisar contratos con proveedores | Sin evidencia | Mantener (DPAs con proveedores, F10) |
| commercial-legal-saas-msa-review | Revisar MSA de SaaS | Sin evidencia | Mantener (contrato del piloto) |
| commercial-legal-review / -nda-review / -amendment-history / -escalation-flagger / -renewal-tracker / -review-proposals / -stakeholder-summary / -cold-start-interview / -customize / -matter-workspace | Flujo de contratos de un despacho | Sin evidencia | Quitar |

Resultado propuesto: de 74 a ~30 skills; quitar el hook de arranque de `superpowers`.

## Touch only these
- `.claude/skills/` (borrar carpetas aprobadas), `.claude/settings.json` (hook), `.claude/toolkit/` (registro), CLAUDE.md/AGENTS.md («Toolkit de skills»: número y lista).
- **Ojo con la regla de CLAUDE.md:** las skills «no se editan aquí; se cambian en el toolkit (`dsvmotion/moodly-toolkit`) y se traen con su script». Hacerlo en el toolkit y exportar, o cambiar antes esa regla con el visto bueno de Diego.

## Steps
1. Diego marca la tabla (mantener/quitar).
2. En `dsvmotion/moodly-toolkit`: quitar las aprobadas; exportar con `python3 scripts/export-claude-dir.py <moodly>/.claude`.
3. PR en moodly con el commit del toolkit de origen; actualizar el número de skills en CLAUDE.md/AGENTS.md.
4. Medir: tamaño del listado de skills al arrancar una sesión antes y después.

## Acceptance criteria
- [ ] Solo se quitan las skills aprobadas por Diego.
- [ ] Una sesión nueva arranca sin errores y lista las skills que quedan.
- [ ] `diff CLAUDE.md AGENTS.md` vacío.

## Revisión del agente reviewer
- Sí: `.claude/**` decide permisos y hooks de todas las sesiones.
