# 0051 — Todos los proveedores de modelos detrás del enrutador, con inferencia global bajo acuerdos de tratamiento de datos (T6)

- **Estado:** aceptado (producto, 2026-11-12): inferencia global de los modelos bajo un acuerdo de tratamiento de datos (DPA) con cada proveedor, en lugar de fijarla a la UE. La residencia por organización y la ruta UE siguen siendo una opción posterior (ver «Decisión»).
- **Fecha:** 2026-11-11
- **Secciones del MANUAL afectadas:** §3.2, §5.11, §11, §15 (registro por llamada), §18.0 #4 y #6, §18.1 #5
- **Relación:**
  - auditoría de preproducción §17.3 T6, §18.1 #4 y #6, §18.2 («Model providers»), §18.5 V1 #2 y #3, hallazgos H-01 y B-01;
  - fija lo que los ADR 0033 y 0035 dejaron «cambiado en parte» el 2026-11-10: proveedores y residencia (la propuesta de residencia `eu` por defecto queda sustituida por la decisión del 2026-11-12, abajo);
  - decisión de producto del 2026-11-11: los agentes usan el modelo más barato que pasa las evals;
  - unidades `PL-T6` (M1), `SE02` (M1) y `PL-ledger` (M1) de `docs/scope.yaml`; la puerta de M1 «an `eu` organization completes a turn» queda sustituida el 2026-11-12: la ruta UE es una opción posterior, así que la puerta pasa a ser que una organización completa un turno por una vía con su DPA y que el proveedor y la región de la llamada quedan registrados.

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

## Decisión

**Decisión de producto, 2026-11-12: se acepta la inferencia global de los modelos bajo un acuerdo de tratamiento de datos (DPA) con cada proveedor, en lugar de fijar la inferencia a la UE.**

1. **Todos los proveedores de modelos van detrás del enrutador** (ADR 0033), cada uno con su transporte, su ficha (región, retención, DPA) en `@repo/config` y su línea en la lista de subencargados. Cada transporte declara el **proveedor real** (`anthropic`, `openai`, `mistral`, `google`…) además de la vía, y `allowed_providers` se compara con el proveedor real, no con el nombre de la vía.
2. **La inferencia no se fija a la UE.** Vercel AI Gateway sigue siendo una vía válida para `any`, y la residencia por defecto de las organizaciones deja de ser `eu`: sigue siendo `any`, que es lo que ya hay en la base de datos.
3. **Sin afirmación pública de «inferencia en la UE».** La web, el MANUAL y los materiales comerciales no dicen que los modelos se ejecutan en la UE. Lo que sí se puede decir: los datos de la plataforma están en la UE (ADR 0003) y la inferencia va a los proveedores con los que hay un DPA.
4. **DPA firmado con cada proveedor de modelos antes del primer dato real de un cliente** (tarea de producto F10; condición de salida a producción 3 en `docs/STATUS.md`). Sin DPA firmado, un proveedor no se activa para organizaciones con datos reales.
5. **La residencia por organización y la ruta UE siguen siendo posibles más adelante, como una opción** (ADR 0035): `residency = eu | us | any` con el filtro del enrutador, y las rutas UE de la opción B (Bedrock en la UE, Vertex en una región europea) cuando un cliente lo exija. No se construyen ahora; se construyen cuando un cliente concreto las pida.
6. **Registro por llamada:** proveedor real, vía, región, modelo, tokens y coste en `agent_runs` y, cuando exista, en el libro de consumo (`PL-ledger`), para poder enseñar a cada cliente por dónde fue cada llamada.
7. **Qué modelo hace cada tarea:** el más barato que pasa las evals (producto, 2026-11-11), con la clave lógica resuelta en cada transporte.

### Alternativa descartada: fijar la inferencia a la UE (la recomendación original de este ADR)

La opción B de la tabla, por este orden: `residency = eu` por defecto, con Amazon Bedrock en la UE como primera ruta, Google Vertex en una región europea como respaldo, y un modelo de embeddings servido en la UE (con la eval de recall del ADR 0048). Daba residencia comprobable con el contrato de cada proveedor y hacía que «Solo UE» funcionara y fuera lo normal. Producto la descarta por ahora a favor de la inferencia global con DPA: menos SDKs, menos catálogos y precios por región, y todos los modelos disponibles desde el primer día. Sigue disponible como opción posterior (punto 5).

## Consecuencias

- **Se gana:** todos los modelos y proveedores disponibles desde el primer día, un solo camino de transporte que mantener y el coste por conversación elegido por eval.
- **Se pierde:** la garantía de que los datos de una conversación no salen de la UE durante la inferencia. Hay que decirlo con claridad: la web (hoy, «región de los modelos por confirmar», #241) y cualquier contrato no afirman inferencia en la UE.
- **Condición de salida a producción:** DPAs firmados con cada proveedor de modelos que trate datos de clientes (F10), y confirmar que el AI Gateway fija proveedor y modelo (o que su DPA cubre su propio tratamiento). Hasta entonces, solo datos de demo y de prueba.
- **Lo que sigue pendiente de código** (unidad `PL-T6`, M1): `allowed_providers` contra el proveedor real; el registro de proveedor y región por llamada; el tipo de región de cada transporte. La residencia `eu` del enrutador sigue funcionando para quien la elija, pero hoy ningún transporte es `eu`, así que elegirla apaga la IA de esa organización (H-01): hasta que exista una ruta UE, la interfaz no debe ofrecerla como «lista para usar».
- **Riesgos:** un cliente enterprise o regulado puede exigir la UE; es la razón de que la opción B se mantenga como camino abierto. Los subencargados nuevos (un proveedor por modelo) amplían la lista que hay que publicar.
- **BYOK** (ADR 0034) usa los mismos transportes con las credenciales del cliente; sin cambios en la regla de no caer a las de Moodly.

## Qué quedaba por verificar

Ya no hay un *spike* de residencia UE como condición de aceptación. Lo que cierra esta decisión con evidencia:

1. Los DPAs firmados (F10), anotados en la lista de subencargados.
2. En tests del enrutador, `allowed_providers: ["anthropic"]` funciona con el proveedor real.
3. En staging, el registro de proveedor y región de cada llamada en `agent_runs`.

## Verificación

Pendiente: los tres puntos de «Qué quedaba por verificar». La decisión es de producto (2026-11-12); el código de `PL-T6` sigue en M1.
