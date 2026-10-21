# 0023 — Fuente de verdad única y vocabulario canónico (agentes, rutas, residencia, modelo de datos)

- **Estado:** propuesto
- **Fecha:** 2026-10-20
- **Secciones del MANUAL afectadas:** §0, §1.4, §3.1, §3.4, §4.2, §5.2, §5.8, §9.2, §9.4, §11, §17, §19, §20

## Contexto

Las decisiones se han ido tomando en sitios distintos (MANUAL, ADRs, `docs/design/`, auditorías y el prototipo `apps/site/plataforma`) y ya se contradicen:

- **Agentes.** `CLAUDE.md`/`AGENTS.md` y el MANUAL hablan de `customer`/`sales`/`operations`/`admin`. `@repo/config` `AGENT_TYPES` (en `main` desde #17), la web pública en 4 idiomas y el prototipo usan `reception`/`customer`/`sales`/`admin`. El agente de operaciones desaparece y `customer` cambia de significado.
- **Rutas.** MANUAL §9.4 en inglés (`/app/inbox`), `docs/design/mapa-pantallas-datos.md` §0 en español (`/app/conversaciones`) y `apps/web` hoy en inglés.
- **Residencia.** MANUAL §3.1, §3.4 y §11 dicen «datos solo en la UE». El ADR 0019 dice «todas las regiones; la residencia es una política por organización».
- **Modelo de datos.** MANUAL §4.2 no recoge entidades que ya usan el diseño y los ADRs: `accounts`, `networks`, roles y permisos (0022), `model_providers`, `provider_connections`, `org_model_settings` (0019), `appointments`, `deals`, `invoices_mirror`, `workflows`, `calls`, `voice_*`, `agent_versions`, `proposals`, `learning_signals`.
- **Registro de ADRs.** Faltan 0001–0017; el 0021 se cita pero vive en el PR #16.

Un agente de código que lea el MANUAL como fuente de verdad construiría lo que no toca.

## Decisión

### 1. Jerarquía de fuentes

1. **ADRs aceptados** — la decisión.
2. **`docs/MANUAL.md`** — el estado consolidado. Todo ADR que cambie algo del MANUAL lo actualiza **en el mismo PR**.
3. **`docs/design/`** — propuestas y detalle. No cuentan como decisión hasta que pasan a un ADR o al MANUAL.
4. **Prototipo (`apps/site/plataforma`)** — especificación **visual**. Nunca define claves, contratos ni datos.
5. **`docs/audits/`** — fotos fechadas. Históricas: no se actualizan, se superan.

Si dos fuentes discrepan, manda la de mayor rango y la otra se corrige en el siguiente PR que la toque.

### 2. Los 4 agentes: `reception` · `customer` · `sales` · `admin`

Se adopta el catálogo ya en `main` (`@repo/config` `AGENT_TYPES`) y en la web pública. Las responsabilidades del antiguo `operations` se reparten:

| Clave | Nombre (es) | Responsabilidad |
|---|---|---|
| `reception` | Recepción | **Agenda y citas** (crear, mover, cancelar, lista de espera, recordatorios), recursos y salas, y **canal de voz** (la línea de teléfono del negocio). |
| `customer` | Atención al cliente | Atención entrante por **canales escritos** (WhatsApp, Instagram, email, web): dudas, incidencias, reseñas y escalado a humano. Puede tener skills de agenda (una skill declara varios `agentTypes`). |
| `sales` | Comercial | Leads, CRM, presupuestos, seguimiento, recuperación de clientes y ejecución de campañas que proponga el coach. |
| `admin` | Administración | Facturación (siempre a través del software del cliente), cobros, gastos, **inventario y proveedores**, y preparación de información para la gestoría. |

- **Tareas internas, avisos y resumen diario** dejan de ser de un agente: son **capa común** (tabla `tasks` y resumen diario del coach, §5.12).
- **Enrutado de entrada (§5.2):** cada `channel_account` tiene `default_agent_type` (`customer` para canales escritos, `reception` para voz). Sigue siendo un solo agente por conversación.
- Los tipos de agente siguen siendo **datos** (`agent_types`); este catálogo es reversible sin tocar el runtime.

### 3. Rutas del producto en español, como identificadores estables

Se mantiene lo decidido en `mapa-pantallas-datos.md` §0: `/app/conversaciones`, `/app/aprobaciones`, `/app/clientes`, `/app/ajustes/*`… Los segmentos de ruta son **identificadores estables**: no se traducen por idioma de interfaz (la interfaz sí, con next-intl). MANUAL §9.4 pasa a esa tabla. Renombrar las rutas actuales de `apps/web` es una tarea de código aparte, con sus e2e.

**Vocabulario:** en código y BD, `location`; en la interfaz en español, **«sede»** (el MANUAL usaba «local»; son sinónimos).

### 4. Residencia en dos capas

- **Datos en reposo** (base de datos, storage, copias, logs y trazas de LLM): **siempre en la región de la celda** que aloja a la organización. La celda compartida está en la **UE**.
- **Procesamiento por modelos:** política por organización o sede (ADR 0019). Por defecto «sin restricción»; «solo UE» u otras como opción del plan. Ni el modelo principal ni el de respaldo cruzan la frontera fijada.

Mensaje único: **«Tus datos se guardan en la UE. Tú decides dónde se procesan».**

### 5. Modelo de datos completo en el MANUAL

MANUAL §4.2 incorpora las entidades de los ADRs 0019, 0022 y de esta serie, indicando la fase en la que entran. Las entidades que **reflejan sistemas del cliente** (`appointments`, `deals`, `invoices_mirror`) siguen la regla de §9.5: el sistema de registro es la herramienta del cliente cuando está conectada, y Moodly guarda una copia sincronizada con `external_ref` y `synced_at`. Si no hay herramienta conectada, Moodly es la fuente.

### 6. Registro de ADRs

MANUAL §19 pasa a listar todos los ADRs con su estado. Los 0001–0017 siguen pendientes de redactar (tarea 7 de la Fase 0) y se marcan así.

## Alternativas consideradas

- **Volver a `customer`/`sales`/`operations`/`admin`** — obliga a rehacer la web pública en 4 idiomas, los tokens de color y `@repo/config`; y la agenda y la voz quedarían repartidas entre «clientes» y «operaciones». Descartada.
- **Rutas en inglés** — más neutras para una interfaz en 4 idiomas, pero contradicen una decisión ya tomada y el prototipo. No hay beneficio técnico que lo justifique: los segmentos son identificadores, no texto.
- **«Solo UE» para todo** — descartado por producto en el ADR 0019.

## Consecuencias

- Se actualizan en este mismo PR: MANUAL, `CLAUDE.md` y `AGENTS.md` (descripción de los agentes) y `docs/design/mapa-pantallas-datos.md`.
- Tareas de código que salen de aquí (no incluidas en este PR): renombrar las rutas de `apps/web` y añadir `default_agent_type` en `channel_accounts` cuando se cree la tabla.
- Se revisan los textos de la web pública y de `models-catalog.js` que digan «solo UE» como esencia del producto.

## Verificación

- `grep` sin coincidencias de `operations` como tipo de agente en `docs/MANUAL.md`, `CLAUDE.md` y `AGENTS.md`.
- `diff CLAUDE.md AGENTS.md` vacío.
- Las claves del MANUAL §1.4 coinciden con `packages/config/src/index.ts`.
