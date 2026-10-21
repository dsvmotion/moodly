# Arquitectura de agentes: nivel enterprise a precio de pyme

Fecha: 2026-10-07 · Estado: **PROPUESTO** (pendiente de ADR).

> **Actualización 2026-10-20.** Varias propuestas de este documento ya tienen ADR, que manda sobre este texto (ADR 0023): enrutador de modelos → ADR 0019; orquestador duradero → ADR 0027 (DBOS sobre Postgres, sustituye a pg-boss/pgmq); niveles de despliegue y celdas → ADR 0026 y 0028; memoria y envenenamiento → ADR 0024; búsqueda vectorial → ADR 0025.

Completa el MANUAL §3 (arquitectura), §5 (runtime), §6 (conocimiento y memoria), §10
(seguridad) y §12 (evals). No lo contradice: concreta cómo escalar a enterprise sin
disparar el coste.

## 1. Respuesta corta: ¿un VPS o una CPU por agente?

**No.** Un VPS por agente no da nivel enterprise y hace imposible un precio competitivo.

- **Un agente no es un proceso que piensa.** El 95 % del tiempo espera: al modelo de IA,
  a un webhook o al cliente. No consume CPU. Necesita **estado duradero** (conversación,
  memoria, aprobaciones pendientes) y **una cola**, no una máquina.
- **El aislamiento real está en los datos, no en la CPU.** Que un cliente no vea los
  datos de otro se garantiza con:
  - RLS por `organization_id`;
  - claves de cifrado por cliente;
  - permisos de herramientas;
  - registro de auditoría.

  Una VM por agente no aporta nada de esto. Además, multiplica parches, monitorización
  y puntos de fallo.
- **Coste.** Ejemplo: la máquina compartida más pequeña útil de Fly.io (1 GB) cuesta
  **6,70 $/mes** ([docs.fly.io/about/pricing](https://docs.fly.io/about/pricing)).
  1.000 clientes × 4 agentes son 4.000 máquinas, unos 26.800 $/mes, casi todas paradas
  esperando. Con *workers* compartidos que escalan con la carga, esa misma carga cabe en
  unas pocas máquinas.

**Lo que sí da una sensación de «CPU propia» es la equidad entre clientes:**
- cuotas de concurrencia por cliente;
- límites de uso y de presupuesto de tokens;
- colas separadas por prioridad.

Así un cliente con un pico no ralentiza a los demás. Para quien exige separación física
(cadenas grandes, sanidad, sector público) existen las celdas dedicadas y el despliegue
en su propia nube (§6).

## 2. Las capas

```
Canales (WhatsApp, email, web, voz)
   │ webhooks firmados → inbound_events (idempotente)
   ▼
Orquestador duradero ── una ejecución a la vez por conversación, reintentos,
   │                     pausas para aprobación, tareas programadas
   ▼
Runtime de agente (stateless) ── monta contexto → enrutador de modelos → herramientas
   │                                              │
   │                                    Motor de políticas (autonomía, aprobaciones)
   ▼
Datos por cliente: Postgres (RLS) + pgvector + Storage · claves por cliente
   ▲
Ciclo de aprendizaje (nocturno) ── señales → propuestas → aprobación → evals → publicación
```

### 2.1 Orquestador duradero

- Cada mensaje entrante es un trabajo en cola: hoy pg-boss/pgmq sobre Postgres
  (MANUAL §3.2). Si deja de escalar, se pasa a Inngest, Trigger.dev, Temporal o Vercel
  Workflow.
- **Una ejecución a la vez por conversación** (bloqueo por `conversation_id`). Así dos
  mensajes seguidos del mismo cliente no generan respuestas cruzadas.
- **Pausas duraderas:** una aprobación pendiente o una espera de 24 h no ocupa
  memoria ni CPU. El flujo se reanuda con el evento.
- **Prioridades:**
  - `realtime`: chat y voz;
  - `normal`: email, seguimientos;
  - `batch`: aprendizaje, coach, reindexado.

  El trabajo `batch` usa la Batch API de los proveedores (Anthropic: −50 %).

### 2.2 Runtime de agente (sin estado)

- Es un proceso que no guarda nada en memoria entre ejecuciones. Cualquier *worker* puede
  atender a cualquier cliente, y eso permite escalar en horizontal.
- Cada ejecución:
  1. resuelve organización, sede y contacto;
  2. monta el contexto (§3);
  3. llama al modelo por el enrutador (§2.3);
  4. pasa cada acción por el motor de políticas.
- **Límites por ejecución:** número máximo de pasos, *timeout*, presupuesto de tokens y
  lista blanca de herramientas por agente y vertical.

### 2.3 Enrutador de modelos y proveedores de IA

Una sola capa (paquete propio, o AI Gateway / LiteLLM autoalojado) que decide modelo y
proveedor en cada llamada.

**Criterios:**
- tipo de tarea: clasificar, conversar, redactar, extraer de documentos;
- calidad mínima;
- región (política «solo UE»);
- coste;
- disponibilidad.

**Por defecto, modelo rápido** (Haiku 5.5, gpt-6-luna o Gemini Flash-Lite: unos
0,005 € por conversación). El modelo avanzado solo se usa en tareas marcadas y con tope
por cliente.

**Modos de conexión:**
- claves de Moodly;
- **BYOK**: claves del cliente, guardadas en la bóveda cifrada;
- **nube del cliente**: Azure OpenAI, Bedrock o Vertex en su cuenta y su región.

**Fiabilidad:**
- *fallback* automático entre proveedores equivalentes;
- *circuit breaker* si un proveedor degrada;
- en el peor caso, paso a humano.

**Medición:** cada llamada registra tokens, coste, proveedor y latencia en `agent_runs` y
`usage_records`. De ahí salen la facturación por uso y los márgenes.

## 3. Contexto: qué ve el agente en cada turno

El presupuesto objetivo es de **unos 8.000 tokens de entrada por turno**. El orden es
estable para aprovechar la caché de prompts.

| Capa | Contenido | Caché |
|---|---|---|
| 1. Sistema | Rol del agente, reglas duras, formato | Fija: caché 1 h |
| 2. Plantilla de vertical | Skills y tono del vertical y subsector | Fija por versión |
| 3. Configuración del cliente | Servicios, precios vigentes, horarios, políticas, objetivos | Cambia poco |
| 4. Recuperado | Conocimiento (RAG híbrido) + memoria relevante + entidades del mapa (§6.4 MANUAL) | Por turno |
| 5. Conversación | Últimos turnos + resumen acumulado | Por turno |

- **Compactación:** a partir de N turnos se resume lo antiguo. Las decisiones (citas,
  importes) se guardan como datos estructurados, no como texto.
- **Datos vivos:** precios, disponibilidad y stock se consultan a la integración o a datos
  estructurados, nunca al texto indexado.
- **Seguridad:**
  - Lo recuperado entra siempre como datos, nunca como instrucciones.
  - Los datos personales sensibles se enmascaran antes de enviarlos al modelo.

## 4. Memoria: cuatro niveles

| Nivel | Qué guarda | Quién escribe | Vida |
|---|---|---|---|
| De trabajo | La conversación en curso | Runtime | Mientras dura y su resumen |
| Del cliente final | Preferencias y hechos (por ejemplo, «prefiere tardes», «celíaco») | Extracción posterior, con un modelo ligero | Hasta que se corrija o borre (RGPD) |
| Del negocio | Hechos y reglas aprendidas («los martes no hay fisio») | Propuesta del agente → aprobación del dueño | Versionada |
| Del vertical | Mejoras de la plantilla del sector | Equipo de Moodly, con datos anonimizados y opt-in | Versiones de plantilla |

Detalle de extracción, consolidación y borrado: MANUAL §6.2.

**Regla clave:** nada de lo que cambie cómo actúa el agente con el negocio entra sin
aprobación humana o sin pasar evals.

## 5. Ciclo de aprendizaje automático

No se reentrena el modelo; mejora la **configuración del agente**: conocimiento, reglas,
ejemplos y prompts por versión. Es más barato, explicable y reversible.

```
Señales → Análisis nocturno → Propuestas → Aprobación (Coach) → Evals → Publicación gradual → Medición
   ▲                                                                                   │
   └───────────────────────────────────────────────────────────────────────────────────┘
```

1. **Señales**, por cliente:
   - borradores que una persona editó antes de enviar (la mejor señal);
   - aprobaciones rechazadas;
   - conversaciones que tomó un humano;
   - «no lo sé» del agente (MANUAL §5.9);
   - resultados: cita hecha o no, lead cualificado, factura cobrada;
   - valoraciones.
2. **Análisis nocturno** con la Batch API (−50 %): agrupa fallos parecidos y detecta
   huecos de conocimiento.
3. **Propuestas:**
   - nueva entrada de conocimiento o FAQ;
   - cambio de regla;
   - ejemplo de respuesta (*few-shot*) sacado de ediciones aprobadas;
   - ajuste de tono.

   Cada propuesta lleva su evidencia.
4. **Aprobación** en el Modo coach: el dueño acepta, edita o descarta.
5. **Evals antes de publicar:**
   - conjunto fijo por vertical (casos y límites: no dar consejo médico, alérgenos…);
   - regresión del propio cliente, con sus conversaciones reales anonimizadas.

   Si empeora alguna métrica, no se publica.
6. **Publicación gradual:** nueva versión del agente al 10 % de conversaciones y, si las
   métricas aguantan, al 100 %. Vuelta atrás con un clic.
7. **Mejora de las plantillas de vertical:**
   - solo con datos anonimizados y consentimiento;
   - nunca se mezclan datos de un cliente en otro.
8. **Ajuste fino (*fine-tuning*):** solo más adelante y solo para tareas estrechas y de
   gran volumen (clasificar intención, extraer datos de facturas), con modelos pequeños.

## 6. Niveles de despliegue

| Nivel | Para quién | Cómo | Coste de infraestructura |
|---|---|---|---|
| **Compartido (celda UE)** | Pymes | Workers compartidos que escalan, Postgres multi-tenant con RLS | Céntimos o pocos euros por cliente al mes [medir en piloto] |
| **Celda dedicada** | Cadenas medianas | Misma plantilla de infraestructura, con BD y workers solo suyos | Fijo por celda [estimar], repercutido en Enterprise |
| **Tu nube (BYOC)** | Grandes cuentas, regulados | Contenedores + Helm en la cuenta del cliente; modelos en su Azure/AWS/GCP | Lo paga el cliente; nosotros licencia + soporte |
| **On-premise** | Casos excepcionales | Igual que BYOC, con modelos abiertos | A medida |

Para que estos niveles sean posibles más adelante:
- **todo como contenedores** con configuración por variables;
- nada que dependa en exclusiva de un servicio gestionado sin alternativa autoalojable
  (Postgres sí; funciones propietarias, no en el núcleo del runtime).

**Excepción: voz.** Una llamada en tiempo real necesita un proceso con conexión abierta y
latencia baja. Se usan **workers de voz** en la región UE que escalan por **llamadas
simultáneas**, no por agente.

## 7. Lo que hace «enterprise grade»

| Área | Medida |
|---|---|
| Aislamiento | RLS en todas las tablas + tests pgTAP de aislamiento; claves de cifrado por cliente (*envelope encryption*, KMS) |
| Identidad | SSO SAML/OIDC, SCIM, roles por sede, MFA |
| Auditoría | Registro inmutable de cada acción del agente, con quién la aprobó; exportable |
| Datos | Residencia UE; borrado real; DPA; lista de subencargados; enmascarado de datos personales antes del LLM |
| Seguridad de IA | Contenido entrante tratado como datos; lista blanca de herramientas; motor de políticas; techo de autonomía (MANUAL §5.6) |
| Fiabilidad | Colas duraderas, idempotencia, *fallback* de proveedor, backups con recuperación a un punto en el tiempo (PITR), objetivos de RPO/RTO, página de estado, SLA por plan |
| Observabilidad | Trazas OpenTelemetry + Langfuse (UE); coste, latencia y calidad por ejecución y por cliente |
| Calidad | Evals por vertical en CI; publicación gradual; versiones de agente con vuelta atrás |
| Cumplimiento | Controles preparados para ISO 27001 / SOC 2 desde el principio (hoja de ruta, MANUAL §10.6) |

## 8. Cómo encaja con un precio competitivo

El coste de Moodly está en el **modelo de IA y la voz**, no en la infraestructura. Las
palancas, de mayor a menor efecto:

1. **Enrutador con modelo rápido por defecto:** de 0,10 € a 0,005 € por conversación.
2. **Caché de prompts:** las capas 1–3 se reutilizan (lectura al 10 % del precio en
   Anthropic).
3. **Batch API** para el aprendizaje y el coach: −50 %.
4. **Contexto acotado:** compactación y recuperación selectiva, sin enviar todo el
   historial.
5. **Workers compartidos** en vez de máquinas por agente (§1).
6. **BYOK y nube del cliente** para grandes cuentas: el coste de IA sale de nuestro margen.
7. **Señales externas compartidas** por sector y zona (MANUAL §5.12): su coste no crece
   con el número de clientes.

Cifras de coste por proveedor: [`modelo-precios.md`](modelo-precios.md).

## 9. Plan por fases

1. **Ahora (pilotos):**
   - Supabase (RLS, pgvector, cola en Postgres);
   - un worker always-on en la UE;
   - enrutador propio sencillo con 2 proveedores;
   - Langfuse;
   - memoria de cliente y de negocio con aprobación;
   - medir el coste real por conversación.
2. **Pymes a escala:**
   - orquestador duradero con prioridades;
   - cuotas por cliente;
   - evals por vertical en CI;
   - ciclo de aprendizaje nocturno;
   - workers de voz.
3. **Enterprise:**
   - celdas dedicadas;
   - SSO/SCIM;
   - KMS por cliente;
   - BYOC con Helm;
   - SLA y página de estado;
   - auditoría SOC 2 / ISO 27001.

## 10. Decisiones abiertas (para ADR)

1. Orquestador: seguir con pg-boss/pgmq o pasar a Inngest, Trigger.dev, Temporal o
   Vercel Workflow.
2. Enrutador: propio, AI Gateway o LiteLLM autoalojado.
3. Proveedor de voz (ElevenLabs Agents u OpenAI/Gemini realtime + telefonía).
4. Proveedor de embeddings y su región.
5. KMS por cliente: AWS KMS, GCP KMS o Vault.
