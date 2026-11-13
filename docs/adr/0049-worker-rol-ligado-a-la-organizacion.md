# 0049 — Acceso del worker a los datos: transacciones SQL con un rol ligado a la organización y RLS (T1)

- **Estado:** aceptado (producto, 2026-11-12)
- **Fecha:** 2026-11-11
- **Secciones del MANUAL afectadas:** §3.2, §4.4, §18.0 (arquitectura: T1 «ya»)
- **Relación:**
  - auditoría de preproducción §17.3 T1, §18.2 («T1: do it now»), §18.5 V1 #4 y hallazgo G-07;
  - cambia la base técnica del ADR 0003 para el worker (hoy las guardas y RLS no le aplican) sin cambiar su regla: el worker solo llega a los datos de una organización con `createServiceDb().forOrganization(orgId)` (CLAUDE.md, «Prohibido»);
  - usa la ejecución duradera del ADR 0027 (DBOS 5.3.0) y el outbox del ADR 0009;
  - unidad `PL-T1` (M1) de `docs/scope.yaml`.

## Contexto

Hoy el worker lee y escribe por PostgREST con la clave secreta de Supabase, que no pasa por RLS:

- `packages/db/src/service.ts:31-35` crea el cliente con `secretKey`; es la única credencial del worker para los datos de negocio.
- `packages/db/src/tenant-db.ts:1-3` lo dice en su cabecera: «Con la clave secreta no hay RLS: este envoltorio es lo único que separa a un tenant de otro». El envoltorio (`tenant-db.ts:55-97`) añade `organization_id = <org>` a cada consulta y rechaza recursos embebidos, `upsert` y `rpc` genéricos.
- Las tres funciones con nombre (`search_knowledge`, `find_booking_slots`, `agent_turn_context`) reciben la organización como parámetro (`tenant-db.ts:111-118`, `132-139` y `154`): la base de datos se fía de lo que le pasa el worker.
- **Sin transacciones.** Cada lectura y cada escritura es una petición HTTP aparte. Preparar un turno son 9 peticiones seguidas (`apps/worker/src/agents/converse.ts:175-242`: conversación, mensajes, contexto del agente, canal, mensajes recientes, local, ajustes de modelo, servicios y gasto del día). Abrir un run, registrar una ejecución y pasar la conversación a una persona (`converse.ts:293`, `314` y `355`) son escrituras separadas que no se confirman juntas.
- **Las guardas no actúan sobre el worker.** Los triggers `guard_*` solo miran `current_user = 'authenticated'` (p. ej. `20261109230000_inbox_takeover.sql:105` y `142`; ADR 0003).
- **El worker ya tiene una conexión directa a Postgres:** el rol `dbos_worker` (`20261023200100_dbos_worker_role.sql:15-25`), limitado al esquema `dbos`.

Una organización equivocada en una sola llamada, una tabla nueva sin `organization_id` obligatorio o un descuido en el envoltorio bastan para leer o escribir datos de otra organización (G-07). La auditoría estima además que un 42 % de la lógica de backend vive en PL/pgSQL porque es el único sitio con transacciones; esa cifra no la he comprobado.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **A. Seguir como hoy** (envoltorio y clave secreta) | Nada que migrar | Sin RLS ni guardas en el camino que trata datos de clientes; sin transacciones; 9 viajes por turno |
| **B. JWT por organización firmado por el worker, por PostgREST** | Reutiliza PostgREST y las políticas existentes | El worker necesitaría la clave que firma los JWT de Auth: con ella se puede suplantar a cualquier usuario, que es peor que la clave secreta. Sigue sin transacciones |
| **C. Un rol de Postgres compartido, sin `BYPASSRLS`, y la organización fijada en cada transacción** | RLS y guardas sobre el worker; transacciones de verdad; varias lecturas en una consulta; Postgres corriente (menos atadura a Supabase, ADR 0028) | Protege de errores de código, no de un worker comprometido (puede fijar cualquier organización). Hay que escribir políticas para el rol y migrar el acceso módulo a módulo |
| **D. Un rol de Postgres por organización** | Credencial distinta por tenant | Miles de roles y de pools; las contraseñas las guarda el mismo worker, así que un worker comprometido las tiene todas. Solo compensa en celdas dedicadas (ADR 0026) |

## Decisión recomendada

**Opción C.**

1. **Rol `moodly_worker`**, con `LOGIN`, sin `BYPASSRLS` ni superusuario, sin acceso a `auth` ni DDL, y solo los privilegios por tabla y columna que el worker usa hoy. Es distinto de `dbos_worker` y tiene su propia URL (`WORKER_DATABASE_URL`). La migración crea el rol sin login, y se lo da el mismo procedimiento que a `dbos_worker`: el seed en local y el workflow «Staging · worker» en staging.
2. **La organización va en la transacción.** Cada unidad de trabajo empieza con `select set_config('moodly.organization_id', $1, true)` (local a la transacción). `private.worker_organization_id()` la lee; si no está, devuelve `null` y no se ve nada.
3. **Políticas propias del rol:** `for all to moodly_worker using (organization_id = (select private.worker_organization_id())) with check (…)`, en cada tabla de tenant. El test estructural de RLS (`00_rls_enabled.test.sql:58-68`) exige hoy que toda política empiece por `session_is_active()`; se amplía para que las de `moodly_worker` empiecen por esta condición y no por aquella. Esa regla también está en CLAUDE.md y AGENTS.md, que se cambian en el mismo PR.
4. **Las guardas también actúan sobre el worker.** Cada `guard_*` pasa de `current_user = 'authenticated'` a una lista de roles que incluye `moodly_worker`. Si una guarda impide algo que el worker hace legítimamente (por ejemplo, pasar la conversación a `human`), la excepción se escribe en esa guarda, con su test en negativo.
5. **La API no cambia de forma:** `createServiceDb().forOrganization(orgId)` sigue siendo la única puerta. Por dentro abre una transacción con la organización fijada y ofrece consultas tipadas (con `pg`, que el worker ya usa, o un constructor de consultas tipado; se decide en el PR con el ADR 0031 §5). La organización sigue saliendo de la fila del evento, nunca del payload ni del LLM.
6. **Las funciones con nombre pierden el parámetro de organización** y pasan a `SECURITY INVOKER` bajo RLS, o se sustituyen por consultas.
7. **Escrituras exactamente una vez con DBOS.** DBOS 5.3.0 trae una interfaz de fuente de datos transaccional (`DataSourceTransactionHandler`, en `dist/src/datasource.d.ts` de `@dbos-inc/dbos-sdk`) que confirma el paso y su escritura juntos. Se usa para las escrituras del turno si el *spike* lo confirma; si no, se mantienen las claves de idempotencia actuales.
8. **El outbox** (la única lectura entre organizaciones, ADR 0009) usa un rol aparte, `moodly_outbox`, que solo lee los metadatos de `domain_events`.
9. **Migración por módulos**, con el envoltorio actual conviviendo: primero el turno de conversación (`prepare`), después recordatorios, lista de espera y conocimiento. Cuando no quede ninguna llamada, la clave secreta sale del worker (`SUPABASE_SECRET_KEY`).

## Consecuencias

- **Se gana:** RLS y guardas en el camino que trata datos de clientes (cierra G-07); transacciones reales, que permiten pasar lógica de PL/pgSQL a TypeScript tipado; el turno se prepara en una o dos consultas en vez de 9 peticiones HTTP.
- **No se gana:** aislamiento frente a un worker comprometido. Para eso hacen falta celdas o roles por tenant (opción D, ADR 0026). Este ADR no lo afirma.
- **Coste:** una migración sensible con políticas para cada tabla de tenant, la ampliación del test estructural y un cambio de CLAUDE.md y AGENTS.md. Se calculan entre 6 y 10 PRs para migrar el worker entero.
- **Conexiones:** un pool más contra Postgres. Hay que elegir el modo del *pooler* de Supabase (transacción o sesión), porque `set_config(…, true)` solo vale dentro de la transacción y algunas sentencias preparadas no funcionan en modo transacción. Se mide en el *spike*.
- **Vuelta atrás:** cada módulo migrado se puede devolver al envoltorio mientras exista. La migración del rol y de las políticas tiene su `down`.

## Qué la haría «aceptada»

1. Producto dice sí.
2. Un *spike* (un PR) demuestra:
   - en pgTAP, con `moodly_worker` y la organización A fijada, no se lee ni se escribe nada de B; sin organización fijada, no se ve nada; el rol no puede cambiar de rol, saltarse RLS ni tocar `auth`;
   - una guarda rechaza un cambio prohibido hecho por el worker;
   - `prepare` del turno con el rol nuevo, en el test de integración del worker, con la latencia antes y después.

## Verificación

Pendiente: es lo que pide el punto 2 de «Qué la haría aceptada».
