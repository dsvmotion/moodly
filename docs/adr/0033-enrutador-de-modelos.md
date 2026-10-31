# 0033 — Enrutador de modelos: interfaz, política por organización y Vercel AI Gateway como primera vía

- **Estado:** aceptado (producto, 2026-10-30)
- **Fecha:** 2026-10-30
- **Secciones del MANUAL afectadas:** §3.2, §5.11, §13, §18 #5
- **Relación:**
  - concreta el ADR 0019 (aceptado: enrutador propio sobre Vercel AI SDK, multi-proveedor y multi-región, tres modos de conexión, residencia por organización);
  - fija la decisión de producto del 2026-10-24 (Vercel AI Gateway detrás del enrutador);
  - paso 3 del orden de trabajo (fundaciones, solo interfaces y modelo de datos).
- **Siguientes:** 0034 (BYOK y `SecretVault`), 0035 (residencia), 0036 (conectores MCP) y 0037 (conocimiento).

## Contexto

Ningún agente puede llamar a un proveedor de modelos directamente (MANUAL §5.11 y AGENTS.md: ningún ID de modelo en el código de negocio). El ADR 0019 decidió una capa propia delgada, pero no su contrato. Producto decidió además:
- **Gateway:** Vercel AI Gateway como primera vía.
- **Proveedores:** cualquiera con DPA y transferencias cubiertas. «Solo UE» es una opción por organización que el enrutador respeta siempre.
- **BYOK nunca cae a credenciales de Moodly.**
- Antes de datos reales hay que confirmar que el gateway fija proveedor y modelo con procesamiento en la UE o con un DPA válido; si no, el enrutador va directo al proveedor.

Este paso deja el contrato y sus reglas probadas. **No activa ningún proveedor:** no hay claves ni llamadas reales.

## Decisión

1. **`ModelRouter` en `packages/agent-core/src/models`.**
   - El runtime pide por **tarea** (`classify`, `extract`, `converse`, `reason` o `embed`), nunca por modelo.
   - La organización y el run los pone el runtime.
   - El resultado dice qué respondió y cómo: proveedor, modelo, región resuelta, vía, modo de conexión, tokens, coste y latencia. Es lo que se registrará por llamada (ADR 0019).
2. **Las vías son transportes intercambiables (`ModelTransport`).**
   - Cada transporte declara su proveedor, su región de procesamiento, su vía (`gateway` o `direct`) y su modo de conexión (`managed`, `byok` o `customer_cloud`).
   - **La primera vía de producción será Vercel AI Gateway** (Vercel AI SDK), con el proveedor y el modelo fijados por petición. Llega cuando se active el primer agente, no en este paso.
   - Para los tests hay un transporte falso (MANUAL §13: los tests unitarios nunca llaman a un proveedor real).
3. **La política de cada organización (`ModelPolicy`) decide antes de llamar.** El enrutador:
   - **Elige el modelo por tarea con claves lógicas** de `@repo/config` (`fast`, `smart` o `embedding`). El ID real de cada proveedor vive en la configuración del transporte, no en el código de negocio.
   - **Aplica la residencia:**
     - con «Solo UE», solo usa transportes que procesan en la UE, también en el respaldo;
     - si ninguno cumple, falla en vez de salir de la región;
     - el valor por defecto es `any`, con DPA (decisión de producto).
   - **Solo usa proveedores permitidos** para la organización.
   - **Nunca cambia de modo de conexión en el respaldo:** una organización en BYOK solo usa transportes BYOK, y nunca credenciales de Moodly.
   - **Corta antes de llamar si el gasto supera su tope:** coste estimado más gasto del run o del día, frente al tope por run y por día. Un corte no es un error del proveedor: el runtime pasa a `suggest` o escala a una persona (MANUAL §15), nunca deja al cliente sin respuesta.
   - **Usa el respaldo solo si falla el principal,** con las mismas reglas.
4. **Frontera estructural:** un test falla si cualquier código fuera de `packages/agent-core/src/models/transports/` importa un SDK de proveedor:
   - `@ai-sdk/*` (salvo el núcleo `ai`, cuando llegue, también solo ahí);
   - `@anthropic-ai/sdk`, `openai`, `@google/genai`, `@google-cloud/vertexai`, `@aws-sdk/client-bedrock-runtime`, `@mistralai/mistralai`, `cohere-ai` o `groq-sdk`.
5. **Herramientas (paso 4d, 2026-10-31).** La llamada lleva las herramientas que puede pedir el modelo (`tools`: nombre, descripción y JSON Schema de la entrada de cada skill activa) y la respuesta, las que pide (`toolCalls`). Los mensajes admiten el resultado de una herramienta (`role: "tool"`). El enrutador solo los pasa al transporte: lo que pide el modelo no se ejecuta sin pasar por `decide()` (ADR 0047), en el bucle del turno (`runtime/turn.ts`, MANUAL §5.1).
6. **Política por organización en la base de datos:** `org_model_settings` llega con el ADR 0034 (BYOK) y el 0035 (residencia). Hasta entonces, el enrutador usa la política de plataforma por defecto.

## Alternativas consideradas

- **Llamar al AI SDK directamente desde el runtime.** Más corto, pero reparte por el código las reglas de residencia, BYOK y gasto, y obliga a cambiar el runtime para añadir una vía (Bedrock, Azure o la nube del cliente).
- **Que el gateway decida residencia y respaldo.** El gateway es una vía, no la política: con BYOK, Vercel puede reintentar con sus credenciales, y «modelos en tu nube» no pasa por el gateway. La regla tiene que vivir en nuestro código y probarse sin el gateway.
- **Elegir el modelo por nombre en cada agente.** Ata el código a un proveedor y a una versión. Las claves lógicas por tarea permiten cambiar de modelo por eval sin tocar el código de negocio.

## Consecuencias

- Añadir un proveedor o una vía es un transporte nuevo y su configuración, sin cambiar ni el runtime ni la política.
- La lista de qué cumple cada proveedor (DPA, región, retención) se documenta al activar cada transporte, con su ficha en este ADR.
- **Pendiente antes de datos reales:**
  - el *spike* del gateway: fijar proveedor, modelo y región por petición, y que BYOK no reintente con credenciales de Vercel. Si no se cumple, esa organización va directa al proveedor;
  - el registro por llamada en `usage_records` (MANUAL §15).

## Verificación

- **Tests unitarios del enrutador, uno por regla:**
  - tarea y modelo lógico;
  - residencia (también en el respaldo, y fallo antes que salir de la región);
  - proveedores permitidos;
  - BYOK sin caer a credenciales de Moodly;
  - topes de gasto por run y por día antes de llamar;
  - respaldo solo tras un fallo;
  - lo que devuelve cada llamada;
  - las herramientas llegan al transporte y las que pide el modelo vuelven sin tocar.

  Con mutaciones.
- **Test estructural de la frontera de SDKs,** con prueba en negativo (un archivo que importa un SDK de proveedor fuera de `transports/` lo pone en rojo).
