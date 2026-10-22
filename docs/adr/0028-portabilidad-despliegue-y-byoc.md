# 0028 — Portabilidad: Vercel y Supabase como implementación por defecto, no como dependencia; qué significa «BYOC»

- **Estado:** propuesto
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §3.2 (hosting web, worker, base de datos), §3.4, §10.4
- **Relación:** ADR 0019 (modos de conexión de modelos), ADR 0026 (celdas), ADR 0027 (ejecución duradera)

## Contexto

El diseño promete despliegues en celda dedicada, en la nube del cliente (BYOC) y on-premise, con la regla «todo en contenedores; nada que dependa en exclusiva de un servicio gestionado» (`arquitectura-agentes-enterprise.md` §6). Pero la web va en Vercel, y Auth, Storage, Realtime y la base de datos en Supabase. Además, «BYOC» se usa para dos cosas distintas:

1. **BYOC de modelos** (ADR 0019): la plataforma es nuestra, pero los modelos se sirven desde el Bedrock, Vertex o Azure del cliente.
2. **Despliegue en la nube del cliente**: toda la plataforma corre en su cuenta.

La primera es barata y es lo que piden casi todos los clientes enterprise. La segunda es cara de operar y la piden pocos.

## Decisión

### 1. Dos nombres distintos

- **«Modelos en tu nube»** — lo del ADR 0019. Se ofrece en el plan enterprise desde que exista el enrutador.
- **«Plataforma en tu nube»** — despliegue completo en la cuenta del cliente. **No se vende** hasta tener funcionando la celda dedicada (ADR 0026) y una demanda firmada. Las reglas de abajo existen para que, llegado el momento, no haya que rehacer nada.

### 2. El contrato de portabilidad del núcleo

| Pieza | En la celda compartida | En celda dedicada / plataforma en tu nube | Regla desde hoy |
|---|---|---|---|
| Web (`apps/web`) | Vercel (UE) | Contenedor de Next.js (`output: "standalone"`) | Nada en el núcleo depende de APIs exclusivas de Vercel (Edge Config, KV, Blob, Cron de Vercel, middleware de Edge con APIs propietarias). El CI construye también la imagen de contenedor. |
| Worker (`apps/worker`) | Contenedor en Fly.io o Railway (UE) | El mismo contenedor | Ya es portable. |
| Base de datos | Supabase alojado (UE) | Postgres gestionado de la nube del cliente o Supabase autoalojado | Solo SQL estándar y extensiones disponibles fuera de Supabase (pgvector ≥ 0.8). La lógica de negocio vive en `packages/*` y en migraciones SQL, **nunca en Edge Functions** de Supabase. |
| Auth | Supabase Auth | Supabase Auth (GoTrue) autoalojado; o SSO del cliente a través de WorkOS (ADR 0022) | RLS depende de `auth.uid()`, `auth.jwt()` y `auth.sessions`, que existen igual en GoTrue autoalojado. Nada de funciones exclusivas del panel de Supabase. |
| Storage | Supabase Storage | Supabase Storage autoalojado sobre el S3 del cliente | Acceso a ficheros solo a través de `packages/knowledge` y de una interfaz de almacenamiento. |
| Realtime | Supabase Realtime | Supabase Realtime autoalojado | Solo para avisar a la interfaz; ningún flujo de negocio depende de recibir un evento. |
| Ejecución duradera | DBOS en el worker (ADR 0027) | Igual | Librería sobre Postgres, sin servicio externo. |
| Trazas LLM | Langfuse (UE) | Langfuse autoalojado | — |
| Copias de seguridad | PITR de Supabase (plan Pro) | Las de la nube del cliente (instantáneas + WAL) | Procedimiento de restauración probado por entorno. |

### 3. Cómo se demuestra

- **Imagen de contenedor de la web** construida en el CI desde que exista el primer despliegue.
- **Prueba de humo autoalojada** (antes de vender una celda dedicada): levantar la plataforma completa con `docker compose` (Supabase autoalojado + web + worker) y pasar los e2e.
- Una regla de lint o un test que prohíba importar SDKs exclusivos de Vercel en `packages/*`.

### 4. Lo que sí aceptamos de los servicios gestionados

En la celda compartida se usan Vercel y Supabase con todas sus ventajas operativas (previews por PR, PITR, pooler, panel). La regla no es «no usarlos», es «que el núcleo no dependa de lo que no se puede autoalojar».

## Alternativas consideradas

- **Salir ya de Vercel y Supabase (todo autoalojado en Kubernetes)** — da portabilidad total, pero multiplica el trabajo de operación antes de tener un solo cliente. Descartada.
- **Aceptar el acoplamiento y quitar BYOC de la oferta** — más simple, pero cierra la puerta a cuentas reguladas. Las reglas de arriba cuestan poco.
- **BYOC gestionado de Supabase** (Supabase opera en la cuenta del cliente) — está en acceso anticipado y solo en AWS. Se evalúa cuando llegue el primer cliente que lo pida.

## Consecuencias

- La web, la página de precios y las ventas deben distinguir «Modelos en tu nube» (disponible en enterprise) de «Plataforma en tu nube» (bajo pedido, más adelante).
- Al revisar código: nada de Edge Functions de Supabase ni de APIs exclusivas de Vercel en el núcleo.
- Queda un coste: mantener la prueba de humo autoalojada antes de cada celda dedicada.

## Verificación

- El CI construye la imagen de contenedor de `apps/web` (cuando se cree el primer despliegue).
- La prueba de humo con `docker compose` pasa los e2e (antes de la primera celda dedicada).
