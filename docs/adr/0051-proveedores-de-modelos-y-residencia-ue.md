# 0051 — Todos los proveedores de modelos detrás del enrutador, con la UE por defecto (T6)

- **Estado:** propuesto
- **Fecha:** 2026-11-11
- **Secciones del MANUAL afectadas:** §3.2, §5.11, §11, §15 (registro por llamada), §18.0 #4 y #6, §18.1 #5
- **Relación:**
  - auditoría de preproducción §17.3 T6, §18.1 #4 y #6, §18.2 («Model providers»), §18.5 V1 #2 y #3, hallazgos H-01 y B-01;
  - fija lo que los ADR 0033 y 0035 dejaron «cambiado en parte» el 2026-11-10: proveedores y residencia `eu` por defecto;
  - decisión de producto del 2026-11-11: los agentes usan el modelo más barato que pasa las evals;
  - unidades `PL-T6` (M1), `SE02` (M1) y `PL-ledger` (M1) de `docs/scope.yaml`; puerta de M1: «an `eu` organization completes a turn».

## Contexto

- **Una sola vía, y no es de la UE.** El único transporte es el de Vercel AI Gateway (`packages/agent-core/src/models/transports/gateway.ts:131-132`: proveedor `vercel-ai-gateway`, región `other`), y el de embeddings igual (`gateway-embedder.ts:36`). El worker no registra otro (`apps/worker/src/agents/model-router.ts:18`).
- **«Solo UE» apaga la IA** (H-01). Con `residency = 'eu'` el enrutador exige `route.region === "eu"` (`router.ts:156`); ningún transporte cumple, así que cada conversación pasa a una persona y el conocimiento no se indexa ni se busca.
- **`allowed_providers` compara con el nombre de la vía**, no con el proveedor real (`router.ts:157`): permitir `anthropic` también apaga la IA, porque el transporte se llama `vercel-ai-gateway`.
- **La residencia por defecto sigue en `any`** (`20261030120000_org_model_settings_secrets.sql:24`), contra la decisión de producto #6.
- **No se registra el proveedor ni la región de cada llamada:** `agent_runs` guarda el modelo, los tokens y el coste (`20261030090000_runs_executions_approvals.sql:66-69`), pero no por dónde fue.
- **Coste (B-01):** conversar usa `smart` (`packages/config/src/index.ts:45`), el modelo más caro (`:63-64`).
- El enrutador ya está hecho para esto: cada transporte declara proveedor, región, vía y modo de conexión, y la política filtra antes de llamar (ADR 0033 §2-3).

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **A. Solo el gateway, fijando proveedor y región por petición** | Un proveedor, una clave, poco código | La residencia depende de lo que garantice el gateway para cada modelo (sin comprobar, ADR 0033 «Pendiente»); sigue siendo un punto único de fallo; un subencargado más entre nosotros y el proveedor |
| **B. Un transporte directo por proveedor y región** (Bedrock y Vertex en la UE, un proveedor alojado en la UE, Azure con zona de datos UE) **y el gateway para `us` y `any`** | Residencia comprobable con el contrato de cada proveedor; dos vías UE se respaldan entre sí; el enrutador ya lo admite | Más SDKs (cada uno, una dependencia revisada); precios y catálogos distintos por proveedor y región; un DPA por proveedor |
| **C. Cambiar de agregador** (Cloudflare AI Gateway, OpenRouter…) | Igual de sencillo que A | El mismo problema que A con otro proveedor |

## Decisión recomendada

**Opción B, por este orden:**

1. **El modelo de datos:**
   - `residency`: `eu` (por defecto), `us` o `any`, con su migración; las organizaciones de staging pasan a `eu`;
   - cada transporte declara, además de la vía, el **proveedor real** (`anthropic`, `openai`, `mistral`, `google`…) y una región `eu`, `us` u `other`;
   - `allowed_providers` se compara con el proveedor real;
   - con `eu`, ni la llamada ni el respaldo salen de la UE (como hoy); con `us`, solo `us`; con `any`, cualquiera con DPA.
2. **La primera ruta UE: Amazon Bedrock en la UE** (`eu-central-1` o el perfil de inferencia de la UE) con los mismos modelos de Anthropic que usan hoy las evals, para no perder la línea base. Los modelos concretos disponibles en esa región están por comprobar en el *spike*.
3. **La segunda ruta UE, de respaldo: Google Vertex en una región europea**, con la misma familia de modelos si está disponible allí (a verificar). Un proveedor alojado en la UE (por ejemplo, Mistral) entra solo si pasa las evals. Azure, cuando un cliente lo pida o si gana en las evals (para Claude todavía no ofrecía zona de datos UE en octubre de 2026, según `docs/design/roadmap-enterprise.md` §4.1).
4. **Embeddings en la UE:** un modelo de embeddings servido en la UE (en Bedrock u otra ruta UE), elegido con la eval de recall del ADR 0048. Cambiar de modelo obliga a reindexar (hallazgo K-04).
5. **Qué modelo hace cada tarea:** el más barato que pasa las evals (producto, 2026-11-11), por ruta. La clave lógica (`fast`, `smart`…) se resuelve en cada transporte a su ID; la tabla de `@repo/config` dice qué modelo pasó las evals en cada ruta.
6. **Registro por llamada:** proveedor real, vía, región, modelo, tokens y coste en `agent_runs` y, cuando exista, en el libro de consumo (`PL-ledger`). De ahí sale el informe de residencia (ADR 0035).
7. **Cada proveedor** entra con su transporte en `models/transports/` (frontera de SDKs del ADR 0033 §4), su ficha (región, retención, DPA) en `@repo/config` y su línea en la lista de subencargados.
8. **El gateway se queda** para `us` y `any`, y para comparar modelos en las evals.

## Consecuencias

- **Se gana:** «Solo UE» funciona y es lo normal; dos rutas UE se respaldan entre sí; la residencia de cada llamada se puede enseñar al cliente; el coste baja eligiendo por eval.
- **Coste:** un PR de dependencias por SDK (`@ai-sdk/amazon-bedrock`, `@ai-sdk/google-vertex` o equivalentes, versión exacta), un transporte y sus tests por proveedor, y la reindexación del conocimiento al cambiar de embeddings.
- **Riesgos:** catálogos por región que van por detrás de los globales; precios distintos (la tabla de precios pasa a ser por ruta); la caché de prompt no funciona igual en todos los proveedores (a verificar por proveedor).
- **Dependencias:** una cuenta de AWS (la misma del ADR 0034) con acceso a los modelos en Bedrock, y un proyecto de Google Cloud para Vertex. Son credenciales, no decisiones: se piden a producto cuando el PR esté listo para probarse.
- **BYOK** (ADR 0034) usa los mismos transportes con las credenciales del cliente; sin cambios en la regla de no caer a las de Moodly.

## Qué la haría «aceptada»

1. Producto dice sí.
2. Un *spike* demuestra:
   - en tests del enrutador, una organización `eu` nunca llega a una ruta que no sea `eu`, tampoco en el respaldo, y `allowed_providers: ["anthropic"]` funciona;
   - en staging, una organización `eu` completa un turno por Bedrock en la UE (puerta de M1), con proveedor y región registrados;
   - las evals de Recepción y Atención al cliente pasan con la ruta UE y el modelo elegido, con el coste por conversación medido.

## Verificación

Pendiente: es lo que pide el punto 2 de «Qué la haría aceptada».
