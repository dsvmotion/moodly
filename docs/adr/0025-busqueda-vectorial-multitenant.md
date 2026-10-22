# 0025 — Búsqueda vectorial con muchas empresas en un solo Postgres

- **Estado:** propuesto
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §3.2 (búsqueda semántica), §4.2 (`knowledge_chunks`, `memories`, `external_signals`), §6.1, §6.2

## Contexto

El conocimiento, la memoria y las señales se guardan con pgvector en el mismo Postgres, con un `organization_id` por fila (§6.1). El problema conocido de este diseño:

- Un índice aproximado (HNSW) devuelve los K vecinos más cercanos **de toda la tabla**, y después Postgres aplica el filtro `organization_id = X`. Con miles de empresas, casi todos esos vecinos son de otras empresas y se descartan: se piden 10 resultados y llegan 2 o ninguno (*overfiltering*). El agente «no sabe» algo que sí está en su conocimiento.
- El fallo es silencioso: no da error, solo peor recuerdo (*recall*).
- pgvector 0.8.0 añadió los **escaneos iterativos** (`hnsw.iterative_scan`), que siguen recorriendo el índice hasta llenar los resultados tras el filtro, con un tope (`hnsw.max_scan_tuples`). Ayudan, pero no sustituyen a un buen diseño.

## Decisión

### 1. Una sola función de recuperación, nunca SQL suelto

Toda búsqueda pasa por una función de `packages/knowledge` (y su equivalente SQL) que:

- recibe `organization_id` y el alcance **del runtime**, nunca del LLM;
- filtra por organización y alcance **antes** de ordenar;
- hace búsqueda **híbrida**: vectorial + texto completo (`tsvector`), combinadas con *Reciprocal Rank Fusion*;
- fija `SET LOCAL hnsw.iterative_scan = relaxed_order` y un `hnsw.max_scan_tuples` acotado en su transacción.

### 2. Tres escalones según el tamaño del tenant

| Escalón | Cuándo | Cómo |
|---|---|---|
| **Búsqueda exacta** | Tenant con pocos fragmentos (umbral inicial: < 20.000 por tabla) | Índice B-tree por `(organization_id, scope, scope_id)`. El planificador lee solo las filas del tenant y calcula la distancia exacta: recall del 100 % y unos pocos ms. Es el caso de casi todas las pymes. |
| **HNSW global + escaneo iterativo** | Tenants medianos | Índice HNSW sobre toda la tabla con escaneo iterativo. |
| **Partición o celda propia** | Tenant grande (umbral inicial: > 1 M de fragmentos) o tabla > 20 M de filas | Particionado por hash de `organization_id` con un HNSW por partición; y los clientes más grandes, a una **celda dedicada** (ADR 0026). |

Los umbrales son iniciales y se recalibran con medidas reales del piloto.

### 3. Versión del modelo de embeddings en cada fila

`embedding_model` y `embedding_dim` en cada fila. Cambiar de modelo es una reindexación en segundo plano por tenant, con lectura del modelo antiguo hasta que termine. Nunca se mezclan vectores de modelos distintos en una misma consulta.

### 4. El recall se mide, no se supone

- **Eval de recuperación en CI** con un conjunto sintético multi-tenant (muchas empresas pequeñas y algunas grandes): recall@10 de la búsqueda aproximada frente a la exacta, **≥ 0,95** por tenant. Si baja, bloquea el merge.
- Métrica en producción: resultados devueltos frente a pedidos, por tenant. Una caída es una alerta.

## Alternativas consideradas

- **Una base vectorial aparte (Pinecone, Qdrant, Weaviate)** — resuelve el filtrado con *namespaces*, pero saca los datos del tenant de Postgres y de RLS, añade un subencargado, duplica el borrado RGPD y complica el BYOC. Se reconsidera solo si Postgres no llega con los tres escalones.
- **Un índice HNSW parcial por tenant** — perfecto para unos pocos tenants grandes, inmanejable con miles.
- **Una tabla o un esquema por tenant** — rompe las migraciones únicas y el modelo de RLS.

## Consecuencias

- Requiere pgvector ≥ 0.8 en todos los entornos (local, Supabase alojado y BYOC). Se comprueba al crear la primera tabla con vectores.
- La recuperación queda encapsulada: cambiar de escalón no toca a quien la usa.

## Verificación

- Test de integración: con 1.000 tenants sintéticos, una consulta del tenant X devuelve solo filas de X y los K resultados pedidos.
- Eval de recall en CI con el umbral anterior.
- `EXPLAIN ANALYZE` documentado en el PR que cree la primera tabla con vectores.
