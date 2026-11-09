# 0048 — Embeddings del conocimiento elegidos por eval, e ingesta de las fuentes de texto

- **Estado:** aceptado (producto, 2026-11-09: «embeddings elegidos por eval en el conocimiento v0», MANUAL §18)
- **Fecha:** 2026-11-09
- **Secciones del MANUAL afectadas:** §4.2 (`knowledge_sources.body`), §6.1 (ingesta y proveedor de embeddings)
- **Relación:**
  - cierra lo que el ADR 0037 dejaba abierto: qué modelo hace los embeddings y quién ingiere las fuentes;
  - usa Vercel AI Gateway, como el transporte de los agentes (ADR 0033 §7), con la misma regla de política por organización (ADR 0035);
  - la ingesta es un consumidor del outbox (ADR 0009) en el worker de DBOS (ADR 0027).

## Contexto

Atención al cliente (B20) tiene que contestar con el conocimiento del negocio: preguntas frecuentes, precios, políticas. El ADR 0037 dejó las tablas y la búsqueda, pero sin modelo de embeddings ni ingesta. Faltaba:
- elegir el modelo con datos, no a ojo;
- que el `org_admin` pueda escribir el texto de una fuente;
- trocearla, sacar sus vectores y guardarlos, también cuando el texto cambia.

## Decisión

1. **Modelo: `openai/text-embedding-3-small`, 1536 dimensiones, por el gateway** (`GATEWAY_EMBEDDING` en `@repo/config`; el código de negocio no lleva el ID). Elegido con una eval (punto 5):
   - empata con los mejores dentro del ruido de 40 preguntas (recall@1 0,950, recall@3 1,000, MRR 0,967);
   - es el más barato (0,02 $ por millón de tokens: indexar una fuente de 20.000 caracteres cuesta unos 0,0001 $);
   - sus 1536 dimensiones caben en un índice HNSW de pgvector (máximo 2000), para cuando haga falta el segundo escalón del ADR 0025;
   - es el único de los primeros con región UE listada en el gateway. El gateway no garantiza esa región en cada llamada, así que para «Solo UE» la vía cuenta como fuera de la UE (punto 4), igual que el transporte de los agentes.

   `text-embedding-3-large` y `cohere/embed-v4.0` sacan un fallo menos (0,975 / 1,000 / 0,988) por 6 veces el precio; el primero, con 3072 dimensiones, no cabe en HNSW, y el segundo solo lista región de EE. UU. Se revalúa con conversaciones reales anonimizadas (fase 4).
2. **Fuentes de texto (`knowledge_sources.body`):** hasta 20.000 caracteres, escritos por el `org_admin` con `aal2`, con las mismas políticas que el título.
   - Cambiar el texto devuelve la fuente a `pending` (guarda `guard_knowledge_source`). La app sigue sin poder tocar el estado.
   - Crear una fuente o devolverla a `pending` emite `knowledge_source.pending` con solo su id; el tenant sale de la fila. Lo escribe `emit_knowledge_source_event`, `SECURITY DEFINER` porque quien cambia la fuente no puede escribir en `domain_events`: solo inserta el evento de esa fila y nadie de la app puede llamarla.
   - Las fuentes de archivo (`storage_path`, PDF y DOCX) llegan después.
3. **Ingesta: el consumidor `knowledge.ingest` del worker**, en un solo paso de DBOS para que los vectores no se guarden en la base de datos de DBOS (si el paso se repite, se reemplaza todo otra vez):
   - lee el texto que tiene la fuente al procesar, no el del evento;
   - comprueba la política de modelos de la organización con `policyAllows`, la misma regla que el enrutador (punto 4);
   - trocea con `chunkText` (`@repo/knowledge`): por párrafos, juntando los cortos y partiendo los largos por frases, con el título de la fuente delante de cada trozo y como mucho 1000 caracteres;
   - saca los embeddings, comprueba que hay uno por trozo con la dimensión del modelo y valores finitos;
   - antes de escribir, comprueba que el texto no cambió mientras tanto; si cambió, no escribe nada (lo hará la entrega de ese cambio);
   - borra los fragmentos viejos de la fuente, inserta los nuevos con `embedding_model` y `embedding_dim`, y la deja `ready`;
   - si los embeddings fallan o la política no lo permite, la deja en `error`;
   - `ready` y `error` solo se ponen si la fuente sigue en `processing`: si el texto cambió a mitad, se queda en `pending` hasta su entrega.

   El worker solo registra `knowledge.ingest` si tiene `AI_GATEWAY_API_KEY`; sin ella, las fuentes que se creen o cambien se quedan en `pending`.
4. **La política de la organización también manda en los embeddings.** El enrutador del ADR 0033 todavía no sirve la tarea `embed`, así que la ingesta llama al gateway directamente, pero con la misma regla (`policyAllows`): con «Solo UE», o con proveedores permitidos que no incluyan el gateway, no se envía el texto y la fuente queda en `error`. Cuando el enrutador sirva `embed`, la ingesta pasará por él.
5. **Eval reproducible en `packages/evals`** (`src/embeddings`): 24 fragmentos de un centro de estética inventado y 40 preguntas de clientes, en español y en inglés, coloquiales y con faltas. Mide recall@1, recall@3 y MRR por similitud coseno. Los tests comprueban el set y la puntuación sin red; con modelos de verdad se corre a mano, porque llama a la red y cuesta:

   `AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:embeddings openai/text-embedding-3-small:1536 cohere/embed-v4.0:1536`

## Alternativas consideradas

- **`text-embedding-3-large` o `cohere/embed-v4.0`.** Un fallo menos en 40 preguntas, que está dentro del ruido, por 6 veces el precio; y uno no cabe en HNSW y el otro no lista región UE.
- **Indexar en la web, al guardar.** La web no debe llamar a un proveedor de modelos con la clave de la plataforma ni esperar a la red; además, si el proveedor falla, se pierde. El outbox lo entrega aunque el worker se reinicie.
- **Trocear por tamaño fijo.** Corta frases y párrafos por la mitad. El MANUAL §6.1 pide trocear por secciones.
- **Guardar los vectores en un paso y escribirlos en otro.** Llenaría la base de datos de DBOS con miles de números por fuente.

## Consecuencias

- El coste de los embeddings no se cuenta todavía en el gasto por organización ni en los créditos (es del orden de 0,0001 $ por fuente). Llega con el registro de uso (MANUAL §15).
- Si una fuente queda en `error` o en `pending` sin clave, solo se reindexa cambiando su texto. La pantalla de conocimiento (B20-3) añadirá «volver a indexar».
- El texto de las fuentes sale hacia el proveedor de embeddings. Es contenido del negocio, no datos de clientes; la pantalla de conocimiento lo dirá (MANUAL §6.1, «Datos sensibles»).
- Un cambio de modelo es una reindexación por organización, sin mezclar vectores: cada fila dice con qué modelo se hizo (ADR 0025 §3).

## Verificación

- **pgTAP `35_knowledge_text`** (16): quién escribe el texto (con y sin `aal2`, el equipo, otra organización), los límites, que cambiar el texto la devuelve a `pending` y emite el evento, que el título solo no, que `processing` y `ready` no emiten nada y que nadie de la app puede llamar a la función del evento.
- **Integración con un worker de verdad** (`knowledge/ingest.integration.ts`, 6 tests, embeddings falsos y deterministas): fragmentos con su título, su alcance y el vector de su texto, y la fuente se encuentra con `search_knowledge`; cambiar el texto reemplaza los fragmentos; un cambio a mitad de indexar no deja los fragmentos viejos; si los embeddings fallan, `error` y sin fragmentos; con «Solo UE», `error` sin llamar al proveedor; una fuente sin texto se queda en `pending`.
- **12 mutantes de la ingesta** (cada uno cambia `ingest.ts` y corre la integración): 11 detectados. Sobrevive quitar la condición `processing` al poner `ready`: si el texto cambia justo entre la comprobación y ese paso, la fuente queda `ready` con los fragmentos viejos un momento, hasta que la entrega del cambio la reindexa; el estado final es el mismo.
- **Con el gateway de verdad (en local, 2026-11-09):** el worker de `main.ts` con clave indexó una fuente de Demo A (un fragmento de `openai/text-embedding-3-small`, 1536 dimensiones) y `search_knowledge`, con el embedding real de «si no voy a la cita me cobráis algo?», la encontró.
- **`gateway-embedder.test.ts`**, sin red, con el modelo de prueba del AI SDK: el modelo de la configuración, por lotes, y solo vectores de su dimensión; la vía es la del transporte del gateway.
- **`router.test.ts`:** `policyAllows` con residencia, proveedores y modo de conexión.
- **Eval** (`packages/evals`): el set y la puntuación, sin red; los números de arriba, con el gateway (2026-11-09).
