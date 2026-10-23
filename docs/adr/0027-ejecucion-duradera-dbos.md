# 0027 — Ejecución duradera con DBOS Transact sobre Postgres (sustituye a pg-boss + reanudación a mano)

- **Estado:** aceptado por producto el 2026-10-23, tras superar el *spike* ese mismo día (ver «Resultados del *spike*»)
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §3.1, §3.2 (cola de trabajos, worker), §5.1, §5.7, §5.8, §5.11, §14
- **Sustituye en parte a:** el futuro ADR 0006 (cola en Postgres con pg-boss); se mantiene «todo en Postgres» y el worker siempre encendido.

## Contexto

El runtime necesita:

- reanudar una ejecución tras una aprobación o una espera de horas (`awaiting_approval`, `awaiting_knowledge`, §5.7);
- reintentar un paso sin repetir sus efectos (una cita no se crea dos veces);
- **una sola ejecución a la vez por conversación**;
- tareas programadas (coach diario, recordatorios);
- prioridades `realtime` / `normal` / `batch` y equidad entre tenants;
- sobrevivir a un despliegue o a la caída de un worker a mitad de un run.

Con pg-boss, todo eso se construye a mano: una máquina de estados del run, *checkpoints* por paso, reanudación y deduplicación. Es justo el problema que resuelven los motores de ejecución duradera, y hacerlo a mano es la fuente clásica de efectos duplicados y runs perdidos.

## Decisión

Usar **DBOS Transact (TypeScript)** como motor de ejecución duradera en `apps/worker`:

- Es una **librería** dentro del worker, no un servidor más: guarda el estado de cada workflow y de cada paso en **Postgres** (esquema `dbos`, ADR 0026). Tras una caída, el workflow continúa desde el último paso completado.
- Trae **colas** con límites de concurrencia y de frecuencia, y **workflows programados**, así que **pg-boss deja de hacer falta**.
- Tiene integración con el **Vercel AI SDK**, que ya es nuestra capa de modelos (ADR 0019).
- Es *open source*, funciona con cualquier Postgres y no exige ningún servicio de DBOS. Eso lo hace portable a celdas dedicadas y BYOC (ADR 0028). El panel gestionado de DBOS es opcional y **no** se usa con datos de clientes.

### Cómo se usa

- **Un run = un workflow.** Cada llamada al modelo y cada `execute` de skill es un **paso**; el resultado de cada paso queda guardado, y al reanudar no se repite.
- **ID del workflow determinista** (por ejemplo, `inbound:<inbound_event_id>`): el mismo webhook dos veces no crea dos runs.
- **Una ejecución por conversación:** cola con clave de partición por `conversation_id` y `partitionConcurrency: 1` (el *spike* confirmó que el motor lo permite; no hace falta `pg_advisory_xact_lock`).
- **Aprobaciones:** el workflow espera un evento (`approval.decided`) con caducidad; mientras espera no ocupa memoria ni CPU.
- **Prioridades:** tres colas (`realtime`, `normal`, `batch`) con su concurrencia, más un límite de concurrencia por organización para que un tenant con un pico no frene a los demás.
- **Outbox (§5.8):** el publicador de `domain_events` es un workflow programado que encola un workflow por suscripción.
- Las skills siguen siendo idempotentes con `idempotency_key` (§5.5): el motor evita repetir pasos completados, pero un paso que falla a mitad de una llamada externa puede reintentarse.

### Aislamiento del motor

Solo `apps/worker` importa DBOS. `packages/agent-core` define su propia interfaz (`RunContext`, `step()`, `waitFor()`), y el worker la implementa con DBOS. Si hubiera que cambiar de motor, se cambia esa implementación.

## Alternativas consideradas

- **pg-boss + máquina de estados propia** — lo que había; es justo lo que se quiere evitar.
- **Temporal** — el estándar más probado, pero exige operar un clúster aparte (o Temporal Cloud, otro subencargado y otra región que vigilar). Mucho peso para el piloto y para cada celda BYOC. Es la opción de salida si DBOS no cumple.
- **Inngest / Trigger.dev** — buenos productos, pero son un servidor aparte (o un servicio en la nube): una pieza más en cada celda y en BYOC.
- **Vercel Workflow** — también tiene un *backend* sobre Postgres para fuera de Vercel, pero es más reciente; se vuelve a mirar si DBOS no cumple.

## Consecuencias

- Cambian MANUAL §3.2 (cola), `CLAUDE.md`/`AGENTS.md` (stack) y la tarea 6 de la Fase 0: «worker con DBOS: un workflow encolado desde la web, procesado por el worker y reanudado tras matar el proceso».
- Es una dependencia nueva (zona sensible): requiere revisión humana al añadirla.
- El estado de DBOS vive en el esquema `dbos` con su propia retención, y se puede llevar a otra base de datos si su carga lo pide (ADR 0026).

## Verificación (*spike* antes de aceptar)

1. Un run de 3 pasos; se mata el worker tras el paso 2 y, al arrancar, solo se ejecuta el paso 3.
2. El mismo webhook enviado dos veces crea un solo run.
3. Dos mensajes seguidos de la misma conversación se procesan en orden y nunca a la vez; dos conversaciones distintas, en paralelo.
4. Un run espera una aprobación, el worker se reinicia y, al aprobar, el run continúa.
5. La licencia y la versión exacta de la librería se confirman y se anotan aquí.

## Resultados del *spike* (2026-10-23)

Ejecutado en local contra el Postgres de Supabase (`supabase start`, CLI 2.118.0), con Node 22, procesos reales y `SIGKILL` (no simulado). Cada paso apuntaba su efecto en una tabla aparte para contar las ejecuciones reales. El script está en `docs/adr/0027-spike/`.

**Librería:** `@dbos-inc/dbos-sdk` **5.2.11** (publicada el 2026-09-29; la 5.3.0 tiene menos de dos semanas), licencia **MIT**, Node ≥ 20. Dependencias: `pg`, `yaml`, `commander`, `superjson`, `serialize-error` y `ws` (este último solo para el panel gestionado, que no se usa).

| # | Criterio | Resultado |
|---|---|---|
| 1 | Run de 3 pasos; `SIGKILL` tras el paso 2 | ✅ Los pasos 1 y 2 se ejecutaron una vez, en el proceso que murió; al arrancar otro proceso, solo el 3. El workflow termina en `SUCCESS`. |
| 2 | El mismo webhook dos veces | ✅ Con ID `inbound:<id>`: cuatro arranques (dos a la vez desde dos procesos, dos después) dejan **un** run y **un** efecto. Volver a encolar un ID ya terminado devuelve su resultado sin repetirlo. |
| 3 | Orden por conversación | ✅ Cola con `partitionConcurrency: 1` y `queuePartitionKey = conversación`, 3 workers con executor distinto, 35 mensajes de 5 conversaciones encolados desde dos clientes a la vez: 0 solapes y 0 desórdenes dentro de una conversación, 87 solapes entre conversaciones distintas, 3,6 s en total (8 mensajes de 0,4 s seguidos de una misma conversación). |
| 4 | Aprobación tras reiniciar | ✅ El run espera con `recv("approval.decided", { timeoutSeconds })`. Se mata el worker mientras espera; la aprobación llega con el worker caído (y en otra prueba, con el worker ya reiniciado y esperando): el run continúa y `execute` se ejecuta una vez. La misma aprobación enviada dos veces con la misma clave de idempotencia deja un solo mensaje. |
| 5 | Licencia y versión | ✅ MIT, 5.2.11 exacta. |

### Lo que el *spike* obliga a fijar en el worker

1. **Un `executorID` único y estable por proceso vivo.** Al arrancar, DBOS vuelve a encolar todos los workflows `PENDING` de su `executorID`, aunque otro proceso vivo con el mismo ID los esté ejecutando. Comprobado: con dos procesos solapados con el mismo ID, el paso en curso se ejecutó dos veces (el resultado del workflow se guardó una sola vez y el paso siguiente, una). Por tanto, un despliegue no puede solapar el proceso viejo y el nuevo con el mismo ID.
2. **Los pasos en curso son «al menos una vez».** Un paso interrumpido a mitad se repite al reanudar (también comprobado tras un `SIGKILL`). Lo que ya decía este ADR se vuelve obligatorio: toda skill con efectos externos lleva `idempotency_key` (§5.5).
3. **Nadie adopta solo el trabajo de un worker muerto con otro ID** (sin el panel gestionado). Sus runs se quedan en `PENDING` y su conversación queda parada: los mensajes siguientes esperan, así que el orden se mantiene. Se recuperan de dos formas, ambas comprobadas con el orden intacto:
   - arrancando un proceso con el mismo `executorID` (la recuperación de serie devuelve cada run a su cola, con su partición y su fecha de alta);
   - adoptándolos desde otro proceso: `listWorkflows({ executorId, status: "PENDING" })` y `resumeWorkflow(id, { queueName: <su cola> })`. **Sin `queueName`, `resumeWorkflows` los manda a la cola interna y rompe el orden**: comprobado, el mensaje 2 de la conversación se ejecutó antes que el 1.
4. **La cola de conversaciones no usa `priority`.** Se desencola por `priority` y después por fecha de alta, así que una prioridad distinta dentro de una conversación cambiaría su orden. Las prioridades `realtime` / `normal` / `batch` son colas distintas, y todos los mensajes de una conversación van a la misma.
5. **Una cola admite una sola clave de partición.** No puede limitar a la vez por conversación y por organización. El límite por organización (equidad entre tenants) queda por diseñar con el worker; por ejemplo, en la cola `batch` partida por organización.
6. **El esquema `dbos` lo crea el CI, no el worker.** Con `runMigrations: false`, el worker no toca el esquema y no arranca si falta o está atrasado (comprobado: «schema version 0, but this version of DBOS requires 123»). El esquema se crea con un rol con privilegios (`npx dbos schema --app-role <rol>`, o el SQL de `--print-migrations all` como migración de Supabase), y el worker usa un rol sin DDL (comprobado: «permission denied for schema»). Así se cumple «solo el CI migra staging y producción».
7. **`applicationVersion` explícita.** La recuperación y las colas solo recogen runs de la misma versión, y por defecto la versión es un hash del código. Se fija por despliegue, y un cambio en el código de un workflow con runs a medias sigue el procedimiento de versiones de DBOS.
8. **Conexión de sesión, no de transacción.** DBOS usa `LISTEN/NOTIFY` para despertar las esperas, y el *pooler* de Supabase en modo transacción no lo admite. El worker se conecta en modo sesión o directo. **No probado contra el Postgres alojado**: se comprueba al montar el worker en staging.
