# 0031 — Construir frente a adoptar: usamos lo probado para lo que no nos diferencia

- **Estado:** aceptado (producto, 2026-10-21)
- **Fecha:** 2026-10-21
- **Secciones del MANUAL afectadas:** §2 (nuevo principio 10), §3.2, §7, §19
- **Relación:** aplica el mismo criterio que ya siguen los ADR 0019 (modelos), 0022 (WorkOS), 0025 (pgvector), 0027 (DBOS) y 0028 (portabilidad)

## Contexto

Al revisar el backend surgió la pregunta de por qué no construir nosotros el motor de ejecución duradera, el SSO, las trazas, la búsqueda vectorial o todas las integraciones. Producto la amplió: tampoco entrenamos modelos, y podríamos usar agentes y piezas ya creadas por otras empresas tras años de investigación.

Hacía falta un criterio escrito para que cada decisión futura se tome igual, y para distinguir **usar una pieza ajena** de **delegar la responsabilidad** ante el cliente.

## Decisión

### 1. Regla general

**Construimos lo que nos diferencia y lo que sostiene la confianza del cliente. Para todo lo demás, adoptamos piezas probadas.** Adoptar no significa renunciar a la capacidad: la plataforma la tiene, pero sobre un componente con años de uso real en lugar de código nuevo nuestro.

### 2. Lo que construimos siempre nosotros

Es el núcleo del producto y no se delega:

- aislamiento entre empresas, permisos por sede y RLS (ADR 0003, 0022);
- runtime de agentes, motor de políticas, techos de autonomía y aprobaciones (MANUAL §5);
- memoria y Company Brain gobernados: procedencia, confianza, borrado (ADR 0024);
- conocimiento de cada sector: flujos, reglas, plantillas y evals;
- conectores de las integraciones que mueven el negocio del piloto (WhatsApp, calendario, CRM y facturación española);
- la experiencia completa para el negocio, de la configuración a los resultados.

### 3. Lo que adoptamos

| Necesidad | Pieza adoptada | Dónde se decidió |
|---|---|---|
| Modelos de IA | Anthropic, OpenAI, Google, Mistral (vía Bedrock, Vertex, Azure o API directa) | ADR 0019 |
| Orquestación de llamadas al modelo | Vercel AI SDK, bajo nuestra capa propia | MANUAL §3.2 |
| Ejecución duradera y colas | DBOS Transact (pendiente de *spike*) | ADR 0027 |
| SSO, SCIM y portal de IT | WorkOS | ADR 0022 |
| Búsqueda vectorial | pgvector en nuestro Postgres | ADR 0025 |
| Trazas y coste de LLM | OpenTelemetry + Langfuse | MANUAL §12 |
| Base de datos, Auth, Storage | Supabase | ADR 0003, 0028 |
| Pagos, email, errores | Stripe, Resend o Postmark, Sentry | MANUAL §3.2 |
| Cola larga de integraciones | Servidores MCP o una plataforma de integraciones | MANUAL §7.1, decisión abierta |
| Agentes de desarrollo y operación interna | Claude Code y Codex; agentes de revisión de seguridad, pruebas o análisis de costes | MANUAL §16 |

### 4. Agentes y servicios de terceros dentro del producto

Un agente ya montado por otra empresa **no atiende directamente a los clientes de nuestros clientes**. Funciona con sus propias reglas, guarda los datos donde quiere y no pasa por nuestro motor de políticas, y la responsabilidad ante el cliente seguiría siendo nuestra.

Se pueden aprovechar **como herramienta controlada**:

- reciben solo los datos mínimos necesarios;
- su respuesta se trata como contenido no confiable (MANUAL §5.3);
- cualquier acción que propongan pasa por el motor de políticas y las aprobaciones;
- quedan en la auditoría como cualquier otra herramienta.

Los agentes de terceros como producto se reservan para el Marketplace (Fase 5), con revisión previa (ADR 0030).

### 5. Criterios para adoptar una pieza

Toda pieza nueva se evalúa con estas preguntas, y la respuesta queda en el PR o ADR que la introduce:

| Pregunta | Consecuencia |
|---|---|
| ¿Nos diferencia? | Si no, se adopta. Si sí, se construye. |
| ¿Ve datos de clientes? | Exige DPA, residencia de datos compatible (ADR 0023) y certificaciones (SOC 2 o ISO 27001). Entra en la lista de subencargados. |
| ¿Tenemos salida si sube de precio, empeora o cierra? | Siempre detrás de una interfaz nuestra, con una alternativa identificada. |
| ¿Respeta nuestras reglas de permisos, aprobaciones y auditoría? | Si no, solo como herramienta controlada (punto 4), nunca como parte que decide. |
| ¿Funcionaría en una celda dedicada o en la nube del cliente? | Se prefiere *open source* o autoalojable (ADR 0028). |
| ¿Está probada? | Versión estable con al menos dos semanas de antigüedad, mantenimiento activo y uso real verificable. Las dependencias nuevas pasan la revisión de zonas sensibles. |

### 6. Cuándo se reconsidera

Una pieza adoptada se sustituye o se construye cuando:

- falla en nuestras pruebas (por ejemplo, el *spike* de DBOS);
- impide algo que el producto necesita (residencia, BYOC, coste a escala);
- se convierte en el centro de la diferenciación.

El cambio siempre va en un ADR nuevo.

## Alternativas consideradas

- **Construir todo nosotros** — máximo control, pero más fallos, más superficie de seguridad, meses en piezas que no nos diferencian y mantenimiento para siempre.
- **Montar el producto sobre una plataforma de agentes de terceros** — más rápido al principio, pero el aislamiento, las políticas, los datos y la diferenciación quedarían fuera de nuestro control.

## Consecuencias

- Se añade el principio 10 al MANUAL §2.
- Cada PR que añada una dependencia o un proveedor responde a las preguntas del punto 5.
- La lista de subencargados (ADR 0019) se alimenta de las piezas que ven datos de clientes.

## Verificación

- Revisión en cada PR que añade una dependencia o un proveedor: las preguntas del punto 5 contestadas en la descripción.
