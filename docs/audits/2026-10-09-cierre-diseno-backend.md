# Auditoría de cierre: diseño → backend

Fecha: 2026-10-09 · Repo: `github.com/dsvmotion/moodly` · Rama: `feat/site-landings` (PR #17).
Alcance: diseño web y de plataforma, arquitectura front, infraestructura, inconsistencias, seguridad y modelo de datos — para **cerrar la fase de diseño y empezar el backend con una referencia sólida**.

Consolida y profundiza sobre las auditorías previas (no las repite):
- `docs/audits/2026-10-07-auditoria-plataforma.md` (brechas de backend/datos, plan en 13 pasos).
- `docs/audits/2026-10-08-auditoria-diseno.md` (calidad y lock del diseño).
- `docs/design/edge-y-postura-enterprise.md` (postura enterprise + edge: voz, orquestador).

El **artifact «Moodly Landing Pages»** (v69) es ahora el espejo visual fiel del localhost (todas las pantallas Web, App y móvil). Este documento es el espejo **de decisiones** que falta.

---

## 1. Veredicto

El diseño está **a nivel y casi listo para fijarse**, pero como *referencia para construir el backend* le faltan cuatro cosas que no son pantallas nuevas sino **contratos**:

1. **El puente prototipo → `apps/web`**: hoy son dos frontends distintos con rutas y nombres que no cuadran. Sin un mapa 1:1, cada pantalla se reconstruye «a ojo».
2. **El contrato de datos por pantalla**: el prototipo enseña la UI, no qué entidad/campos lee y escribe cada una. Es lo que convierte una captura en una tarea de backend.
3. **Flujos que aún no son pantalla** (invitaciones, OAuth de canales, alta de voz, export/borrado RGPD, checkout Stripe, publicación de versión de agente…).
4. **Resolver las inconsistencias canónicas** (claves de agente, nombres de ruta, idioma/tema del producto) antes de que se propaguen al esquema.

Cerrando §9 (definición de hecho), se puede pasar a backend sin reabrir diseño.

---

## 2. La verdad arquitectónica: dos frontends

| | `apps/site` (prototipo) | `apps/web` (producto real) |
|---|---|---|
| Qué es | Web pública + **prototipo navegable** de la plataforma | La app con login y datos reales por RLS |
| Stack | JSX con **estilos en línea**, datos fijos, `data-demo` | TypeScript + **`packages/ui`** + next-intl + Supabase |
| Pantallas de plataforma | ~30 (operación + agentes + 13 de configuración) | **15 rutas, 12 vacías** (`SectionEmpty`) |
| Idiomas | web 4 (es/en/fr/de); **plataforma solo ES** | next-intl (es/en) |
| Tema | **solo claro** | claro + oscuro (tokens) |

**Consecuencia:** el prototipo es la **especificación visual**; el producto se **reconstruye** en `apps/web` sobre `packages/ui` y datos reales. No se «conecta» el prototipo.

### 2.1 Desfase de rutas (inconsistencia a cerrar ya)
Los nombres no coinciden, y eso confunde el mapeo:

| Prototipo (`/plataforma/…`) | `apps/web` (`/app/…`) | Acción |
|---|---|---|
| `conversaciones` | `inbox` | Unificar el nombre (recomiendo `conversaciones`/`inbox` — **elegir uno**) |
| `clientes` | `records/contacts` | ¿«Clientes» (negocio) vs «Contactos» (genérico)? Decidir vocabulario de producto |
| `leads` | `records/contacts` + `deals`? | Separar Leads de Clientes o unir |
| `agente` | *(no existe)* | Crear |
| `aprobaciones` | `approvals` | Alinear |
| `configuracion/*` (13) | `settings/organization` (1) | Falta casi toda la configuración en `apps/web` |
| `asistente`, `red`, `coach`, `memoria`, `reglas`, `flujos`, `horarios`, `conocimiento`, `llamadas`, `informes` | *(vacías o inexistentes)* | Reconstruir |

**Entregable:** una **tabla de mapeo pantalla→ruta `apps/web`→componentes `packages/ui`→entidades** (una fila por pantalla). Es el primer documento de la fase backend.

---

## 3. Lo que falta en el DISEÑO como referencia para el backend

### 3.1 Contrato de datos por pantalla (lo más importante)
El prototipo no dice qué lee/escribe cada pantalla. Para cada una hace falta: **entidad(es)**, **campos mostrados**, **acciones** (y qué tabla tocan), **filtros/orden**, **tiempo real sí/no**, **permiso por rol**. La auditoría de backend §3.6 esbozó el mapeo pantalla→tabla; hay que **completarlo campo a campo**. Sin esto, el backend adivina.

### 3.2 Estados por pantalla
Los componentes existen (`EmptyState`, `Skeleton`, `ErrorState`, `ConfirmDialog`, `Toast` en `packages/ui`) pero **no están aplicados** en el prototipo. Falta, por pantalla: vacío / cargando / error+reintentar / sin permiso. Es diseño, barato ahora.

### 3.3 Flujos que aún no son pantalla (hay que diseñarlos)
- **Invitar miembro → aceptar** (email, caducidad, alta de `public.users`). STATUS 3b.
- **Conectar canal (OAuth)**: WhatsApp/Gmail/Calendar/CRM — pantallas de conexión, error y reconexión; envío/aprobación de **plantillas de WhatsApp** (Meta).
- **Alta de voz del agente**: persona de voz (sexo, tono, estilo), **subir audios propios para clonar**, consentimiento y gestión de muestras. Hoy la voz solo existe como fila de catálogo.
- **Detalle de aprobación / revisar antes de enviar** (modal): hoy hay lista, falta el «revisar».
- **Tomar el control de una conversación** y devolverla al agente.
- **Publicar un cambio de agente** (Modo coach): propuesta → eval → publicación gradual → vuelta atrás.
- **Conocimiento**: ingesta (subir PDF/URL/FAQ), estado de indexado, preguntas sin respuesta → responder.
- **Memoria**: revisar, aprobar, consolidar y **borrar** memorias.
- **RGPD**: exportar y borrar datos (del negocio y del cliente final).
- **Stripe**: checkout, prueba de 14 días, portal de cliente, aviso al 80 %, paso al equipo al 100 %.
- **MFA / SSO / SCIM / IP allowlist**: pantallas de configuración (Seguridad ya existe parcial).
- **API keys**: crear/revocar, caducidad, tope de gasto (hoy «Próximamente»).
- **Orquestador — catálogo de acciones**: qué *tools* puede ejecutar el asistente (y cuáles son sensibles). Es a la vez diseño y contrato de backend.

### 3.4 Pantallas presentes pero incompletas como spec
- **Onboarding**: 4 pasos + checklist; falta el estado «conectando/err» real por canal y el paso de **contexto de negocio** como tal.
- **Informes**: faltan export CSV, agrupar por, rango de fechas (hoy solo «Descargar PDF»).
- **Multisede/Red**: faltan los datos agregados reales y el modelo de compartición del franquiciado.

---

## 4. Inconsistencias concretas (con corrección)

| # | Inconsistencia | Dónde | Corrección |
|---|---|---|---|
| 1 | **Claves de agente** no canónicas: prototipo usa `recepcion/atencion/comercial/administracion`; el MANUAL/memoria dice `customer/sales/operations/admin` | `verticals.js` vs MANUAL | Fijar **una** clave estable por `agent_type` + nombre por idioma. Propuesta: `reception`, `customer`, `sales`, `admin` (o mantener los 4 ES). Decidir antes de `agent_types`. |
| 2 | **Nombres de ruta** prototipo ≠ `apps/web` | §2.1 | Unificar el vocabulario de producto (una tabla). |
| 3 | **Idioma del producto**: plataforma prototipo solo ES; `apps/web` es/en | — | Decidir: ¿la app sale es+en desde el día 1? Afecta a next-intl y a los textos. |
| 4 | **Tema**: prototipo solo claro; `apps/web` claro+oscuro | — | El producto real sale con ambos (ya resuelto por tokens); el prototipo no se toca. |
| 5 | **Placeholders**: `[Ciudad]`, `[Foto del restaurante]` en Casos; `[por confirmar]` en Seguridad/Enterprise; legales en borrador | `casos/`, `seguridad/`, legales | **Intencionales** (no hay casos reales ni datos confirmados). Marcar como «contenido pendiente», no como error. |
| 6 | **Precios** provisionales (49 €/agente, etc.) | `modelo-precios.md`, `/precios` | Cerrar con negocio antes de publicar y antes de Stripe. |
| 7 | **Tres fuentes de tokens** históricas (packages/ui, apps/site, canvas) | — | Ya hay fuente única en `packages/ui`; `apps/site` mantiene hexes en línea (prototipo desechable, no bloquea). |

---

## 5. Arquitectura e infraestructura de plataforma

Consolidado (detalle en auditoría backend §5). **Ningún entorno alojado existe todavía.**

| Pieza | Propuesta | Estado / decisión |
|---|---|---|
| Web + App | Vercel (UE, funciones Node) | Cuenta activa; falta proyecto + env por entorno |
| BD/Auth/Storage/Realtime | Supabase UE (Frankfurt), staging + prod separados, con **PITR** | Cuenta activa; falta proyecto alojado + config de Auth de producción |
| Worker always-on | Fly.io / Railway / Hetzner (cola pg-boss, agentes, webhooks, cron) | **Decidir proveedor** |
| Email | Resend (dominio verificado SPF/DKIM/DMARC) | Crear |
| Pagos | Stripe (test+live, Tax o Holded para IVA ES) | Crear |
| Secretos de cliente (BYOK, OAuth, voz) | **Supabase Vault vs KMS** | **Decisión abierta** |
| LLM | Enrutador multi-proveedor (UE-first + fallback), BYOK, por agente | **Proveedores a decidir**; catálogo ya diseñado |
| Voz (TTS + clonación) | Adaptador agnóstico, UE-first; Cartesia / ElevenLabs | **Proveedor a decidir** (test de latencia UE) |
| WhatsApp | BSP o Cloud API de Meta | **Decisión abierta** |
| Observabilidad | Sentry UE + Langfuse UE + OpenTelemetry/pino | Crear |
| Repo | GitHub Team (proteger `main`) | **Bloqueado** (plan Free no permite branch protection) |

**Principio a respetar:** nada crítico debe depender de algo que solo exista en Supabase Cloud sin alternativa autoalojable (para nube dedicada / on-prem enterprise).

---

## 6. Modelo de datos: lo que hay y lo que falta

Hoy: **2 migraciones, 5 tablas** (`organizations`, `regions`, `locations`, `users`, `memberships`) con RLS forzada y revocación de sesión. El MANUAL proyecta ~50. Capas que faltan (con sus dueños de diseño ya hechos):

- **Agentes**: `agent_types`, `agent_templates` (8 verticales × 47 subsectores, versionadas), `agents` (estado draft/testing/live/paused), `skills`, `agent_skills`, `business_rules`, `config_overrides`, `config_snapshots` (herencia red→org→región→local→agente).
- **Capa de Voz** (nueva, edge §5): `voice_profiles` (voz escrita), `voice_personas` (voz hablada: proveedor, voz/clon, ajustes), `voice_rules`/`lexicon`, `voice_samples` (texto + **audio con consentimiento**), `voice_eval_runs`.
- **Orquestador**: meta-agente con **catálogo de acciones** sobre la plataforma, limitado por rol, con confirmación de lo sensible y `audit_logs`. Reutiliza el motor de políticas.
- **Operación**: `contacts`, `contact_identities`, `conversations`, `messages`, `approvals`, `appointments` (espejo), `deals`, `invoices_mirror`, `calls`, `tasks`, `notes`, `saved_views`, `favorites`.
- **Conocimiento/memoria**: `knowledge_chunks` (pgvector), `knowledge_requests`, `memories`, `entities`, `entity_links`.
- **Aprendizaje**: `agent_versions`, `learning_signals`, `proposals`, `eval_runs`, `coach_reviews`, `recommendations`.
- **Redes/franquicias**: `networks`, `network_members` (con `sharing`), herencia bloqueada.
- **Permisos finos**: `role_permissions` (capacidades por rol: ver/aprobar facturas, cambiar reglas, gestionar equipo) además del alcance.
- **Facturación**: `billing_accounts`, `subscriptions`, `usage_records`, `usage_limits`, `implementation_quotes`, `invoices`.
- **Plataforma/gobierno**: `audit_logs` (solo inserción), `integrations`, `integration_secrets`, `inbound_events`, `domain_events`, `api_keys`, `webhook_endpoints`, `data_requests`, `model_providers`, `org_model_settings`.

Cada tabla nueva: **RLS + test pgTAP de aislamiento**; nada de escribir en tablas de tenant desde `SECURITY DEFINER` sin revisión humana.

---

## 7. Seguridad (para el backend)

Checklist que el diseño ya contempla y el backend debe implementar:
- **Aislamiento por tenant (RLS)** en cada tabla + test negativo; `session_is_active()` como primera condición.
- **El orquestador y los agentes ACTÚAN** → techo de autonomía, aprobación de lo sensible, y **defensa ante inyección de instrucciones** (lo entrante del cliente siempre es *dato*, nunca orden).
- **Secretos de cliente** (BYOK, tokens OAuth, muestras de voz) en bóveda cifrada, nunca legibles desde el navegador.
- **Enmascarado de PII** antes de cada llamada al LLM; residencia **UE-first** con paso a humano si no hay modelo UE (nunca cruzar región en silencio).
- **RGPD**: export/borrado (`data_requests`), retención por tipo, consentimientos (incl. **consentimiento de la voz clonada**).
- **Auth de producción**: límites de intentos, captcha, MFA, política de contraseña, `jwt_expiry` (STATUS 3c-2).
- **Auditoría** inmutable y consultable; **separación franquiciador↔franquiciado** probada con pgTAP.
- **Identidad del agente de CI** separada (no la cuenta de producto) para no poder auto-etiquetar `revisado-humano` (STATUS 3e).
- Rate limits por organización/endpoint; backups + prueba de restauración (PITR).

---

## 8. Detalle, optimización, rendimiento, accesibilidad, i18n

- **Rendimiento (`apps/web`)**: RSC/SSR, carga de datos por servidor cerca de RLS, caché, paginación/scroll infinito en listas grandes (`DataTable` ya virtualiza), optimización de imágenes (logos/capturas), presupuesto de bundle.
- **Accesibilidad**: `apps/web` ya pasa axe (tarea 4); mantener esa barra — controles `<button>` reales, `:focus-visible`, contraste AA de las tarjetas de agente. **No** portar el patrón del prototipo (`<span>`/`<a href="#">`).
- **i18n**: decidir si el producto sale es+en; textos de `DataTable`/UI vía next-intl (los componentes de `packages/ui` no conocen i18n, se les pasan los textos).
- **Tiempo real**: bandeja, conversaciones y aprobaciones vía Supabase Realtime; verificar que una sesión cerrada deja de recibir eventos (STATUS 3d).
- **Detalles de UI a pulir** (no bloquean): números de demo repetidos (42/427/4.271) en pantallas de primera impresión; export de datos en Informes; estados «conectando» reales en integraciones y onboarding.

---

## 9. Definición de «diseño cerrado» + plan para pasar a backend

**Se cierra el diseño cuando:**
- [ ] Existe la **tabla de mapeo** pantalla→ruta `apps/web`→componentes→entidades (§2) y las **rutas/vocabulario están unificados** (§4.2).
- [ ] Hay **contrato de datos por pantalla** (entidades, campos, acciones, permisos, tiempo real) (§3.1).
- [ ] Están diseñados los **flujos que faltan** (§3.3), al menos los del piloto: invitaciones, conexión de canal, aprobación/revisión, alta de voz, contexto de negocio.
- [ ] **Estados** (vacío/carga/error/sin permiso) por pantalla (§3.2).
- [ ] Resueltas las **inconsistencias canónicas** §4.1–4.3 (claves de agente, rutas, idioma/tema).
- [ ] **Catálogo de acciones del orquestador** especificado (qué puede hacer y qué es sensible).
- [ ] Decididas las **variables de negocio/infra** bloqueantes: proveedor LLM + embeddings, voz, WhatsApp BSP, secretos (Vault/KMS), worker, vertical piloto, GitHub Team, precios.

**Orden recomendado para arrancar backend** (encaja con el plan de la auditoría de plataforma §7):
1. **Decisiones §9 + cuentas alojadas** (producto) y **tabla de mapeo + contratos de datos** (yo puedo redactarla desde el prototipo).
2. **Entornos staging** (Supabase UE, Vercel, Resend, Sentry) + Auth de producción.
3. **Identidad completa**: invitaciones, perfil/preferencias, MFA, `role_permissions`, `platform_staff`, `audit_logs`.
4. **Agentes + configuración heredada + capa de Voz + orquestador** (catálogo, herencia, versiones).
5. **Worker/cola/eventos**; **enrutador de modelos** (+voz) con medición de coste.
6. **Primer agente real** (webchat+WhatsApp del vertical piloto) con aprobaciones, reconstruyendo sus pantallas en `apps/web`.
7. Conocimiento/memoria → integraciones → facturación → resto de pantallas → aprendizaje/coach → enterprise → voz.

Todo paso con RLS + pgTAP + evidencia, y revisión humana en zonas sensibles (AGENTS.md).

---

## 10. Qué puedo hacer yo ya (sin backend), para cerrar diseño

- Redactar la **tabla de mapeo** pantalla→`apps/web`→componentes→entidades y el **contrato de datos por pantalla** (desde el prototipo).
- Diseñar los **flujos que faltan** (§3.3) y los **estados** (§3.2) en el prototipo.
- Resolver las **inconsistencias** §4 (unificar claves de agente y vocabulario de ruta en el prototipo).
- Especificar el **catálogo de acciones del orquestador**.

Lo que necesita **producto**: las decisiones de negocio/infra de §9 y las cuentas alojadas (no invento credenciales ni proveedores).
