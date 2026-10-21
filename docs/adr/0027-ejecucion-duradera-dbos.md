# 0027 — Ejecución duradera con DBOS Transact sobre Postgres (sustituye a pg-boss + reanudación a mano)

- **Estado:** propuesto (se acepta tras el *spike* de la sección «Verificación»)
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
- **Una ejecución por conversación:** cola con clave de partición por `conversation_id` si el motor lo permite. Si no, un `pg_advisory_xact_lock` por conversación al inicio del run. Lo decide el *spike*.
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
