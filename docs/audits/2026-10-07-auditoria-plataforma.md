# Auditoría de la plataforma: de prototipo a producto en producción

Fecha: 2026-10-07 · Repo: `github.com/dsvmotion/moodly` · Rama auditada: `feat/site-landings`
(sobre `main` en `f578018`).

Objetivo: saber qué falta para que todo lo diseñado (web pública, plataforma de
escritorio y app móvil) funcione de verdad y a nivel enterprise. Cubre datos,
usuarios, permisos, franquicias, agentes, contexto, memoria, automatizaciones,
proveedores de IA, integraciones, facturación, API, gobierno e infraestructura.
Termina con un plan paso a paso.

## 1. Resumen ejecutivo

- **Los cimientos son buenos y están probados.** Existen:
  - tenants con RLS forzada (organizaciones, regiones, locales, usuarios, membresías);
  - revocación real de sesiones;
  - Supabase Auth con registro cerrado;
  - app shell en `apps/web` con `packages/ui`;
  - CI, guardas de mergeo y tests de aislamiento.
- **El producto todavía no existe en el backend.** De las ~50 tablas que propone el
  MANUAL (§4.2) hay 5. `apps/worker` y 8 de los 11 paquetes (`agent-core`, `skills`,
  `channels`, `integrations`, `knowledge`, `domain`, `templates`, `evals`) están vacíos:
  2 líneas cada uno.
- **El frontend diseñado es un prototipo con datos de ejemplo:** `apps/site/src/app/plataforma`
  tiene 34 pantallas JSX con datos fijos y unos 140 botones marcados `data-demo`. La app
  real (`apps/web`) tiene 15 rutas, 13 de ellas vacías (`SectionEmpty`).
- **No hay ningún entorno alojado:** ni Supabase en la nube, ni Vercel, ni worker, ni
  dominio, ni correo transaccional, ni pagos.
- **Conclusión:** el trabajo no es «conectar el frontend», sino construir el backend por
  capas y reconstruir cada pantalla del prototipo en `apps/web` sobre datos reales. El
  prototipo sirve de especificación visual y de flujo.

## 2. Estado verificado hoy

| Comprobación | Resultado |
|---|---|
| `pnpm check` (typecheck + lint + test + build, 52 tareas, incluida `apps/site`) | 52/52 ✓ |
| `pnpm test:db` (pgTAP, aislamiento RLS) | 186/186 ✓ |
| Migraciones | 2: `tenants_rls`, `session_revocation` |
| Tablas | `organizations`, `regions`, `locations`, `users`, `memberships` |
| Roles | `org_admin`, `region_manager`, `location_manager`, `staff` (con alcance por región o local) |
| `apps/web` | Login, «Mi organización», Registros → Locales y Personas con datos reales; el resto vacío |
| `apps/site` | Web pública en 4 idiomas + prototipo navegable; **sin commitear** (rama sin PR) |
| Entornos alojados | Ninguno |
| Protección de `main` | Bloqueada: el plan Free de GitHub no la permite en repos privados |

## 3. Brechas por dominio

Leyenda: ✓ hecho · ◐ parcial · ✗ falta. «Diseñado» = existe en el prototipo o en los documentos.

### 3.1 Identidad, usuarios y acceso

| Capacidad | Estado | Falta |
|---|---|---|
| Login email/contraseña, sesión revocable | ✓ | Configuración de Auth en el proyecto alojado (límites, captcha, contraseña, `jwt_expiry`: STATUS 3c-2) |
| Varios usuarios por negocio, roles y alcance | ✓ | Roles de producto que aún no existen en BD: «Profesional» y «Recepción» del diseño se mapean a `staff`. Decidir si hacen falta permisos más finos (ver §4.4) |
| Un usuario en varios negocios | ✓ (`memberships` única por usuario y org) | Selector de organización en `apps/web` |
| Invitaciones | ✗ | Flujo de invitación con email (Resend), caducidad y aceptación. Retirar el INSERT directo en `memberships` (STATUS 3b) |
| Perfil y preferencias | ✗ | Idioma, zona horaria, avisos por canal (pantalla Mi perfil) |
| MFA (TOTP) | ✗ | Activar en Supabase Auth y exigirlo por rol u organización |
| SSO SAML/OIDC + SCIM | ✗ | Enterprise. Depende del plan de Supabase (MANUAL §18 #11) |
| Equipo interno (`platform_staff`) | ✗ | Panel `/ops` para dar de alta y configurar clientes |

### 3.2 Estructura de clientes: negocios, cadenas y franquicias

| Caso | Estado | Propuesta |
|---|---|---|
| Negocio de una sede | ✓ | Una `organization` + un `location` |
| Cadena (una empresa, varias sedes) | ✓ | Una `organization` con `regions` y `locations` |
| **Franquicia** (franquiciador + franquiciados con empresas distintas) | ✗ | Ver §4.1: cada franquiciado es su propia `organization` (sus datos y su RGPD); una entidad `networks` permite al franquiciador publicar plantillas y políticas bloqueadas y ver solo métricas agregadas o lo que cada franquiciado comparta |
| Grupos con varias marcas | ✗ | El mismo mecanismo `networks` |

### 3.3 Agentes, configuración y personalización

| Capacidad | Estado | Falta |
|---|---|---|
| Catálogo de agentes (`agent_types`) | ✗ | 4 tipos: Recepción, Atención, Comercial, Administración |
| Plantillas por vertical y subsector | ✗ (existen como datos de marketing en `verticals.js`) | `agent_templates` versionadas: 8 verticales × 47 subsectores → skills, tono, reglas y flujos por defecto |
| Instancias de agente por negocio | ✗ | `agents` con estado (`draft`/`testing`/`live`/`paused`) |
| Personalización heredada org → región → local con claves bloqueadas | ✗ | `config_overrides` + `config_snapshots` (MANUAL §4.3, STATUS tarea 5) |
| Skills y autonomía (solo / con aprobación / nunca) | ✗ | `skills`, `agent_skills`, motor de políticas con techo de autonomía (§5.4, §5.6) |
| Reglas de negocio | ✗ | `business_rules` |
| Horarios, tono, mensajes | ✗ | Parte de la configuración heredada |

### 3.4 Runtime, contexto y modelos de IA

| Capacidad | Estado | Falta |
|---|---|---|
| Worker always-on + cola | ✗ | `apps/worker` con pg-boss sobre Postgres (STATUS tarea 6) |
| Orquestación de una ejecución | ✗ | `agent_runs`, `executions`, una ejecución a la vez por conversación, reintentos, pausas por aprobación |
| Montaje de contexto por capas | ✗ | `packages/agent-core` (§5.3 y `arquitectura-agentes-enterprise.md` §3) |
| Enrutador multi-proveedor | ✗ | Modelo por tarea, *fallback*, política «solo UE», medición de coste |
| Proveedores y BYOK | ✗ | `model_providers`, `org_model_settings`, credenciales cifradas del cliente (pantalla `/plataforma/modelos`) |
| Enmascarado de datos personales y defensa ante instrucciones maliciosas | ✗ | Antes de cada llamada al LLM; lo entrante siempre como datos |
| Evals | ✗ | `packages/evals`: conjunto por vertical, en CI |

### 3.5 Conocimiento, memoria y aprendizaje

| Capacidad | Estado | Falta |
|---|---|---|
| Base de conocimiento (RAG) | ✗ | Storage + ingesta (PDF, web, FAQ) + `knowledge_chunks` con pgvector y búsqueda híbrida |
| Preguntas sin respuesta («no lo sé») | ✗ | `knowledge_requests` → pantalla Conocimiento |
| Memoria del cliente final y del negocio | ✗ | `memories` (extracción posterior, consolidación, aprobación, borrado real) |
| Mapa del negocio | ✗ | `entities`, `entity_links` |
| Ciclo de aprendizaje | ✗ | Señales (ediciones, rechazos, tomas de control, resultados) → propuestas → aprobación en el Modo coach → evals → publicación gradual. Tablas `agent_versions`, `learning_signals`, `proposals` |
| Coach y señales externas | ✗ | `coach_reviews`, `recommendations`, `external_signals` (Fase 2b) |

### 3.6 Operación diaria (lo que se ve en la plataforma)

| Pantalla del prototipo | Tablas o fuente | Estado |
|---|---|---|
| Inicio, Informes | Agregados de `agent_runs`, `usage_records`, `goals` | ✗ |
| Conversaciones (escritorio y móvil) | `contacts`, `contact_identities`, `conversations`, `messages` + Realtime | ✗ |
| Aprobaciones | `approvals` sobre `executions` | ✗ |
| Agenda | **Decisión:** ¿Moodly guarda citas propias o refleja Google/Outlook/Doctoralia? Propuesta: tabla `appointments` como espejo sincronizado (§4.3) | ✗ |
| Leads | `contacts` + `deals`, o el CRM del cliente como fuente | ✗ |
| Facturas e inventario | Espejo del programa de facturación (Holded…) + borradores propios para aprobar | ✗ |
| Llamadas | `calls` (transcripción, grabación con consentimiento) | ✗ (fase Voz) |
| Clientes | `contacts` + memoria del cliente | ✗ |
| Tareas, notas, vistas guardadas, favoritos | `tasks`, `notes`, `saved_views`, `favorites` | ✗ |
| Multisede | `regions`, `locations` + agregados | ◐ (los datos existen; falta la pantalla) |

### 3.7 Canales e integraciones

| Capacidad | Estado | Falta |
|---|---|---|
| Ingesta de webhooks idempotente | ✗ | `inbound_events`, verificación de firma |
| Webchat | ✗ | Widget + endpoint |
| WhatsApp | ✗ | Elegir el BSP (MANUAL §18 #4) o la Cloud API directa |
| Email (Gmail / Microsoft) | ✗ | OAuth + sincronización |
| Instagram / Messenger | ✗ | API de Meta |
| Voz | ✗ | Telefonía + proveedor de voz (ver `modelo-precios.md`) |
| Integraciones con OAuth y bóveda de tokens | ✗ | `integrations`, `integration_secrets` cifrados (KMS o Vault), comprobación de salud |
| MCP para «otras herramientas» | ✗ | Conector genérico |
| 121 integraciones del catálogo | ✗ | Son marketing: hay que priorizar 5–8 para el piloto |

### 3.8 Facturación y consumo

| Capacidad | Estado | Falta |
|---|---|---|
| Medición de uso | ✗ | `usage_records` por ejecución (tokens, conversaciones, minutos) |
| Límites y límite de gasto | ✗ | `usage_limits`: aviso al 80 %; al 100 %, pasar al equipo |
| Stripe | ✗ | Cliente, suscripción por agente (cantidad), uso medido (conversaciones extra, minutos), sedes adicionales, portal de cliente, webhooks, facturas |
| Implantación según escala | ✗ | Presupuestos o *quotes* de pago único en Stripe |
| Prueba de 14 días | ✗ | Estado `trial` y caducidad |
| IVA y facturas legales en España | ✗ | Stripe Tax o Holded. Facturación electrónica (Verifactu, ley Crea y Crece): revisar plazos con asesoría |

### 3.9 Gobierno, seguridad y cumplimiento

| Capacidad | Estado | Falta |
|---|---|---|
| Aislamiento por cliente (RLS) | ✓ | Extenderlo a cada tabla nueva, con su test pgTAP |
| Registro de auditoría | ✗ | `audit_logs` de solo inserción, consultable y exportable |
| Cifrado de secretos | ✗ | Decidir el mecanismo (MANUAL §18 #6): Supabase Vault o KMS con cifrado por sobres |
| Storage con RLS | ✗ | Buckets por tipo (conocimiento, adjuntos, facturas, grabaciones) con políticas por organización |
| Derechos RGPD (exportar y borrar) | ✗ | `data_requests` + jobs |
| Retención por tipo de dato | ✗ | Políticas y job de purga |
| Consentimientos del cliente final | ✗ | `contacts.consents` + registro |
| Límites de uso de la API | ✗ | Por organización y endpoint |
| Backups y recuperación a un punto (PITR) | ✗ | Plan de Supabase con PITR, prueba de restauración |
| Pentest, ISO 27001, SOC 2 | ✗ | En la hoja de ruta (MANUAL §18 #10) |
| Protección de `main` | Bloqueada | GitHub Team o repo público |

### 3.10 API pública, webhooks y observabilidad

| Capacidad | Estado | Falta |
|---|---|---|
| API REST pública | ✗ | `api_keys` por organización con permisos, versión `v1` |
| Webhooks salientes | ✗ | `webhook_endpoints` + outbox `domain_events` |
| Errores | ✗ | Sentry (región UE) |
| Trazas y logs | ✗ | OpenTelemetry + pino |
| Trazas de LLM | ✗ | Langfuse (UE o autoalojado) |
| Página de estado | ✗ | Cuando haya clientes |

## 4. Decisiones de modelo que faltan en el MANUAL

### 4.1 Franquicias y redes

- `networks` (franquicia o grupo): `id`, `name`, `owner_organization_id`.
- `network_members`: `network_id`, `organization_id`, `role` (`franchisor` / `franchisee`)
  y `sharing` (jsonb). En `sharing` el franquiciado decide qué comparte: métricas
  agregadas, conversaciones o nada.
- El franquiciador publica **plantillas y políticas de red**, que entran como un nivel
  más de herencia (`network` → `organization` → `region` → `location`), con claves
  bloqueadas.
- **RLS:** un usuario del franquiciador nunca lee tablas del franquiciado. Solo ve vistas
  agregadas o lo que el franquiciado comparte de forma explícita. Requiere ADR y tests
  pgTAP específicos.

### 4.2 Proveedores de IA y BYOK

- `model_providers` es un catálogo global: proveedor, modelo, capacidades, región y
  precios de referencia con fecha.
- `org_model_settings`: modo (`included` / `byok` / `own_cloud`), «solo UE», *fallback*
  y modelo por agente.
- Las credenciales del cliente van en `integration_secrets` (cifradas, nunca legibles
  desde el navegador).

### 4.3 Sistema de registro frente a espejo

Para agenda, leads y facturas, propuesta: **la herramienta del cliente es la fuente de
verdad** (Google Calendar, CRM, Holded). Moodly guarda un **espejo** sincronizado
(`appointments`, `deals`, `invoices_mirror`) para leer rápido, mostrar las pantallas y
dar contexto a los agentes. Si el cliente no tiene herramienta, el espejo pasa a ser la
fuente. Requiere ADR.

### 4.4 Permisos finos

Los 4 roles actuales controlan el **alcance**. El diseño pide además **capacidades**:
- ver facturación;
- aprobar facturas;
- cambiar reglas;
- gestionar el equipo.

Propuesta: una tabla `role_permissions` con permisos por defecto para cada rol y
excepciones por membresía. Así «Dueña», «Gerente», «Recepción» y «Profesional» del
diseño encajan sin crear más roles.

### 4.5 Facturación

Tablas nuevas:
- `billing_accounts`: organización ↔ cliente de Stripe.
- `subscriptions`: plan, agentes, sedes, estado y prueba.
- `implementation_quotes`.
- `invoices`, como espejo de Stripe.

### 4.6 Ciclo de aprendizaje

Tablas nuevas:
- `agent_versions`: configuración resuelta versionada, publicación gradual y vuelta atrás.
- `learning_signals`.
- `proposals`.
- `eval_runs`.

## 5. Infraestructura objetivo

| Pieza | Servicio propuesto | Región | Entornos | Estado |
|---|---|---|---|---|
| Web pública (`apps/site`) | Vercel | UE (`fra1`) | preview / prod | ✗ |
| App (`apps/web`) | Vercel (funciones Node en la UE) | UE | preview / staging / prod | ✗ |
| Base de datos, Auth, Storage, Realtime | Supabase (plan con PITR; SSO si se vende a enterprise) | Frankfurt | staging + prod (proyectos separados) | ✗ (solo local) |
| Worker (cola, agentes, webhooks, tareas programadas) | Contenedor always-on: Fly.io o Railway en la UE, o Hetzner con Docker si se prioriza coste | UE | staging + prod | ✗ |
| Workers de voz (fase Voz) | Contenedores que escalan por llamadas | UE | — | ✗ |
| Email transaccional | Resend (dominio verificado, SPF/DKIM/DMARC) | — | — | ✗ |
| Pagos | Stripe (test + live) | — | — | ✗ |
| WhatsApp | BSP o Cloud API de Meta | — | — | ✗ (decisión abierta) |
| LLM | Enrutador → Anthropic, OpenAI, Google y Mistral (y BYOK) | UE si es posible | — | ✗ (decisión abierta) |
| Secretos de la plataforma | Variables de Vercel + secretos del worker; nunca en el repo | — | — | ✗ |
| Secretos de clientes | Supabase Vault o KMS (AWS `eu-central-1`) | UE | — | ✗ (decisión abierta) |
| Observabilidad | Sentry UE + Langfuse UE + logs | UE | — | ✗ |
| DNS y dominios | `moodly.ai` (web), `app.moodly.ai`, `api.moodly.ai` | — | — | ✗ |
| Código | GitHub Team (protección de `main`) | — | — | Bloqueado |

**No a un VPS por agente:** el razonamiento está en `docs/design/arquitectura-agentes-enterprise.md` §1.

## 6. Deuda y riesgos detectados

1. **Dos frontends.** El prototipo (`apps/site/.../plataforma`) usa JSX con estilos en
   línea y datos fijos; la app real (`apps/web`) usa TypeScript, `packages/ui` y
   next-intl.
   - **Decisión propuesta:** `apps/site` queda solo como web pública. Las pantallas de
     plataforma se reconstruyen en `apps/web` y el prototipo se publica como
     `/demo`, separado del producto.
2. **Tres fuentes de diseño desalineadas.**
   - `packages/ui`: fuentes del sistema, sin marca.
   - `apps/site`: Labil Grotesk, Plus Jakarta Sans y colores de agente confirmados.
   - Tokens del canvas: Geist y la paleta antigua de agentes.

   Hay que llevar los tokens de marca a `packages/ui` como fuente única.
3. **`apps/site` sin commitear**, con el lockfile modificado. Toca dependencias (zona
   sensible), así que el PR necesita revisión humana.
4. **Alta de miembros sin consentimiento** (`memberships_insert`): conocido, se cierra
   con las invitaciones.
5. **Sin protección de `main` en GitHub.** Hoy solo la sostiene el proceso.
6. **Licencia webfont de Labil Grotesk** sin confirmar antes de publicar.
7. **Precios provisionales y tarifas de proveedores por validar:** WhatsApp para España y
   Mistral (`modelo-precios.md`).
8. **Textos legales en borrador**, con `[placeholders]`.
9. **Supabase CLI 2.118.0.** Hay una 2.120.0; actualizar a la vez en local y en CI.

## 7. Plan paso a paso

Cada paso es un PR o un grupo pequeño de PRs. Ninguno se da por hecho sin evidencia
(tests, e2e o logs), según AGENTS.md. Los pasos que tocan migraciones, RLS, auth o
secretos requieren revisión humana.

### Paso 0 · Decisiones y cuentas (producto)

Bloquean los pasos siguientes:
- vertical y cliente piloto (#3);
- BSP de WhatsApp (#4);
- proveedores LLM y embeddings (#5);
- mecanismo de secretos (#6);
- plan de Supabase (#11);
- pymes o cadenas primero (#13);
- GitHub Team.

Cuentas que hay que crear (las crea producto; el agente no inventa credenciales): Vercel,
Supabase (organización y 2 proyectos UE), Resend, Stripe, Sentry, Langfuse y dominio.

### Paso 1 · Entornos alojados (staging)

- Proyecto Supabase de staging en Frankfurt; migraciones desplegadas desde el CI.
- Configuración de Auth de producción (STATUS 3c-2).
- Vercel: `apps/site` y `apps/web` con previews por PR y variables por entorno.
- Resend con el dominio verificado.
- Sentry en web y worker.
- **Criterio de salida:** login real en `staging.app.moodly.ai`, e2e contra staging en
  verde y prueba de restauración del backup.

### Paso 2 · Identidad completa

- Invitaciones (STATUS 3b).
- Perfil y preferencias.
- MFA.
- `platform_staff` y panel `/ops` mínimo.
- `audit_logs` base.
- `role_permissions` (§4.4).
- **Criterio:** e2e de invitar → aceptar → ver solo su alcance, con pgTAP de cada política.

### Paso 3 · Redes y franquicias + configuración heredada

- ADR de franquicias (§4.1).
- `networks`, `agent_types`, `agent_templates` (los 8 verticales como datos versionados),
  `agents`, `config_overrides`, `config_snapshots` y `business_rules` (STATUS tarea 5).
- **Criterio:** tests de resolución de configuración con herencia y bloqueos, y pgTAP de
  que el franquiciador no ve datos del franquiciado.

### Paso 4 · Worker, cola y eventos

- `apps/worker` con pg-boss, outbox `domain_events`, tareas programadas, logs y trazas
  (STATUS tarea 6).
- **Criterio:** un trabajo encolado desde la web se procesa en el worker de staging, con
  traza visible.

### Paso 5 · Modelos de IA

- Enrutador en `packages/agent-core`.
- `model_providers`, `org_model_settings` y BYOK con secretos cifrados.
- `usage_records`, enmascarado de datos personales y Langfuse.
- **Criterio:** la misma tarea pasa por 2 proveedores; el *fallback* se prueba cortando
  uno; el coste queda registrado por organización.

### Paso 6 · Primer agente real (Fase 1 del MANUAL)

- Webchat + WhatsApp: `inbound_events`, `contacts`, `conversations` y `messages`, con
  Realtime.
- Agente Recepción/Atención del vertical piloto.
- Motor de políticas y `approvals`.
- Pantallas Conversaciones, Aprobaciones e Inicio reconstruidas en `apps/web`.
- **Criterio:** un mensaje real de WhatsApp recibe respuesta, una acción sensible queda
  pendiente de aprobación, se aprueba desde la app y todo queda en `audit_logs`.

### Paso 7 · Conocimiento y memoria

- Storage con RLS, ingesta, pgvector, `knowledge_requests` y `memories`.
- Pantallas Conocimiento y Memoria.
- **Criterio:** el agente responde con un documento subido y pregunta lo que no sabe; las
  evals del vertical pasan.

### Paso 8 · Integraciones del piloto

- OAuth Google/Microsoft (calendario y email) y el espejo de agenda (§4.3).
- 1 CRM y 1 programa de facturación español.
- Pantallas Agenda, Integraciones y Facturas.
- **Criterio:** una cita creada por el agente aparece en Google Calendar y en la Agenda;
  una desconexión se detecta y avisa.

### Paso 9 · Facturación

- Stripe: suscripción por agente, uso medido, sedes, prueba de 14 días, límite de gasto,
  presupuestos de implantación, portal de cliente y webhooks.
- Pantalla Plan y consumo.
- **Criterio:** alta en modo test → prueba → suscripción → consumo extra facturado →
  aviso al 80 % → paso al equipo al 100 %.

### Paso 10 · Resto de pantallas y app móvil

- Reconstruir en `apps/web` las pantallas restantes del prototipo: Clientes, Leads,
  Reglas, Flujos, Horarios, Equipo, Sedes, Modelos, Perfil e Informes.
- Versión móvil: PWA primero; app nativa después si hace falta.
- Retirar los `data-demo`.
- **Criterio:** e2e por rol de cada pantalla; ningún botón sin acción real.

### Paso 11 · Aprendizaje y coach

- `agent_versions`, señales, propuestas, evals en CI y publicación gradual.
- Modo coach con datos internos.
- **Criterio:** una edición humana repetida genera una propuesta; al aprobarla y pasar
  las evals se publica al 10 % y luego al 100 %; se puede revertir.

### Paso 12 · Enterprise y producción

- SSO/SCIM.
- Claves por organización.
- Retención y derechos RGPD.
- API pública y webhooks.
- Proyecto de producción.
- Pentest.
- Página de estado.
- Celdas dedicadas, cuando un cliente lo pida.

### Paso 13 · Voz

- Proveedor elegido con los costes medidos.
- Workers de voz.
- `calls`.
- Pantalla Llamadas.

## 8. Qué necesito de producto para empezar

1. Elegir **vertical y cliente piloto** y **pymes o cadenas primero**.
2. Crear (o autorizar a crear) las cuentas de **Supabase, Vercel, Resend, Stripe y Sentry**
   y pasar el acceso por los canales seguros del equipo, nunca por chat.
3. Decidir **GitHub Team** para proteger `main`.
4. Abrir el PR de `apps/site`. Toca dependencias, así que necesita la etiqueta
   `revisado-humano`.
5. Validar las decisiones de §4 (franquicias, espejo, permisos) antes de las migraciones
   correspondientes.
