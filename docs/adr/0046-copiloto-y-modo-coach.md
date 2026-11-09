# 0046 — Copiloto y modo coach: un solo punto de entrada, gobernado, que recomienda con evidencia y nunca actúa solo

- **Estado:** propuesto (borrador, 2026-11-09). Lo acepta producto. No hay nada implementado.
- **Fecha:** 2026-11-09
- **Secciones del MANUAL afectadas:** §5.12 (modo coach), §5.13 (asistente), §6.2 (memoria), §6.3 (objetivos), §6.4 (mapa del negocio), §12.4 (evals), §17 (fases 4 y 8)
- **Relación:** ADR 0029 (asistente con los permisos del usuario; este ADR lo amplía, no lo sustituye), ADR 0024 (memoria con procedencia), ADR 0030 (agentes, skills y techos de autonomía), ADR 0033 (enrutador de modelos), ADR 0047 (motor de políticas y aprobaciones atadas al contenido), `docs/design/roadmap-enterprise.md` §1.6, §3.6 y §3.7

## Contexto

Hay tres piezas que hablan de lo mismo con nombres distintos:

- **El asistente** (ADR 0029, propuesto; MANUAL §5.13): un meta-agente que ayuda a configurar, operar y diagnosticar la plataforma por conversación, con los permisos del usuario.
- **El modo coach** (MANUAL §5.12, concepto decidido): una capa transversal que observa el negocio, detecta mejoras, debilidades, riesgos y oportunidades y las convierte en tareas para uno de los 4 agentes o para una persona.
- **El copiloto** (roadmap §1.6, v4): la unión de las dos, con «control total» de la plataforma, y siete reglas de gobierno. El roadmap dice que se fija en este ADR.

La prioridad del producto es la memoria que aprende, los objetivos y el modo coach (CLAUDE.md; MANUAL §5.12 y §6). Antes de construir nada de esto hace falta fijar qué puede hacer el copiloto, con qué permisos, y qué no hará nunca. Es la pieza con más superficie de ataque: un LLM que lee datos no confiables (conversaciones, conocimiento, MCP) y que puede proponer cambios de configuración.

## Decisión

### 1. Copiloto = asistente (ADR 0029) + modo coach (MANUAL §5.12)

- **Un solo punto de entrada** por encima de los 4 agentes (`reception`, `customer`, `sales`, `admin`). En la interfaz es una sola ventana; por dentro son dos funciones:
  - **asistente:** responde, explica, diagnostica, enseña y propone cambios cuando la persona se lo pide;
  - **coach:** analiza los datos de la organización por su cuenta (tareas programadas y alertas) y deja recomendaciones.
- **No es un quinto agente** ni un actor con permisos propios. No atiende a clientes finales ni manda nada fuera.
- El ADR 0029 sigue vigente en todo lo que dice. Este ADR añade el coach y las reglas comunes.

### 2. Reglas de gobierno

Las siete del roadmap §1.6, concretadas:

| Regla | Cómo se cumple |
|---|---|
| **Nunca más permisos que la persona que lo usa** | Se ejecuta en `apps/web`, en el servidor, con la sesión del usuario (JWT y RLS), nunca con la *service role* ni en el worker (ADR 0029 §1). El motor de políticas recibe al usuario que da la orden; no hay rol de servicio. |
| **Leer es libre; cambiar se confirma** | Leer, dentro de lo que la persona puede ver, no pide confirmación. Todo cambio es una **propuesta** con vista previa (diff de configuración, antes → después) que la persona confirma; la confirmación queda atada al hash de esa vista previa, como las aprobaciones del ADR 0047. Si algo cambia entre ver y confirmar, se vuelve a pedir. |
| **Lo sensible, siempre a mano** | Fuera del catálogo, siempre (ADR 0029 §2): seguridad (MFA, SSO, SCIM, sesiones), roles y permisos, techos de autonomía, secretos y claves, facturación y plan, borrado de datos y reglas de plataforma. |
| **Todo queda auditado** | Cada propuesta, confirmación y cambio va a `audit_logs` con el hash de lo confirmado y el **actor doble**: la persona real (`actor_type = user`) y `via = assistant`, como en el ADR 0029 §3 (si se aplica una recomendación, además su identificador). Las recomendaciones del coach guardan su evidencia. |
| **Probar antes de publicar** | Un cambio que altera cómo se comporta un agente (prompt, reglas, conocimiento, skills) pasa por las evals del agente y por `agent_versions` antes de publicarse, con vuelta atrás en un clic. Sin evals en verde no se publica. |
| **El coach recomienda, no ejecuta** | Una recomendación nunca cambia nada sola. Si la persona la acepta, se convierte en propuesta (con su confirmación) o en una tarea para un agente, que pasa por el motor de políticas y las aprobaciones como cualquier otra, normalmente en `draft` (MANUAL §5.12, paso 5). |
| **Aislamiento** | Solo datos de su organización y de los alcances (organización, región, local) que la persona puede ver. Patrones entre organizaciones, solo agregados, anónimos y con k ≥ 5 (roadmap §3.6), y nunca como dato de otra organización concreta. |
| **Resistente a inyección** | Lo que lee de conversaciones, conocimiento, memoria, señales externas o MCP es dato, no instrucción (control 3.8). Ninguna herramienta de cambio se encadena sin una confirmación humana por medio. Set de ataque propio (§5). |

### 3. Las recomendaciones del coach

Con las reglas de calidad y los límites de MANUAL §5.12, que este ADR no cambia:

- **Sin evidencia, no hay recomendación.** Cada una guarda:
  - el dominio (`management`, `finance`, `legal`, `marketing`, `trends`, `competition`, `calendar`, `customer`);
  - la explicación;
  - la evidencia: la consulta o métrica interna, el periodo y el alcance, o la fuente externa con su enlace;
  - el impacto esperado, la métrica que debería moverse y la confianza;
  - si procede, la acción concreta para un agente o una persona.
- **Pocas y buenas:** un límite por periodo, ordenadas por impacto. Nada de consejos genéricos que valdrían para cualquier negocio.
- **Medibles:** el coach vuelve a mirar después si la métrica se movió, y lo guarda con la respuesta de la persona (`recommendation_feedback`). Eso ajusta qué propone después en esa organización (bucle de aprendizaje, roadmap §3.7).
- **Límites [DECIDIDO en MANUAL §5.12]:**
  - legal, fiscal y contable: detecta y avisa, no asesora; siempre con la fuente y la indicación de confirmarlo con su gestoría; nunca ejecuta acciones legales ni fiscales;
  - competencia: solo información pública, respetando las condiciones de cada fuente;
  - personas: ni perfiles de empleados ni evaluaciones de rendimiento individuales.
- **Datos que usa:** métricas (§12.3), objetivos (§6.3), memoria y mapa del negocio (§6.2, §6.4), actividad de los agentes e integraciones, todo con los permisos de quien la recibe. Al guardar una recomendación se guarda su alcance, y solo la ve quien puede ver ese alcance.
- **Coste:** corre en el worker como workflow programado de DBOS (cola `batch`) y llama a los modelos por el enrutador (ADR 0033), con el tope de gasto de la organización. Sin crédito o sin método de pago (MANUAL §15.1), no hay recomendaciones nuevas. Las señales externas se captan una vez por sector y zona (MANUAL §5.12, paso 2).

> El coach del worker **solo lee y escribe recomendaciones** de una organización, con `createServiceDb().forOrganization(orgId)`. No tiene herramientas de cambio: lo que cambia algo lo confirma una persona desde `apps/web`, con su sesión. Así se mantiene el ADR 0029 §1 sin dar permisos al worker.

### 4. Fases

Con la hoja de ruta de MANUAL §17 (2026-11-09), que manda sobre las fases F0–F4 del roadmap:

1. **Lectura y explicación** (ADR 0029, fase 2): diagnóstico, enseñar e instrucciones a los agentes con los permisos del usuario. Cuando existan los 4 agentes en producción.
2. **Coach con datos internos** (MANUAL §17, fase 4): resumen diario, revisión semanal y alertas, con evidencia, convertibles en propuestas o tareas. Primero solo datos internos; después, señales externas.
3. **Cambios confirmados** (ADR 0029, fase 3): herramientas de cambio del catálogo, con vista previa, hash y auditoría.
4. **Copiloto de cadena** (MANUAL §17, fase 8): comparativa entre locales; propuestas que la central aprueba y aplica por herencia con bloqueos.

Cada fase se activa con su ADR o PR de catálogo y sus evals en verde; ninguna empieza sin decisión de producto.

### 5. Evals que bloquean el merge

Además de las del ADR 0029 §5:

- **Escalada:** el copiloto no hace nada que la persona no pueda hacer (por ejemplo, un `staff` pide un cambio de `org_admin`).
- **Cero cambios sin confirmación:** ninguna herramienta de cambio se aplica sin la confirmación atada al hash.
- **Inyección:** instrucciones escondidas en una conversación, un documento de conocimiento, una memoria o una respuesta de MCP no producen propuestas ni cambios.
- **Aislamiento:** ninguna recomendación cita datos de otra organización ni de un local que la persona no puede ver.
- **Evidencia:** toda recomendación generada tiene evidencia que se puede comprobar contra los datos; las de legal y fiscal llevan fuente y aviso.

## Alternativas consideradas

- **Copiloto y coach como dos productos separados** — dos ventanas y dos modelos de permisos para lo mismo; la persona no sabe a cuál preguntar.
- **El coach ejecuta solo lo de bajo riesgo** — rompe «el coach recomienda, no ejecuta» y necesitaría permisos propios en el worker (el *confused deputy* del ADR 0029). Si algún día se quiere, va por los techos de autonomía del ADR 0030 y con decisión de producto.
- **El copiloto en el worker con un rol de servicio** — descartado por el ADR 0029.

## Consecuencias

- Una sola pieza de producto con reglas claras: lo que el copiloto puede hacer está acotado por los permisos de la persona y por un catálogo cerrado.
- Hacen falta tablas nuevas (`recommendations`, `recommendation_feedback`, y más adelante `external_signals` y `signal_matches`), con RLS por organización y alcance y sus pgTAP. Las migraciones las hace V1 cuando se implemente; este ADR no las crea.
- El catálogo de herramientas del asistente (ADR 0029, «se define en un PR propio») es requisito de la fase 3.
- Hay que vigilar el coste del coach por organización y el ruido: si la gente ignora las recomendaciones, se recorta el límite por periodo.

## Preguntas abiertas para producto

1. **Nombre en la interfaz:** ¿«Copiloto», «Asistente» o «Coach»? El MANUAL usa «asistente» (§5.13) y el roadmap «copiloto».
2. **Cambios con alcance de cadena:** el roadmap pide aprobación de un `org_admin` para las propuestas de alcance de cadena y las de zona financiera. ¿Basta con que lo confirme un `org_admin` con MFA, o pide la separación de funciones del ADR 0047 (quien propone no aprueba)?
3. **Frecuencia y límite por defecto del coach:** ¿resumen diario, semanal o los dos, y cuántas recomendaciones como máximo por periodo?
4. **Patrones entre organizaciones (k ≥ 5):** ¿se usan desde el principio o solo cuando haya clientes suficientes del mismo sector?

## Verificación

Pendiente: es un borrador sin implementar. Cuando se construya, cada fase cierra con:

- test de que un `staff` no consigue por el copiloto un cambio de `org_admin` (falla por RLS o por permisos);
- pgTAP de aislamiento de `recommendations` por organización y alcance, con pruebas en negativo;
- las evals del punto 5 en CI.
