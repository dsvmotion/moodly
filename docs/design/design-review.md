# Revisión del diseño del frontend: «Moodly AI-selection» (PDF de 84 páginas)

**Fecha:** 24/10/2026 · **Autor:** Grok Bot, para Diego · **Fuente:** `moodly-frontend.pdf` (84 capturas A4: páginas 1–30 son la web pública `moodly.ai` y páginas 31–84 la app `app.moodly.ai`) · **Repo comparado:** `dsvmotion/moodly`, rama `docs/roadmap-enterprise` (base `main` en `b21b052`).

> El diseño **no está acabado** (lo dice Diego) y esta revisión no lo juzga como si lo estuviera. Lo que aquí se marca como **«Sugerencia»** no aparece en el PDF; todo lo demás está sacado de las capturas.

## 1. Resumen en 8 líneas

1. El PDF describe una **plataforma de agentes de IA para pymes de servicios** con **4 agentes de serie** (más «agente a medida») que trabajan por WhatsApp, voz, Instagram, email y web, con **Inicio** y **Conversaciones** como bandeja central.
2. El centro del producto es el **control**: reglas, techo de autonomía (Automático / Con aprobación / Nunca), aprobaciones desde el móvil, prueba con comprobaciones del sector antes de publicar y versiones con vuelta atrás.
3. La **voz es de primer nivel**: registro de llamadas con grabación, resumen y transcripción, elección y clonación de voz, y llamadas y WhatsApp en el mismo contacto.
4. El agente **aprende con permiso**: memoria de negocio (confirmar o descartar), conocimiento con «preguntas sin respuesta», un coach (próximamente) y flujos «Cuando / Si / Haz».
5. Las capas **enterprise ya están dibujadas**: red de franquicias con herencia, proveedores de modelos (gestionado / BYOK / tu nube), residencia, topes de gasto, subencargados, RGPD por cliente, roles, SSO/SCIM, lista de IPs permitidas, auditoría inmutable y API.
6. Esto pone a Moodly **por encima de HeyDiga y GuruSup** en gobierno, y **por encima de Fresha y Treatwell** en canales y voz. Por profundidad vertical (8 sectores, 40+ tipos de negocio), por precio y por ser fácil de usar queda **más cerca de la pyme que Langdock**.
7. En el repo hoy está **el esqueleto** (auth, MFA, tenants con RLS, sedes, invitaciones, catálogo y configuración de agentes, objetivos, auditoría y un prototipo de 67 pantallas). **Faltan el runtime de agentes, los canales, la voz, el conocimiento, la memoria, el enrutador, la facturación y las integraciones**: los bloques A–E del roadmap.
8. Las inconsistencias principales (precios, residencia por defecto, qué pasa al llegar al tope, el aviso de IA en las llamadas, el idioma y el color) son fáciles de cerrar y se listan en la §5.

## 2. Inventario de pantallas

### 2.1 Web pública (moodly.ai)

| Pág. | Ruta | Contenido |
|---|---|---|
| 28 | `/` (home) | Hero «Agentes de IA que ya saben cómo funciona tu negocio. Tú decides qué aprueban»; logos de integraciones (+100); 6 beneficios; «ni chatbot genérico ni consultora»; dato del 62 % de llamadas; carrusel con los 4 agentes y el agente a medida; 8 verticales y 40+ tipos de negocio; «un agente que se adapta» (plug and play, aprobación, memoria, coach *próximamente*, integraciones oficiales + MCP, solo tareas delegables); 3 pasos; precios (Prueba 0 €, Negocio 49 €/agente, Cadenas a medida) |
| 1–2 | `/agentes` | Los 4 agentes de serie, qué hace cada uno y el agente a medida |
| 3–5 | `/sectores` | Verticales y subsectores |
| 6–8 | `/precios` | Planes y consumo (con variantes, ver la §5) |
| 9–11 | `/seguridad` | Controles, residencia, cifrado y certificaciones «en hoja de ruta» |
| 12–14 | `/integraciones` | Catálogo por categorías, MCP |
| 15–16 | `/implantacion` | Proceso de puesta en marcha |
| 17–18 | `/casos` | Casos de uso por sector |
| 19 | menús | Mega-menús de Agentes y Sectores |
| 20–23 | `/producto` | Recorrido por la plataforma |
| 24–25 | `/app-movil` | «Lo esencial, en tu bolsillo»: Inicio, Aprobar, Chats, Conversación, Agenda y Agentes (pausar). La configuración completa se queda en el escritorio. iPhone y Android, fecha por confirmar |
| 26 | `/contacto` | Formulario de demo; emails de ventas, soporte, privacidad y seguridad (*placeholders*) |
| 27 | `/enterprise` | «Agentes de IA para toda tu organización, bajo control»; el problema de la IA dispersa; 3 pilares (toda la cadena, se conecta con tu sistema, seguro por defecto); despliegue (nube compartida, dedicada, tu nube, tus servidores); gobierno (roles por sede, SSO+SCIM, auditoría, políticas heredadas, consumo, revisión de cambios de agentes); equipo de despliegue |
| 29 | `/modelos` | «Los mejores modelos de IA, sin atarte a ninguno»: modelo por tarea (automático o fijado), catálogo según la residencia, incluido / BYOK / tu nube |
| 30 | `/sobre-nosotros` | «La IA ya funciona; lo difícil es que llegue a una pyme»; valores; equipo (*placeholder*) |

### 2.2 App (app.moodly.ai)

| Pág. | Pantalla | Grupo |
|---|---|---|
| 31 | Inicio: KPIs, pendientes y actividad de los agentes | Trabajo |
| 32 | Conversaciones: bandeja omnicanal | Trabajo |
| 33 | Tomar el control de una conversación (traspaso a una persona) | Trabajo |
| 34 | Aprobaciones | Trabajo |
| 35 | Revisar una aprobación (vista previa de la acción) | Trabajo |
| 36 | Agenda | Negocio |
| 37 | Horarios | Negocio |
| 38 | Clientes | Negocio |
| 39 | Leads | Negocio |
| 40 | Llamadas: grabación, resumen y transcripción | Negocio |
| 41 | Facturas | Negocio |
| 42 | Informes | Negocio |
| 43 | Red: franquicia con herencia y solo datos agregados | Negocio |
| 44 | Ficha del agente | Agentes |
| 45 | Agente nuevo: asistente de creación (solo se ve el paso 1) | Agentes |
| 46 | Probar: *sandbox* con comprobaciones del sector | Agentes |
| 47 | Publicar: versiones y vuelta atrás | Agentes |
| 48 | Reglas | Agentes |
| 49 | Autonomía: Automático / Con aprobación / Nunca, con las acciones sensibles restringidas | Agentes |
| 50 | Flujos: Cuando / Si / Haz | Agentes |
| 51 | Voz: elegir y clonar la voz | Agentes |
| 52 | Memoria: aprendizajes que se confirman o se descartan | Agentes |
| 53 | Conocimiento, con las preguntas sin respuesta | Agentes |
| 54 | Ingesta de fuentes | Agentes |
| 55 | Coach (próximamente), con comparativa frente a la competencia | Agentes |
| 56 | Asistente (copiloto que configura la plataforma dentro de tu rol y de tu techo de autonomía) | Transversal |
| 57 | Onboarding: 9 sectores y sus subsectores (solo se ve el paso 1) | Alta |
| 58 | Checkout | Alta |
| 59 | Aceptar una invitación | Alta |
| 60 | Conectar canales | Alta |
| 61 | Modelos → Proveedores | Modelos |
| 62 | Modelos → Residencia, con cadena de respaldo que termina en una persona | Modelos |
| 63 | Modelos → Topes de gasto y cortacircuitos | Modelos |
| 64 | Modelos → Subencargados y DPA | Modelos |
| 65 | Modelos → BYOK | Modelos |
| 66 | Modelos → Tu nube | Modelos |
| 67 | Configuración → Modelos (resumen) | Modelos |
| 68 | Privacidad del cliente final: exportar y borrar (RGPD) | Ajustes |
| 69 | Configuración general (incluye «El agente se presenta como asistente») | Ajustes |
| 70 | Perfil | Ajustes |
| 71 | Preferencias | Ajustes |
| 72 | Configuración → Privacidad | Ajustes |
| 73 | Equipo | Ajustes |
| 74 | Roles: matriz de permisos | Ajustes |
| 75 | Sedes | Ajustes |
| 76 | Plan | Ajustes |
| 77 | Facturación | Ajustes |
| 78 | Integraciones: 5 conectadas y 19 disponibles; plantillas de WhatsApp con su estado en Meta | Ajustes |
| 79 | Ficha de integración: permisos granulares; si falla, «proponer en vez de hacer» | Ajustes |
| 80 | API: claves con permisos acotados | Ajustes |
| 81 | Seguridad | Ajustes |
| 82 | 2FA | Ajustes |
| 83 | SSO / SCIM / lista de IPs permitidas | Ajustes |
| 84 | Auditoría inmutable, 365 días | Ajustes |

## 3. Qué existe hoy y qué hay que construir

Leyenda: 🟢 existe en `main` · 🟣 existe solo en el prototipo (`apps/site/.../plataforma`, #27, 67 pantallas sin datos) · ⚪ por construir. Bloque = ID del roadmap.

**Tablas actuales:** `organizations`, `regions`, `locations`, `users`, `memberships`, `invitations`, `platform_staff`, `support_grants`, `audit_logs`, `agent_types`, `agents`, `skills`, `agent_skills`, `config_overrides`, `config_snapshots`, `goals`, `goal_progress`, más `private.login_failures` y `private.server_keys`.

**Rutas actuales de `apps/web`:** `/app`, `actividad`, `agentes`, `agentes/[tipo]`, `aprobaciones`, `clientes`, `coach`, `conocimiento`, `conversaciones`, `informes`, `memoria`, `objetivos`, `tareas`, `invitacion`, `ajustes/{general,perfil,preferencias,equipo,sedes,seguridad,[seccion]}`, `/login`, `/login/mfa`.

| Módulo del diseño (págs.) | Hoy | Qué hay que construir (backend · datos · agentes) | Bloque |
|---|---|---|---|
| Inicio (31) | 🟢 ruta `/app` sin datos reales | Vista `work_items` (ADR 0040), KPIs desde `agent_runs` y `usage_records` | A13 |
| Conversaciones y tomar el control (32–33) | 🟢 ruta vacía | `contacts`, `conversations`, `messages` particionadas, canales, traspaso a una persona | A5, A11, A13 |
| Aprobaciones y revisar (34–35) | 🟢 ruta vacía | `approvals` con `input_hash`, aal2 para lo financiero, vista previa exacta | A4, A13 |
| Agenda y horarios (36–37) | ⚪ | `BookingProvider`, Google Calendar, skill `book_appointment`, horarios por sede | B1 |
| Clientes (38) | 🟢 ruta vacía | `contacts` y `contact_identities` unificados por canal | A5 |
| Leads (39) | ⚪ | Agente `sales`, `CrmProvider` | B7, B14 |
| Llamadas (40) | ⚪ | `VoiceGateway`, telefonía, transcripción, grabación opcional, minutos | A18, B11 |
| Facturas (41) | ⚪ | `PaymentProvider` y conector de facturación/ERP (Holded…) | B13, C9 |
| Informes (42) | 🟢 ruta vacía | Analítica por sede | C4 |
| Red / franquicia (43) | 🟢 `locations` y `regions`; 🟣 | Herencia red → empresa → sede, `InheritanceBadge`, vistas solo agregadas | C2, C4 |
| Ficha del agente y agente nuevo (44–45) | 🟢 `agent_types`, `agents`, `agent_skills`, `config_*` | Agentes propios (ADR 0030 fase 3) | A10, D4 |
| Probar y publicar (46–47) | ⚪ | Arnés de evals como puerta de activación, `agent_versions`, vuelta atrás | A7, E4 (subir la parte básica a B) |
| Reglas y autonomía (48–49) | 🟢 parte en `config_overrides` | Motor de políticas: autonomía = mín(config, techo) | A8 |
| Flujos (50) | ⚪ | Eventos de dominio, DBOS, skills `composed` | A3, C5, E4 |
| Voz: elegir y clonar (51) | ⚪ | Proveedor TTS en la UE, consentimiento para clonar | B11, ADR 0045 |
| Memoria (52) | 🟢 ruta vacía | `memories` con procedencia (ADR 0024), confirmar o descartar | B2 |
| Conocimiento e ingesta (53–54) | 🟢 ruta vacía | `knowledge_sources` y `knowledge_chunks`, `knowledge_request` | A9 |
| Coach (55) | 🟢 ruta vacía | Bucle de aprendizaje y `proposals` | B4, C7 |
| Asistente (56) | ⚪ | ADR 0029: primero solo lectura, después cambios confirmados | B9, D9 |
| Onboarding, checkout, aceptar, conectar (57–60) | 🟢 invitaciones; resto ⚪ | Plantillas por sector, Stripe, alta de canales | B6, B5, A11 |
| Modelos: proveedores, residencia, topes, subencargados, BYOK, tu nube (61–67) | ⚪ | Enrutador, `org_model_settings`, KMS, `usage_limits`, lista de subencargados generada | A6, A12, B5, D3, D8, E2 |
| Privacidad RGPD del cliente (68, 72) | ⚪ | Exportar y borrar en cascada por contacto | Nuevo, en B (sugerencia: subirlo a A17) |
| General, perfil, preferencias (69–71) | 🟢 | Idioma (`en` por defecto), avisos | B8 |
| Equipo, roles, sedes (73–75) | 🟢 equipo, sedes y roles fijos | Roles configurables | C1 |
| Plan y facturación (76–77) | ⚪ | Planes como datos, Stripe, consumo medido | B5, ADR 0039 |
| Integraciones y ficha (78–79) | ⚪ | `integration_secrets`, MCP, permisos por herramienta, degradar a «proponer» | A12, D5, ADR 0036 |
| Plantillas de WhatsApp (78) | ⚪ | Sincronizar el estado de las plantillas con Meta | A11 |
| API (80) | ⚪ | Claves con permisos acotados, webhooks | D7 |
| Seguridad y 2FA (81–82) | 🟢 MFA TOTP con aal2 | — | hecho |
| SSO / SCIM / IPs (83) | ⚪ | WorkOS, `accounts` | D1 |
| Auditoría (84) | 🟢 `audit_logs` de solo inserción | Pantalla, exportar y retención por plan | D6 |
| App móvil (24–25) | 🟢 PWA (#26) | Aprobar, chats y pausar agentes sobre los datos reales; notificaciones *push* | A13 + nuevo |
| Web pública (1–30) | 🟢 `apps/site` (17 páginas, 4 idiomas) | Alinear el texto con el PDF: `/modelos`, `/enterprise`, `/app-movil` | Marketing |

## 4. Huecos y pantallas que faltan

**Partes que el PDF deja a medias:** la pestaña de inventario; los pasos 2–4 del onboarding y del asistente de agente nuevo; el pago del checkout.

**Sugerencias** (no salen en el PDF):
- **Aviso de IA y consentimiento**: aviso explícito al inicio de cada llamada y consentimiento para grabar (art. 50 de la Ley de IA, en vigor desde el 2/8/2026), y una pantalla de consentimientos además del distintivo de WhatsApp.
- **WhatsApp**: gestión de *opt-in* y, más adelante, una pantalla de campañas.
- **Conectores de reservas**: Booksy, Treatwell, Fresha, Koibox y Mindbody no aparecen en el catálogo; Doctoralia solo «vía partner». Son clave para estética y salud.
- **Números de voz**: alta, portabilidad y desvío del número del negocio; voz saliente con consentimiento.
- **Consumo**: desglose por agente, canal y sede, que justifique la factura.
- **Avisos**: un centro de notificaciones (hoy están repartidos en tres pantallas) y una página de estado e incidencias.
- **Historial de evals** por versión de agente, que es la prueba de calidad que pedirá enterprise.
- **Documentación pública** de API y webhooks.
- **Back-office `/ops`** del equipo de Moodly (ADR 0021).
- **Estados** vacíos, de error y sin permiso: el prototipo #27 ya los tiene; trasladarlos al diseño nuevo.
- **Selector de idioma** en la interfaz.

## 5. Notas de UX y coherencia

1. **Precios**: hay al menos cinco variantes.
   - Home: 49 €/agente.
   - Checkout: 49 €/agente + 19 € por sede extra + 15 € de voz.
   - Plan: «Mantenimiento 70 €».
   - Facturación: 147 € fijo + uso, 750 conversaciones y 0,10 €.
   - `/precios`: 29 € por sede y 0,20 €/min.

   Coherente con el roadmap: son **hipótesis**. Sugerencia: leerlas de una única tabla de planes en datos y marcarlas como «precio de lanzamiento».
2. **Residencia por defecto**: en las págs. 61–62 aparece «Sin restricción (Recomendado)», pero en la pág. 67 «Solo UE» está activado, y el roadmap la trata como cimiento no negociable. Sugerencia: **UE por defecto**, y salir de la UE solo con una decisión explícita del admin.
3. **Al llegar al tope** hay tres comportamientos distintos: «cortamos» (pág. 63), «pasa al equipo» (págs. 56 y 67) y tres opciones (pág. 76). Sugerencia: aviso al 80 % y paso a una persona al 100 %, sin cortar a mitad de una conversación (como en el roadmap, ADR 0039).
4. **2FA**: sale activado en las págs. 69–70 y desactivado en la 81. Hay que usar el mismo estado.
5. **Duplicados**:
   - Conocimiento (pág. 53) e Ingesta (pág. 54) pueden ser una sola pantalla con pestañas.
   - Los avisos aparecen en General, Perfil y Preferencias.
   - Configuración → Privacidad (pág. 72) se solapa con Perfil.
6. **Aviso de IA**: el saludo «Soy el asistente de la clínica» no dice que es una IA. El interruptor de la pág. 69 debería quedar **fijo en activado** para la voz y el primer mensaje.
7. **Datos de relleno**: números como 42, 427 y 4271, y nombres de modelos que parecen inventados.
8. **Idioma**: la maqueta está solo en español; Diego quiere el inglés por defecto (ADR propuesto 0041). Las claves ya están en es/en/fr/de.
9. **Color**: las tarjetas de KPI de colores se alejan del estilo casi monocromo. Sugerencia: grises, con un solo color de acento por organización (ADR 0044).
10. **Web pública**: quedan marcas «[por confirmar]» en el alojamiento en la UE y en las certificaciones, e ISO 27001 y SOC 2 figuran «en hoja de ruta». No se debe publicar nada que no esté verificado.
11. **Unificación**: el diseño ya agrupa Inicio, Conversaciones y Aprobaciones, en línea con la bandeja única que pide Diego. Para que sea de verdad un solo sitio, faltaría que Tareas y Peticiones de conocimiento entren en esa bandeja.

## 6. Posicionamiento competitivo

| | HeyDiga | GuruSup | Fresha / Treatwell (IA) | Langdock | **Moodly (según el diseño)** |
|---|---|---|---|---|---|
| Foco | Recepcionista de voz para pymes | Agentes de atención y ventas por WhatsApp y omnicanal | Software de reservas con funciones de IA | Espacio de IA para empleados de empresa | Agentes que hacen el trabajo de cara al cliente, para pymes de servicios y cadenas |
| Canales | Voz | WhatsApp, web, email | Su *marketplace* y la app | Chat interno | Voz, WhatsApp, IG, email, web y app móvil |
| Control y aprobaciones | Básico | Medio | Bajo | Alto (empresa) | **Alto**: techo de autonomía, aprobación atada a la acción, evals antes de publicar, versiones |
| Multisede y herencia | No | Limitado | Sí (dentro de su software) | Por espacios | **Red → empresa → sede, con herencia** |
| Modelos, BYOK y residencia | No visible | No visible | No | **Sí** | **Sí**: gestionado, BYOK, tu nube y residencia |
| Dependencia | — | — | Atado a su agenda | — | Neutral: se conecta a la agenda del cliente |

**Dónde nos coloca:** el **«punto medio»** que dice la home. Tiene la **facilidad y el foco vertical de HeyDiga y GuruSup**, más voz y WhatsApp con una sola memoria, y el **gobierno de Langdock** (modelos, residencia, SSO, auditoría), aplicado al trabajo de atención y no al chat interno. Frente a Fresha y Treatwell, Moodly **no compite como agenda**: se apoya en ella, y por eso el conector de reservas es crítico.

**Riesgos del posicionamiento:**
- Prometer en la web cosas que el backend aún no tiene (Modelos, SSO, tu nube).
- No tener conectores de los sistemas de reservas del sector.
- Que la amplitud del diseño (84 pantallas) disperse el piloto. Sugerencia: para el piloto basta con el recorrido «llega un mensaje o una llamada → el agente propone → apruebas desde el móvil → cita en la agenda».

## 7. Capturas guardadas

`shot-inicio.jpg` (pág. 31), `shot-conversaciones.jpg` (pág. 32), `shot-llamadas.jpg` (pág. 40), `shot-red.jpg` (pág. 43), `shot-autonomia.jpg` (pág. 49), `shot-residencia.jpg` (pág. 62), todas en `/workspace/b2b/design/` (fuera del repo).
