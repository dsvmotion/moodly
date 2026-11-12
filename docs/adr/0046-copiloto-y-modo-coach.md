# 0046 — Copiloto y modo coach: un solo punto de entrada, gobernado, que recomienda con evidencia y nunca actúa solo

- **Estado:** propuesto (borrador del 2026-11-09, revisado el 2026-11-12 con la auditoría de preproducción). Lo acepta producto junto con los ADR 0024 y 0029, de los que depende (auditoría §18.5, tarea 3 de V3). No hay nada implementado.
- **Fecha:** 2026-11-09; revisión: 2026-11-12
- **Secciones del MANUAL afectadas:** §5.12 (modo coach), §5.13 (asistente), §6.2 (memoria), §6.3 (objetivos), §6.4 (mapa del negocio), §12.4 (evals), §15 (consumo y topes), §17 (fases)
- **Relación:**
  - ADR 0029 (asistente con los permisos del usuario; este ADR lo amplía, no lo sustituye);
  - ADR 0024 (memoria con procedencia);
  - ADR 0030 (agentes, skills y techos de autonomía);
  - ADR 0033 (enrutador de modelos);
  - ADR 0047 (motor de políticas y aprobaciones atadas al contenido);
  - ADR 0049 (rol del worker ligado a la organización);
  - `docs/design/roadmap-enterprise.md` §1.6, §3.6 y §3.7;
  - unidades `AS1`–`AS7`, `CO1`–`CO6`, `OA18` y `OA19` de `docs/scope.yaml`.

## Qué cambia en esta revisión (2026-11-12)

La auditoría de preproducción (2026-11-10, §4, §18.5 y §19.6) pidió cuatro cosas antes de que el asistente y el coach entren en el piloto. Además, había que aplicar dos decisiones de producto (las 1 y 12). Cada cambio con su sección:

1. **La contradicción del worker.** El borrador decía a la vez «nunca en el worker» y «el coach corre en el worker». Ahora cada parte tiene su sitio y sus permisos (§5).
2. **Privacidad del equipo.** Reglas nuevas (§6).
3. **Coste.** Topes propios del asistente y del coach (§7).
4. **Evidencia.** Cada cifra sale de una consulta guardada y se comprueba antes de enseñarse (§8).
5. **Decisiones 1 y 12.** En el piloto (M4) van el asistente solo de lectura y la revisión semanal del coach con datos propios; el resto, después (§4).

## Contexto

Hay tres piezas que hablan de lo mismo con nombres distintos:

- **El asistente** (ADR 0029, propuesto; MANUAL §5.13): un meta-agente que ayuda a configurar, operar y diagnosticar la plataforma por conversación, con los permisos del usuario.
- **El modo coach** (MANUAL §5.12, concepto decidido): una capa transversal que observa el negocio, detecta mejoras, debilidades, riesgos y oportunidades y las convierte en tareas para uno de los 4 agentes o para una persona.
- **El copiloto** (roadmap §1.6, v4): la unión de las dos, con «control total» de la plataforma, y siete reglas de gobierno. El roadmap dice que se fija en este ADR.

La prioridad del producto es la memoria que aprende, los objetivos y el modo coach (CLAUDE.md; MANUAL §5.12 y §6). Producto decidió el 2026-11-10 (auditoría, decisiones 1 y 12) que el piloto lleva, además de los 4 agentes, un asistente del dueño y un coach. Antes de construirlos hay que fijar qué pueden hacer, con qué permisos, cuánto pueden gastar y qué no harán nunca. Es la pieza con más superficie de ataque: un LLM que lee datos no confiables (conversaciones, conocimiento, MCP) y que, más adelante, podrá proponer cambios de configuración.

## Decisión

### 1. Copiloto = asistente (ADR 0029) + modo coach (MANUAL §5.12)

- **Un solo punto de entrada** por encima de los 4 agentes (`reception`, `customer`, `sales`, `admin`). En la interfaz es una sola ventana; por dentro son dos funciones:
  - **asistente:** responde, explica, diagnostica y enseña cuando la persona se lo pide; más adelante, también propone cambios (§4);
  - **coach:** analiza los datos de la organización por su cuenta, en una tarea programada, y deja recomendaciones.
- **No es un quinto agente** ni un actor con permisos propios. No atiende a clientes finales ni manda nada fuera.
- El ADR 0029 sigue vigente en todo lo que dice. Este ADR añade el coach y las reglas comunes.

### 2. Reglas de gobierno

Las siete del roadmap §1.6, concretadas:

| Regla | Cómo se cumple |
|---|---|
| **Nunca más permisos que la persona que lo usa** | El asistente se ejecuta en `apps/web`, en el servidor, con la sesión del usuario (JWT y RLS), nunca con la *service role* (ADR 0029 §1). El coach no actúa por nadie: corre en el worker, ligado a una organización, solo lee consultas cerradas y solo escribe recomendaciones. Lo que deja lo ve cada persona según su alcance, por RLS (§5). |
| **Leer es libre; cambiar se confirma** | Leer, dentro de lo que la persona puede ver, no pide confirmación. Todo cambio, cuando llegue (§4), es una **propuesta** con vista previa (diff de configuración, antes → después) que la persona confirma. La confirmación queda atada al hash de esa vista previa, como las aprobaciones del ADR 0047; si algo cambia entre ver y confirmar, se vuelve a pedir. |
| **Lo sensible, siempre a mano** | Fuera del catálogo, siempre (ADR 0029 §2): seguridad (MFA, SSO, SCIM, sesiones), roles y permisos, techos de autonomía, secretos y claves, facturación y plan, borrado de datos y reglas de plataforma. |
| **Todo queda auditado** | Cada pregunta con datos, propuesta, confirmación y cambio va a `audit_logs` con el **actor doble**: la persona real (`actor_type = user`) y `via = assistant`, como en el ADR 0029 §3. Cada ejecución del coach queda en la traza de su run, y cada recomendación guarda su evidencia (§8). |
| **Probar antes de publicar** | Un cambio que altera cómo se comporta un agente (prompt, reglas, conocimiento, skills) pasa por las evals del agente y por `agent_versions` antes de publicarse, con vuelta atrás en un clic. Sin evals en verde no se publica. |
| **El coach recomienda, no ejecuta** | Una recomendación nunca cambia nada sola. En el piloto, aceptarla la registra y la persona la lleva a cabo. Después (§4), aceptarla podrá crear una propuesta (con su confirmación) o una tarea para un agente, que pasa por el motor de políticas y las aprobaciones como cualquier otra, normalmente en `draft` (MANUAL §5.12, paso 5). |
| **Aislamiento** | Solo datos de su organización y de los alcances (organización, región, local) que la persona puede ver. Patrones entre organizaciones, solo agregados, anónimos y con k ≥ 5 (roadmap §3.6), nunca como dato de otra organización concreta, y no en el piloto. |
| **Resistente a inyección** | Lo que lee de conversaciones, conocimiento, memoria, señales externas o MCP es dato, no instrucción (control 3.8). Ninguna herramienta de cambio se encadena sin una confirmación humana por medio. Tiene su propio set de ataque (§9). |

### 3. Las recomendaciones del coach

Con las reglas de calidad y los límites de MANUAL §5.12, que este ADR no cambia:

- **Sin evidencia, no hay recomendación** (§8). Cada una guarda:
  - el dominio (`management`, `finance`, `legal`, `marketing`, `trends`, `competition`, `calendar`, `customer`);
  - la explicación;
  - la evidencia;
  - el impacto esperado, la métrica que debería moverse y la confianza;
  - si procede, la acción concreta para una persona (o, después del piloto, para un agente).
- **Pocas y buenas:** un límite por periodo, ordenadas por impacto. Nada de consejos genéricos que valdrían para cualquier negocio.
- **Medibles:** el coach vuelve a mirar después si la métrica se movió, y lo guarda con la respuesta de la persona (`recommendation_feedback`). Eso ajusta qué propone después en esa organización (bucle de aprendizaje, roadmap §3.7).
- **Límites [DECIDIDO en MANUAL §5.12]:**
  - legal, fiscal y contable: detecta y avisa, no asesora; siempre con la fuente y la indicación de confirmarlo con su gestoría; nunca ejecuta acciones legales ni fiscales;
  - competencia: solo información pública, respetando las condiciones de cada fuente;
  - personas: ni perfiles de empleados ni evaluaciones de rendimiento individuales (concretado en §6).
- **Datos que usa en el piloto:** métricas (§12.3), objetivos (§6.3), el registro de resultados (E4) y la actividad de los agentes, siempre por consultas cerradas (§5 y §8). La memoria y el mapa del negocio (§6.2, §6.4) entran cuando el ADR 0024 esté aceptado e implementado; las señales externas, después del piloto (`CO5`).
- **Alcance:** cada recomendación guarda el alcance de sus datos (organización, región o local), y solo la ve quien puede ver ese alcance.

### 4. Qué entra en el piloto y qué después

Las decisiones de producto 1 y 12 (auditoría 2026-11-10) meten el asistente y el coach en el piloto. La auditoría (§19) los sitúa en el hito M4, una vez aceptadas estas reglas. El registro (`docs/scope.yaml`) manda sobre esta tabla.

| | En el piloto (M4) | Después |
|---|---|---|
| **Asistente** | **Solo lectura:** responde sobre el negocio con sus propios datos (`AS1`), resume lo que necesita a la persona (`AS2`) y explica por qué un agente decidió algo (`AS3`). Sin herramientas de cambio: si la persona pide un cambio, el asistente le explica dónde y cómo hacerlo. Panel en la app (`OA18`). | Cambios con confirmación (`AS4`), borradores de conocimiento (`AS5`), configurar agentes (`AS6`) y alta guiada (`AS7`), cada uno con su catálogo y sus evals (ADR 0029, fase 3). |
| **Coach** | **Revisión semanal contra los objetivos** (`CO1`) con **recomendaciones con evidencia que la persona acepta o descarta** (`CO2`), solo con datos propios de la organización. Pantalla de objetivos y coach (`OA19`). | Alertas de anomalías (`CO3`), comparativa entre locales (`CO4`), señales y noticias externas (`CO5`), planificación de objetivos (`CO6`) y el copiloto de cadena (MANUAL §17, fase 8). |

Cada parte se activa con sus evals en verde (§9) y, la de después, con decisión de producto.

### 5. Dónde corre cada parte (resuelve la contradicción del borrador)

| | Asistente | Coach |
|---|---|---|
| **Dónde** | `apps/web`, en el servidor, dentro de la petición de la persona. | El worker, como workflow programado de DBOS (cola `batch`), una vez por organización y periodo. |
| **Con qué identidad** | La sesión de la persona (JWT y RLS). Nunca la *service role* ni el worker (ADR 0029 §1). | Ninguna persona. Usa el acceso del worker a una sola organización: hoy `createServiceDb().forOrganization(orgId)` (CLAUDE.md) y, con el ADR 0049, el rol `moodly_worker` con RLS y la organización fijada en la transacción. La organización sale de la fila del trabajo programado, nunca de lo que genera el modelo. |
| **Qué lee** | Lo que la persona puede ver, con sus permisos. | Solo las consultas cerradas del coach (§8): agregados de la organización por alcance. No lee el texto de las conversaciones ni de los mensajes del equipo. |
| **Qué escribe** | Nada en el piloto. Después, solo propuestas que la persona confirma. | Solo filas de `recommendations` (y su evidencia) de esa organización. Ninguna herramienta de cambio, ni envío a clientes, ni tareas para agentes. |
| **Quién ve el resultado** | La propia persona. | Cada persona según su rol y su alcance, por RLS sobre `recommendations`. |

Por eso el coach no rompe «nunca más permisos que la persona». No actúa por nadie. Lee menos que cualquier `org_admin` (solo agregados) y deja un resultado que cada uno ve con sus propios permisos. Lo que cambie algo lo confirma siempre una persona desde `apps/web`, con su sesión.

### 6. Privacidad del equipo

El coach y el asistente miran el negocio, no a las personas que trabajan en él. Ningún empleado se evalúa, se puntúa ni se compara con otro. Además del límite de MANUAL §5.12, esto aleja el producto de la vigilancia y evaluación de trabajadores, que la Ley de IA de la UE trata como uso de alto riesgo (anexo III, punto 4). Que el diseño quede fuera de ese supuesto lo confirma la asesoría legal antes del piloto.

- **Nada por persona:** ni rankings, ni puntuaciones, ni tiempos de respuesta, ventas o errores de un empleado concreto. Las métricas del equipo se dan por local, por agente o por organización.
- **Grupo mínimo:** una métrica del equipo humano (por ejemplo, tiempo hasta que una persona contesta lo que el agente le pasó) solo se da para un grupo de **al menos 3 personas**. Con menos, se agrega al nivel superior o no se da. El número es configurable y lo decide producto.
- **Sin leer al equipo:** el coach no lee el texto de los mensajes que escribe el equipo (tomas de control de la bandeja, respuestas a solicitudes) ni sus notas. Solo cuenta eventos agregados.
- **El asistente tampoco:** si alguien le pide «¿quién de mi equipo contesta más lento?» o «¿qué empleado vende menos?», no responde por persona. Explica la regla y ofrece el dato agregado.
- **Lo que sí se puede:** la persona que pregunta por sí misma (su propio trabajo pendiente) lo ve, porque ya lo ve en la app. Sus propias cifras nunca se comparan con las de otras personas: ni posición, ni media del equipo al lado, ni «por encima» o «por debajo» de nadie. Los datos de clientes finales siguen las reglas de la memoria (MANUAL §6.2): nunca credenciales, datos de pago ni categorías especiales.
- **Transparencia:** la pantalla del coach (`OA19`) dice qué datos usa y cuáles no. La política de privacidad de la web lo recoge cuando se publique.

### 7. Coste

El coach y el asistente gastan del mismo saldo que los agentes y tienen además sus propios topes, para que nunca se coman el presupuesto de atender a los clientes:

- **Cálculo sin LLM:** las cifras del coach salen de SQL (consultas cerradas, §8). El modelo solo redacta y prioriza a partir de esos números. No calcula ni busca datos por su cuenta.
- **Modelo más barato que basta:** la misma regla que los agentes (MANUAL §5.11, B-01). Empieza en `fast` y solo sube si sus evals lo piden. El modelo se elige por clave lógica en `packages/config`, nunca por ID en el código.
- **Cómo no se come el presupuesto de los agentes:** hoy hay un solo tope por organización (por run y por día en el enrutador; el del mes llega con `PL-ledger`). Este ADR pide que el libro de uso (`PL-ledger`) y el enrutador lleven **una línea de presupuesto propia para el copiloto (asistente y coach)**, separada de la de los agentes. Cada llamada del copiloto se anota y se comprueba contra su línea y contra el tope total; una llamada de un agente nunca se rechaza porque el copiloto haya gastado su línea. Es una **dependencia de `PL-ledger`**: sin esa línea separada, el asistente y el coach no se activan en el piloto.
- **Topes:**
  - el coach tiene un tope en euros por ejecución y por mes y por organización;
  - el asistente tiene un tope en euros por persona y día y otro por organización y mes;
  - los dos van en el libro de uso de la organización (`PL-ledger`) con su propia línea, para verlos en la pantalla de consumo (`OA14`);
  - los valores por defecto los decide producto (pregunta 5); viven en `packages/config` y el enrutador los hace cumplir, como hoy los topes por run y por día (ADR 0033).
- **Al llegar al tope:** el coach se salta la ejecución y lo deja anotado, y el asistente lo dice y deja de responder con datos hasta el siguiente periodo. Nunca se toca el presupuesto que el tope de la organización reserva a los agentes.
- **Sin saldo** (MANUAL §15.1): no hay recomendaciones nuevas ni respuestas del asistente que llamen a un modelo.
- **Medido:** el coste por ejecución del coach y por conversación del asistente se registra en cada run, como el de los agentes, y entra en el coste por conversación resuelta del piloto (M4).

### 8. Evidencia

- **Consultas cerradas:** las cifras del coach solo salen de un catálogo de consultas con nombre y versión (por ejemplo, «citas perdidas por semana y local» o «solicitudes pendientes de más de 24 h»), escritas y revisadas como código, con tests. El modelo elige entre ellas y, como mucho, el periodo, de una lista cerrada que valida el código. No escribe SQL.
- **El alcance nunca lo da el modelo** (CLAUDE.md: `organization_id`, `location_id` ni destinatarios salen de lo que genera el LLM). En el coach, la organización y el alcance (organización, región o local) salen de la fila del trabajo programado. En el asistente, salen de la sesión y de los alcances de la persona: si su respuesta pide un alcance, es un valor de una lista cerrada que el código comprueba contra los alcances que esa persona puede ver. Un `location_id` u otro identificador en lo que escribe el modelo se ignora.
- **Se guarda con la recomendación:** la consulta, su versión, los parámetros, el periodo, el alcance y el resultado. Cualquiera que pueda ver la recomendación puede ver de dónde sale cada número.
- **Comprobación antes de guardar:** un paso determinista comprueba que cada cifra del texto aparece en los resultados guardados (con su redondeo) y que el alcance de la evidencia es el de la recomendación. Si algo no cuadra, la recomendación se descarta y se anota el motivo; no se enseña.
- **El asistente cita igual:** cuando responde con una cifra del negocio, dice de dónde sale (pantalla, consulta o informe) y no da números que no haya leído.
- **Externas, después:** cuando lleguen las señales externas (`CO5`), cada una lleva su fuente, su enlace y la fecha en que se leyó.

### 9. Evals que bloquean el merge

Además de las del ADR 0029 §5:

- **Escalada:** el copiloto no hace nada que la persona no pueda hacer (por ejemplo, un `staff` pide un cambio de `org_admin`, o datos de un local que no ve).
- **Solo lectura en el piloto:** ninguna petición consigue un cambio desde el asistente; explica dónde hacerlo.
- **Cero cambios sin confirmación** (cuando haya cambios): ninguna herramienta de cambio se aplica sin la confirmación atada al hash.
- **Inyección:** instrucciones escondidas en una conversación, un documento de conocimiento, una memoria o una respuesta de MCP no producen propuestas, cambios ni recomendaciones.
- **Aislamiento:** ninguna recomendación ni respuesta cita datos de otra organización ni de un local que la persona no puede ver.
- **Alcance que viene del modelo (en negativo):** si el modelo devuelve un `location_id`, una organización o un alcance que no salen de la fila del trabajo o de los alcances de la persona, se ignora y la consulta corre con el alcance correcto o no corre. Es obligatoria.
- **Privacidad del equipo:** las preguntas que piden ranking o evaluación de un empleado reciben la regla y el dato agregado. Ninguna recomendación nombra ni señala a un empleado, con menos de 3 personas no hay métrica del grupo, y las cifras propias de una persona nunca salen comparadas con las de otras.
- **Evidencia:** cada cifra de una recomendación coincide con el resultado guardado de su consulta (V4: «los números cuadran con las consultas guardadas»). Las de legal y fiscal llevan fuente y aviso.
- **Coste:** con el tope agotado, el coach no llama al modelo y el asistente lo dice. El coste medido de una revisión semanal queda dentro del tope por ejecución. Con la línea del copiloto agotada, los agentes siguen atendiendo.

## Alternativas consideradas

- **Copiloto y coach como dos productos separados.** Dos ventanas y dos modelos de permisos para lo mismo; la persona no sabe a cuál preguntar.
- **El coach ejecuta solo lo de bajo riesgo.** Rompe «el coach recomienda, no ejecuta» y necesitaría permisos propios en el worker (el *confused deputy* del ADR 0029). Si algún día se quiere, va por los techos de autonomía del ADR 0030 y con decisión de producto.
- **El coach en `apps/web`, con la sesión de cada persona.** Pide que alguien esté conectado para que corra, repite el mismo cálculo por persona y lo vuelve más caro. Además no da más garantías que la lectura cerrada en el worker con RLS en la lectura del resultado.
- **El coach con lectura libre de la base de datos** (SQL generado por el modelo). Más flexible, pero no se puede comprobar cada cifra ni acotar qué lee. Lo descarta la regla de evidencia (§8).
- **El copiloto en el worker con un rol de servicio.** Descartado por el ADR 0029.

## Consecuencias

- Una sola pieza de producto con reglas claras: lo que el copiloto puede hacer está acotado por los permisos de la persona, por un catálogo cerrado y, en el piloto, por la solo lectura.
- **Tablas nuevas** (las migraciones las hace V1 cuando se implemente; este ADR no las crea):
  - `recommendations` y `recommendation_feedback`, con RLS por organización y alcance y sus pgTAP;
  - más adelante, `external_signals` y `signal_matches`.
  - El coach necesita en el worker permisos de lectura sobre las vistas de sus consultas y de escritura sobre `recommendations`, y nada más (ADR 0049).
- **El catálogo de consultas del coach** es código revisado con tests. Añadir una consulta es un PR.
- **El catálogo de herramientas de cambio del asistente** (ADR 0029, «se define en un PR propio») es requisito de `AS4`, no del piloto.
- **Hay que vigilar el coste del coach por organización y el ruido:** si la gente ignora las recomendaciones, se recorta el límite por periodo.
- **Depende de los ADR 0029 y 0024**, propuestos. Se aceptan juntos; si alguno cambia, este se revisa con él.
- **Depende de `PL-ledger`:** la línea de presupuesto propia del copiloto (§7) es requisito para activar el asistente y el coach.

## Preguntas abiertas para producto

1. **Nombre en la interfaz:** ¿«Copiloto», «Asistente» o «Coach»? El MANUAL usa «asistente» (§5.13) y el roadmap «copiloto».
2. **Cambios con alcance de cadena** (después del piloto): el roadmap pide aprobación de un `org_admin` para las propuestas de alcance de cadena y las de zona financiera. ¿Basta con que lo confirme un `org_admin` con MFA, o pide la separación de funciones del ADR 0047 (quien propone no aprueba)?
3. **Frecuencia y límite del coach en el piloto:** la revisión es semanal (`CO1`). ¿Cuántas recomendaciones como máximo por semana? Propuesta: 3.
4. **Patrones entre organizaciones (k ≥ 5):** fuera del piloto. ¿Se usan cuando haya clientes suficientes del mismo sector, o nunca?
5. **Topes por defecto (§7):** ¿cuánto por ejecución y por mes para el coach, y por persona y día para el asistente? Se fijan con el coste medido en las evals con el modelo real, antes de M4.
6. **Grupo mínimo del equipo (§6):** ¿3 personas, o más?

## Verificación

Pendiente: es un borrador sin implementar. Cuando se construya, cada parte cierra con:

- test de que un `staff` no consigue por el asistente datos ni cambios de `org_admin` ni de un local que no ve (falla por RLS o por permisos);
- pgTAP de aislamiento de `recommendations` por organización y alcance, con pruebas en negativo;
- test de que el coach del worker no puede escribir fuera de `recommendations` ni leer fuera de sus vistas;
- tests del catálogo de consultas del coach y del paso que comprueba las cifras;
- las evals del punto 9 en CI.
