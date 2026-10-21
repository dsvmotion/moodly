# Mapa pantalla → ruta → componentes → datos

Fecha: 2026-10-09 · Resuelve §2 y §3.1 de `docs/audits/2026-10-09-cierre-diseno-backend.md`.

> **Actualización 2026-10-20.** Las rutas en español y las claves de agente de §0 quedan confirmadas por el ADR 0023 y pasan a MANUAL §9.4 y §1.4. El Asistente (§3) se rige por el ADR 0029; la memoria (§2), por el ADR 0024; los flujos y tareas programadas, por el ADR 0027 (DBOS en lugar de pg-boss).

Puente entre el **prototipo** (`apps/site/plataforma`, la especificación visual) y el **producto** (`apps/web`, a reconstruir sobre `packages/ui` y datos reales). Es el primer documento de la fase backend: por cada pantalla, qué ruta tendrá en `apps/web`, qué componentes de `packages/ui` usa, y **qué entidades/campos lee y escribe, con qué acciones, permiso y tiempo real**.

Notación: **R** = lee · **W** = escribe · 🔒 = acción sensible (confirmación + `audit_logs`) · ⚡ = tiempo real (Supabase Realtime). Entidades según `docs/audits/2026-10-07-auditoria-plataforma.md` §4/§6 y `docs/design/edge-y-postura-enterprise.md` §5.

## 0. Decisiones de vocabulario (cerrar inconsistencia §4.2)

- **Rutas del producto en español** (coinciden con el prototipo y el comprador ES): `apps/web` migra de sus nombres actuales a estos.

| Prototipo / objetivo `apps/web` | `apps/web` hoy | Acción |
|---|---|---|
| `/app` (Inicio) | `/app` | — |
| `/app/conversaciones` | `/app/inbox` | renombrar |
| `/app/aprobaciones` | `/app/approvals` | renombrar |
| `/app/clientes` | `/app/records/contacts` | renombrar + separar de Leads |
| `/app/leads` | — | crear |
| `/app/agenda`, `/app/facturas`, `/app/llamadas`, `/app/informes` | — | crear |
| `/app/agentes`, `/app/conocimiento`, `/app/memoria`, `/app/reglas`, `/app/flujos`, `/app/horarios`, `/app/coach`, `/app/asistente`, `/app/red` | parciales/inexistentes | crear |
| `/app/ajustes/{general,perfil,preferencias,privacidad,equipo,roles,modelos,integraciones,sedes,plan,facturacion,seguridad,auditoria}` | `/app/settings/organization` | crear las 13 |

- **Claves de agente canónicas** (en `@repo/config` `AGENT_TYPES`): `reception`·`customer`·`sales`·`admin` → Recepción·Atención al cliente·Comercial·Administración, con color `--agent-*`.
- **Idioma/tema**: el producto sale **es + en** (next-intl) y **claro + oscuro** (tokens). El prototipo se queda ES/claro como especificación.

## 1. Inicio y operación

| Pantalla | Ruta objetivo | Componentes `packages/ui` | Entidades (R/W) | Acciones clave | Permiso | ⚡ |
|---|---|---|---|---|---|---|
| Inicio | `/app` | AppShell, Badge, Card | R `agent_runs`·`usage_records`·`goals`·`approvals`·`conversations`(resumen) | Abrir aprobación, ir a agente | según alcance | ⚡ contadores |
| Conversaciones | `/app/conversaciones` | AppShell, lista, PreviewDrawer, ConfirmDialog, Toast | R `conversations`·`messages`·`contacts`·`contact_identities` · W `messages`(responder), `conversations.status` | Responder, 🔒 tomar el control, marcar resuelta, 🔒 aprobar acción propuesta | ver/tomar control por rol | ⚡ mensajes |
| Aprobaciones | `/app/aprobaciones` | lista, ConfirmDialog, Toast | R `approvals`·`executions` · W `approvals.decision` | 🔒 aprobar/rechazar/editar, revisar detalle | aprobar según `role_permissions` | ⚡ cola |
| Agenda | `/app/agenda` | DataTable/calendario | R `appointments`(espejo)·`locations`·staff · W `appointments` (si Moodly es fuente) | crear/mover/cancelar cita, avisar lista de espera | ver/mover por rol | ⚡ |
| Clientes | `/app/clientes` | DataTable, PreviewDrawer | R `contacts`·`memories`·`appointments`·`deals`·`invoices_mirror` · W `contacts`(editar) | buscar/filtrar, escribir, nueva cita, ver ficha | ver clientes por alcance | — |
| Leads | `/app/leads` | kanban/DataTable | R `contacts`·`deals` · W `deals.stage` | mover etapa, 🔒 pago a plazos | Comercial/gerencia | — |
| Facturas e inventario | `/app/facturas` | DataTable, ConfirmDialog | R `invoices_mirror`·inventario · W aprobación de borradores | 🔒 aprobar factura/pedido | aprobar facturas (permiso) | — |
| Llamadas | `/app/llamadas` | lista + transcripción | R `calls`(transcripción, grabación con consentimiento) | reproducir, ver transcripción | ver llamadas por rol | — (fase Voz) |
| Informes | `/app/informes` | gráficas (ver `dataviz`), DataTable | R agregados de `agent_runs`·`usage_records`·`goals` | **export CSV/PDF**, agrupar por, rango de fechas | ver informes (permiso) | — |

## 2. Agentes y configuración del agente

| Pantalla | Ruta objetivo | Entidades (R/W) | Acciones | Permiso | Notas |
|---|---|---|---|---|---|
| Mis agentes / Agente | `/app/agentes` | R/W `agents`·`agent_types`·`skills`·`agent_skills`·`business_rules`·`config_overrides` | activar/pausar, editar skills, techo de autonomía, **persona/voz** | configurar agentes (permiso) | voz: ver §3 |
| Conocimiento | `/app/conocimiento` | R/W `knowledge_chunks`(pgvector)·`knowledge_requests` + Storage | subir PDF/URL/FAQ, responder preguntas sin respuesta | subir/compartir KB | ingesta asíncrona (worker) |
| Memoria del negocio | `/app/memoria` | R/W `memories`·`entities`·`entity_links` | 🔒 aprobar/editar/**borrar** memoria, consolidar | gestionar memoria | extracción posterior |
| Reglas y aprobaciones | `/app/reglas` | R/W `business_rules`(motor de políticas) | fijar solo/aprobación/nunca por acción, por sede/agente | 🔒 techo de autonomía | — |
| Flujos automáticos | `/app/flujos` | R/W `workflows`·workflows programados (DBOS, ADR 0027) | activar flujo, techo de gasto por flujo | crear flujos | worker |
| Horarios | `/app/horarios` | R/W `locations.hours`·`agents.schedule` | editar horario, respuesta fuera de horario | configurar | — |
| Modo coach | `/app/coach` | R `coach_reviews`·`recommendations`·`learning_signals`·`proposals` · W aprobar propuesta → `agent_versions` | 🔒 aprobar cambio → eval → publicación gradual → vuelta atrás | gerencia/dueño | ciclo de aprendizaje |

## 3. Asistente (orquestador) y Voz — nuevos

| Pantalla | Ruta objetivo | Entidades (R/W) | Acciones | Seguridad |
|---|---|---|---|---|
| Asistente | `/app/asistente` | meta-agente: lee estado de plataforma, **ejecuta acciones** sobre `agents`/`business_rules`/`integrations`/`usage_limits`/tareas | configurar/operar/diagnosticar/enseñar por conversación | **limitado por rol**, propone+previsualiza, 🔒 confirmación + `audit_logs`. Catálogo de *tools* = contrato de backend (pendiente de especificar) |
| Voz del agente *(pantalla a diseñar)* | `/app/agentes` (pestaña) | R/W `voice_personas`·`voice_profiles`·`voice_rules`·`voice_samples`(audio, 🔒 consentimiento)·`voice_eval_runs` | elegir persona (sexo/tono/estilo), **subir audio para clonar**, gestionar muestras | consentimiento de la voz; proveedor agnóstico UE-first |

## 4. Red / franquicias y multisede

| Pantalla | Ruta objetivo | Entidades (R/W) | Acciones | Permiso |
|---|---|---|---|---|
| Red de franquicias | `/app/red` | R `networks`·`network_members`(`sharing`)·agregados · W plantillas/políticas de red | publicar plantilla/política bloqueada, invitar franquiciado, ver cumplimiento | **franquiciador**; RLS: nunca lee datos del franquiciado |
| Sedes (multisede) | `/app/ajustes/sedes` | R/W `regions`·`locations` + agregados | crear/editar sede, plantillas por sede | org_admin/region_manager |

## 5. Configuración (`/app/ajustes/*`) — 13 pantallas

| Pantalla | Entidades (R/W) | Acciones clave | Permiso |
|---|---|---|---|
| General | R/W `organizations`(contexto de negocio, marca, avisos) | guardar contexto (memoria de negocio inyectada), logo, avisos | org_admin |
| Mi perfil | R/W `users`·preferencias | avatar, idioma, zona horaria, avisos por canal | propio |
| Preferencias | R/W preferencias de usuario | modelo por defecto, tema, funciones | propio |
| Privacidad | R/W consentimientos, sesiones · 🔒 borrar | sesiones activas, **export/borrar datos (RGPD)** | propio/admin |
| Equipo | R/W `memberships`·invitaciones | **invitar miembro → aceptar** (email, caducidad), rol+plan | org_admin/location_manager |
| Roles | R/W `role_permissions` | permisos por rol (capacidades + alcance) | org_admin |
| Modelos de IA | R/W `org_model_settings`·`model_providers` · 🔒 `integration_secrets`(BYOK) | activar modelo, modo (incluido/BYOK/nube), tope de gasto, UE-only, voz | org_admin |
| Integraciones | R/W `integrations`·`integration_secrets`(OAuth) · plantillas WhatsApp | **conectar (OAuth)/reconectar**, acciones por integración, conjunto por defecto | crear/compartir integraciones |
| Sedes | ver §4 | | |
| Plan y consumo | R `subscriptions`·`usage_records`·`usage_limits` | ver consumo, 🔒 cambiar plan/límite, solicitud→aprobación | dueño |
| Facturación | R/W `billing_accounts`·`invoices`(Stripe) · 🔒 método de pago | **checkout/portal Stripe**, método de pago, facturas | dueño |
| Seguridad y acceso | R/W auth: MFA, **SSO SAML, SCIM, IP allowlist**, sesiones · 🔒 invalidación global | activar MFA/SSO, token SCIM (un solo uso) | org_admin |
| Registro de auditoría | R `audit_logs`(solo lectura) | filtrar, **exportar**, retención por plan | ver gobernanza |

## 6. Onboarding (alta) y móvil

- **Onboarding** `/app/onboarding`: wizard sector → conectar canales (OAuth) → elegir agentes → **revisar y activar** (checklist go-live). Escribe `organizations`·`agents`·`integrations`·contexto. Estados «conectando/error» por canal (a diseñar).
- **Móvil**: PWA responsive sobre las mismas rutas (no app aparte). Prioridad: Inicio, Conversaciones/Chats, Aprobaciones, Agenda (plan backend Paso 10).

## 7. Qué falta por pantalla (resumen accionable)

- **Estados** (vacío/carga/error/sin permiso): aplicar los componentes de `packages/ui` a cada pantalla al reconstruir.
- **Flujos aún sin pantalla** (diseñar): aceptar invitación, OAuth de canal + plantillas WhatsApp, alta/revisión de voz, detalle de aprobación, tomar el control, publicar versión de agente, ingesta de conocimiento, export/borrado RGPD, checkout Stripe, MFA/SSO/SCIM, API keys.
- **Catálogo de acciones del asistente**: definir *tools*, parámetros y cuáles son 🔒, con las reglas del ADR 0029 (sesión del usuario, catálogo cerrado, vista previa y confirmación).

Cada tabla nueva lleva **RLS + test pgTAP de aislamiento**; las acciones 🔒 pasan por el motor de políticas y quedan en `audit_logs`.
