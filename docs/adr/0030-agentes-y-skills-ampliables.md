# 0030 — Agentes y skills ampliables: 4 agentes de serie, agentes propios y skills que se añaden a cada agente

- **Estado:** propuesto
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §1.4, §4.2 (`agent_types`, `agents`, `skills`, `agent_skills`), §5.4, §5.5, §5.6, §9.4, §17
- **Relación:** ADR 0023 (catálogo de serie), ADR 0029 (asistente), `docs/audits/2026-10-20-revision-seguridad-plataforma.md` §7 (MCP de terceros)

## Contexto

Producto confirma (2026-10-20) los **4 agentes de serie**: Recepción, Atención al cliente, Comercial y Administración. Pide además que la estructura permita:

- **crear más agentes**, además de los de serie;
- **crear más skills** y **añadirlas a cada agente de forma individual**.

El MANUAL ya define los tipos de agente como datos (§1.4) y un catálogo global de skills con `agent_skills` (§4.2). Pero el catálogo solo lo amplía la plataforma, una skill declara para qué agentes vale (`agentTypes`), y crear skills o agentes propios quedaba para la Fase 4 («Agent Builder»), sin modelo de datos.

## Decisión

### 1. Tres orígenes de agente, un solo runtime

| Origen | Quién lo crea | Ejemplo |
|---|---|---|
| **De serie** | La plataforma (`agent_types.organization_id IS NULL`) | Los 4 de `@repo/config` `AGENT_TYPES` |
| **De plantilla** | La plataforma, por vertical, para activar si se quiere | «Agente de reseñas», «Agente de RR. HH.» |
| **Propio** | La organización (`agent_types.organization_id = X`) | «Agente de eventos» de un restaurante |

- Todos usan **el mismo runtime, el mismo motor de políticas, la misma memoria y el mismo coach**. Un agente propio no es un sistema aparte: es una fila de configuración.
- Un agente propio se define con: nombre, color, instrucciones, **skills**, canales (opcional), autonomía por skill, objetivos y a qué eventos reacciona (`event_subscriptions`).
- Se puede crear desde cero o **duplicando** uno de serie.
- El número de agentes depende del plan (`usage_limits`, métrica `agents`).

**Regla de código:** `AGENT_TYPES` es la **semilla** del catálogo, no la lista completa. Ningún código de negocio puede suponer que hay 4 agentes ni hacer `switch` sobre su clave. La interfaz pinta cualquier agente a partir de sus datos (nombre, color y descripción). Lo vigila un test.

### 2. Tres tipos de skill, todas con el mismo contrato

| Tipo (`skills.kind`) | Quién la crea | Cómo funciona | Revisión |
|---|---|---|---|
| **`code`** | La plataforma, en `packages/skills/<key>/` | El contrato del §5.5 (Zod, `preview`, `execute` idempotente) | Code review + evals |
| **`composed`** | La organización, sin programar | Combina piezas existentes: instrucciones, consultas de conocimiento y **llamadas a skills `code` o herramientas MCP ya conectadas**, con entrada y salida tipadas | Prueba en *sandbox* antes de publicar |
| **`mcp`** | Aparece al conectar una integración con servidor MCP | Cada herramienta del servidor se ofrece como skill | La activa un admin y le asigna clase de efecto |

- **Toda skill tiene una clase de efecto** (§5.6), y el motor de políticas la trata igual sea del tipo que sea.
  - Una skill `composed` hereda **la clase más alta** de las piezas que usa.
  - Una herramienta `mcp` sin clasificar entra como **`external_message` con autonomía `draft`**: nada se ejecuta sin aprobación hasta que un admin la clasifica.
  - Nadie puede subir una skill por encima del techo de su clase.
- Las skills `composed` y `mcp` **no ejecutan código del cliente** en nuestros servidores. Solo combinan piezas que ya existen y pasan por el motor de políticas.
- Las herramientas `mcp` de terceros se ejecutan con las protecciones de la revisión de seguridad §7: lista blanca de servidores, credenciales solo del tenant, sin acceso a red interna, y sus respuestas tratadas como datos no confiables.

### 3. Cualquier skill se puede añadir a cualquier agente

- `agent_skills (agent_id, skill_id, enabled, autonomy_level)` es la única forma de dar una skill a un agente, y se configura **agente por agente**, con los overrides por sede de siempre (§4.3).
- El campo `agentTypes` de una skill `code` pasa a ser una **sugerencia** («recomendada para Recepción»), no una restricción. Solo restringe si la skill es peligrosa fuera de su contexto, y eso se marca explícitamente (`restricted_to_agent_types`).
- Una misma skill en dos agentes es **una sola definición**: si se mejora, mejora en los dos.

### 4. Versiones y publicación

- Las skills `composed` y los agentes propios tienen versiones (`draft` → `testing` → `published`), como `agents.status`.
- Antes de publicar: prueba en *sandbox* con conversaciones de ejemplo, mostrando el flujo de pasos (como el paso 5 del onboarding, §9.6).
- Cada run guarda qué versión de cada skill usó (`executions.skill_version`, ya en el modelo).

### 5. Modelo de datos

| Tabla | Cambio |
|---|---|
| `agent_types` | `organization_id` (null = plataforma), `origin` (`builtin`/`template`/`custom`), `color`, `description`. La clave es única por `(organization_id, key)`. |
| `agents` | `agent_type_id` (FK al id, ya no a la clave), `version`. |
| `skills` | `organization_id` (null = plataforma), `kind` (`code`/`composed`/`mcp`), `definition` (jsonb, para `composed`), `integration_id` (para `mcp`), `restricted_to_agent_types[]`, `status`. La clave es única por `(organization_id, key, version)`. |
| `agent_skills` | `skill_id` (FK al id) en vez de `skill_key`. |

RLS: una organización ve las filas de plataforma y las suyas, y solo modifica las suyas. Lo cubren tests pgTAP.

### 6. Fases

- **Desde la primera migración de agentes (Fase 0, tarea 5):** el modelo de datos ya es el de este ADR, aunque solo se usen los 4 de serie y skills `code`. Así no hay que migrar después.
- **Fase 1–2:** skills `code` de la plataforma; activar y desactivar skills por agente desde la interfaz.
- **Fase 3:** **agentes propios** (instrucciones + skills del catálogo) y skills `mcp` de integraciones conectadas. Son solo configuración, el riesgo es bajo y lo piden las pymes.
- **Fase 4 (Agent Builder):** skills `composed` creadas por el cliente y flujos.
- **Fase 5 (Marketplace):** agentes y skills de terceros, sobre este mismo modelo.

## Alternativas consideradas

- **Solo los 4 de serie, configurables** — más simple, pero no admite crecer, que es lo que pide producto.
- **Que el cliente escriba código para sus skills** — máxima flexibilidad, pero obliga a ejecutar código ajeno con aislamiento fuerte (y es un riesgo de seguridad). Se descarta hasta el Marketplace, y entonces con revisión.
- **Un agente propio como sistema aparte** — duplicaría runtime, políticas y memoria. Descartado: un agente es configuración.

## Consecuencias

- La tarea 5 de la Fase 0 (catálogo `agent_types`, `agents`…) nace con este modelo.
- Nueva pantalla: biblioteca de skills (`/app/skills`) y «Crear agente» en `/app/agentes`.
- La interfaz y el código no pueden suponer 4 agentes fijos.

## Verificación

- pgTAP: la organización A no ve ni usa los agentes ni las skills propios de B; nadie modifica filas de plataforma.
- Test: crear un agente propio con dos skills de serie y ejecutar un run con él, pasando por el motor de políticas.
- Test estructural: no hay `switch`/`if` sobre claves de agente en `packages/*` ni en `apps/*`.
