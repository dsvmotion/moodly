# 0026 — Un solo Postgres al principio: reparto de cargas, umbrales y plan de salida por celdas

- **Estado:** propuesto
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §3.2, §3.4, §4.2, §10.5, §12, §14

## Contexto

El diseño pone en el mismo Postgres los datos de los tenants, la cola de trabajos, los vectores, el outbox, la auditoría y el consumo. Para el piloto es lo correcto: transacciones entre datos y trabajos, una sola copia de seguridad, RLS en todo y cero infraestructura extra. El riesgo es que, con escala, cargas muy distintas compitan por la misma CPU, memoria, conexiones y espacio:

- la cola y la ejecución duradera escriben mucho y en ráfagas;
- los vectores necesitan memoria para sus índices;
- `audit_logs`, `inbound_events` y `usage_records` crecen sin límite;
- la analítica y el coach hacen lecturas largas.

No había ni umbrales ni plan de salida escritos.

## Decisión

### 1. Separación lógica desde el primer día

| Esquema | Contenido | Por qué |
|---|---|---|
| `public` | Datos de tenants (con RLS) | — |
| `private` | Helpers de RLS y guardas | Ya existe |
| `dbos` | Estado de la ejecución duradera (ADR 0027) | Se puede mover a otra base de datos cambiando una URL |
| `audit` | `audit_logs` (append-only) | Particionado y retención propios |

Separar después es mover un esquema, no rehacer el modelo.

### 2. Lo que nunca va a Postgres

- Prompts completos, respuestas del modelo y trazas: van a **Langfuse** (en la región de la celda, §12.2). En Postgres solo quedan los identificadores, tokens, coste, latencia y el `trace_id`.
- Ficheros: a **Storage**.

### 3. Tablas que crecen sin límite: particionadas y con retención

- `audit_logs`, `inbound_events`, `usage_records` y `messages`: particionado por mes desde su primera migración.
- `inbound_events.raw`: retención de 30 días (configurable). Lo que hace falta conservar ya está en `messages`.
- `audit_logs`: las particiones viejas se exportan a almacenamiento de objetos (formato abierto) antes de soltarlas, según la retención del plan.

### 4. Conexiones

- La app web usa el *pooler* de Supabase (modo transacción).
- El worker usa un pool propio y acotado. La concurrencia de la cola se limita por configuración, no por «lo que aguante la base de datos».

### 5. Umbrales de salida (iniciales; se recalibran en el piloto)

| Señal sostenida 7 días | Acción, en este orden |
|---|---|
| CPU de la base de datos > 60 % o latencia p95 de consultas de la app > 100 ms | 1) Optimizar consultas e índices. 2) Subir de tamaño de instancia. |
| Lecturas de analítica o coach > 20 % de la carga | **Réplica de lectura** para analítica, informes y coach. |
| Escrituras de `dbos` > 30 % de las escrituras, o retraso de la cola p95 > 5 s | Mover el esquema `dbos` a **su propia base de datos** (ADR 0027 lo permite). |
| Consultas vectoriales p95 > 150 ms | Escalones del ADR 0025 (partición o celda). |
| Más de N tenants o un tenant grande que domina la carga | **Nueva celda** (punto 6). |

### 6. La escala horizontal es por celdas, no por romper la base de datos en servicios

Una **celda** es una copia completa de la plataforma (base de datos + workers + Storage + Langfuse) en una región, que aloja un conjunto de organizaciones (ya propuesto en `arquitectura-agentes-enterprise.md` §6):

- **celda compartida UE**: las pymes;
- **celda dedicada**: un cliente grande, en la región que elija;
- **BYOC**: una celda en la nube del cliente (ADR 0028).

Cada organización vive en **una sola celda**. Un pequeño **directorio global** (organización → celda y región) dirige el login y los webhooks. Así nunca hacen falta consultas entre bases de datos, y el aislamiento entre clientes grandes pasa a ser físico.

## Alternativas consideradas

- **Separar ya en servicios (Redis para la cola, base vectorial, ClickHouse para auditoría)** — más piezas, más subencargados y más fallos parciales, sin necesidad medida. Se pierde la transacción entre datos y trabajos.
- **Sharding de una sola base de datos (Citus)** — complejidad alta; las celdas resuelven lo mismo con un modelo más sencillo y además dan residencia por región.

## Consecuencias

- Las primeras migraciones de `audit_logs`, `inbound_events`, `usage_records` y `messages` deben nacer particionadas (requieren revisión humana).
- Hace falta el directorio de celdas antes de la segunda celda, no antes.
- Requiere monitorización de la base de datos con alertas en estos umbrales (Fase 0, junto a la observabilidad).

## Verificación

- Prueba de carga antes del primer cliente: 50 organizaciones sintéticas con tráfico de mensajes simulado, midiendo CPU, latencia p95 y retraso de la cola.
- Test que comprueba que las tablas de §3 están particionadas.
