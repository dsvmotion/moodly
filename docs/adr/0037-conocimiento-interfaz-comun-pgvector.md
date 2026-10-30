# 0037 — Conocimiento: una interfaz común (`KnowledgeRetriever`) y pgvector como primer motor

- **Estado:** propuesto (2026-10-31)
- **Fecha:** 2026-10-31
- **Secciones del MANUAL afectadas:** §4.2 (`knowledge_sources`, `knowledge_chunks`), §6.1
- **Relación:**
  - concreta el ADR 0025 (búsqueda vectorial con muchas empresas): una sola función de recuperación, filtro antes de ordenar, búsqueda híbrida y modelo de embeddings en cada fila;
  - el roadmap enterprise §3.5 (una interfaz y varios motores);
  - el control 3.8 del ADR 0047 (lo recuperado es dato, no instrucción);
  - los embeddings pasan por el enrutador (tarea `embed`, ADR 0033) cuando haya un proveedor activo.

## Contexto

Los agentes necesitan el conocimiento del negocio (FAQ, precios, políticas, la web del centro) y lo tienen que encontrar sin ver nunca el de otra empresa ni el de otro local. Además, un cliente grande puede pedir que se use su propio índice (Azure AI Search, Google Agent Search). Faltaban:
- las tablas;
- la búsqueda;
- una interfaz que no dependa del motor.

Este paso no activa ningún proveedor de embeddings ni ingiere ninguna fuente.

## Decisión

1. **`knowledge_sources`:** de dónde sale cada conocimiento, de toda la organización o de un local (`location_id`; el MANUAL hablaba de `scope` y `scope_id`).
   - **Quién la ve:** quien ve su alcance.
   - **Quién la gestiona:** el `org_admin`, con `aal2`. El autor y el estado (`pending`) los pone la base de datos, y la app solo cambia el título.
   - **La ingesta** (worker) la mueve de `pending` a `processing` y después a `ready` o `error`. Solo se busca en `ready`.
   - **El alcance de una fuente no cambia.**
2. **`knowledge_chunks`:** los fragmentos de cada fuente, siempre de su misma organización (clave externa compuesta). Cada uno lleva:
   - su texto;
   - su embedding, con el modelo que lo hizo y su dimensión. La columna `vector` no tiene dimensión fija, y una restricción comprueba que el vector tiene la que dice;
   - su `tsvector` con la configuración `simple`, que no saca raíces de un idioma (inglés por defecto, español como alternativa);
   - opcionalmente, una fecha de caducidad.

   Reglas:
   - **El alcance del fragmento lo copia la base de datos de su fuente**, también al actualizarlo. Quien inserta no puede dejar visible para toda la organización un fragmento de un local.
   - La app solo lee fragmentos; los escribe la ingesta.
3. **`search_knowledge`, la única búsqueda** (ADR 0025 §1):
   - organización, local y modelo los pone el runtime;
   - filtra antes de ordenar: un run de organización solo ve lo de toda la organización, y uno de local ve eso y lo de su local, nunca lo de otro;
   - solo usa fragmentos de fuentes listas, vigentes y del mismo modelo. Con un vector de otra dimensión falla, no adivina;
   - es híbrida (distancia del coseno y texto completo), combinadas con *Reciprocal Rank Fusion* (k = 60), y devuelve como mucho 50;
   - **solo la puede llamar la plataforma** (`service_role`). La app no busca directamente: llegará el asistente con sus propios permisos (ADR 0029).
4. **Escalón de búsqueda exacta** (ADR 0025 §2):
   - no hay índice aproximado. Un índice B-tree por organización, modelo y local lleva al planificador a las filas del tenant, y la distancia se calcula exacta, con un recall del 100 %;
   - con 1.000 organizaciones y 20.000 fragmentos de 1.536 dimensiones, la consulta de una organización lee solo sus 20 filas y tarda 1,7 ms (`EXPLAIN ANALYZE` en el PR);
   - el índice HNSW y su eval de recall@10 ≥ 0,95 llegan con el primer tenant que pase el umbral.
5. **El worker busca con `createServiceDb().forOrganization(org).searchKnowledge(...)`.** Es la única función con nombre que admite `tenantDb`, y la organización la pone el acceso, no quien llama.
6. **`packages/knowledge`:**
   - **`KnowledgeRetriever`**, la interfaz común: alcance del runtime, consulta y `k`;
   - **`createPgvectorRetriever`**, el motor de ahora. Comprueba la consulta y el vector antes de buscar, y devuelve cada fragmento **marcado como dato no confiable** (`knowledge:<source_id>`) y **con su cita** (fuente, tipo y título), venga del motor que venga;
   - **`Embedder`**, con un falso determinista para tests y evals. El real pasará por el enrutador y lo elegirá una eval (MANUAL §18).

## Alternativas consideradas

- **Una base vectorial aparte (Pinecone, Qdrant…).** Ya descartada en el ADR 0025: saca los datos de Postgres y de RLS, y duplica el borrado RGPD.
- **Una dimensión fija en la columna (`vector(1536)`).** Permitiría HNSW desde ya, pero ataría el esquema a un modelo antes de elegirlo por eval. Con pocas filas por tenant no hace falta índice aproximado, y cuando haga falta irá con su dimensión, por modelo.
- **Dejar que la app busque con RLS.** Funcionaría, pero hoy nadie lo necesita, y el asistente (ADR 0029) lo hará con sus propias reglas.
- **El alcance del fragmento como dato de quien inserta.** Un error en la ingesta haría visible para toda la organización el conocimiento de un local.

## Consecuencias

- **La ingesta** (subida a Storage, extracción, troceado por secciones, embeddings y paso a `ready`) llega con las primeras fuentes reales (B19). Necesitará el `Embedder` real a través del enrutador.
- **Cambiar de modelo de embeddings** es reindexar por tenant en segundo plano, leyendo el modelo viejo hasta que termine (ADR 0025 §3).
- **Los motores del cliente** (`AzureAiSearchRetriever`, `AgentSearchRetriever`) se añaden detrás de la misma interfaz cuando un cliente los pida, con credenciales en el `SecretVault`.

## Verificación

- **pgTAP `25_knowledge`:** 30 tests.
  - La búsqueda solo devuelve lo de la organización, lo de toda ella y lo de su local, del mismo modelo, listo y vigente, con RRF y como mucho `k`.
  - Falla con otra dimensión.
  - El alcance se copia de la fuente, también al actualizar.
  - Quién ve y gestiona fuentes y fragmentos.
  - Con 1.000 organizaciones, la búsqueda de una devuelve los 10 pedidos, todos suyos.

  19 mutaciones de la migración, todas detectadas.
- **`tenantDb.searchKnowledge`:**
  - 4 tests unitarios: la organización no se cambia desde fuera, ni con un cast;
  - 1 de integración contra PostgREST real;
  - 3 mutaciones, todas detectadas.
- **`packages/knowledge`:** 14 tests y 7 mutaciones, todas detectadas.
