# Langdock · Configuración — diseño y arquitectura (extracción para Moodly)

> Revisión exhaustiva del área de **Configuración** de Langdock (sesión real, solo lectura), para fundamentar la arquitectura de la plataforma y el backend de Moodly.
> Fecha: 2026-10-07. Workspace observado: «Moodly» (cuenta de prueba, «Prueba caducada»).
> **Método:** recorrido de cada ruta de `/settings/*`, con lectura de cada pantalla, sus campos, opciones y textos. No se cambió ninguna configuración.
> Esto documenta el **patrón de referencia** (IA, entidades, permisos), no se copia su identidad visual.

## Mapa de rutas (IA de Configuración)

El área de ajustes es una pantalla a pantalla completa con su propia barra lateral, buscador («Buscar en ajustes») y 4 grupos. Rutas reales observadas:

### Personal — `/settings/account/*`
| Opción | Ruta |
| --- | --- |
| Perfil | `/settings/account/profile` |
| Preferencias | `/settings/account/preferences` |
| Uso y gasto | `/settings/account/usage` |
| Privacidad | `/settings/account/privacy` |
| Primeros pasos | `/settings/account/getting-started` |

### Gestión de usuarios — `/settings/workspace/user-management/*`
| Opción | Ruta |
| --- | --- |
| Miembros | `/settings/workspace/user-management/members` |
| Grupos | `/settings/workspace/user-management/groups` |
| Roles | `/settings/workspace/user-management/roles` |
| Uso y gasto | `/settings/workspace/usage` |

### Espacio de trabajo — `/settings/workspace/*`
| Opción | Ruta |
| --- | --- |
| Resumen | `/settings/workspace/overview` |
| General | `/settings/workspace/general` |
| Modelos | `/settings/workspace/models` |
| Analítica | `/settings/workspace/analytics` |
| Integraciones | `/settings/workspace/products/integrations` |
| Seguridad | `/settings/workspace/security` |
| Facturación | `/settings/workspace/billing` |
| Archivos | `/settings/workspace/library` |
| Personalización | `/settings/workspace/customizations` |
| Incorporación de usuarios | `/settings/workspace/onboarding` |

### Productos — `/settings/workspace/products/*`
| Opción | Ruta |
| --- | --- |
| Chat | `/settings/workspace/products/chat` |
| Agentes | `/settings/workspace/products/agents` |
| Skills & Workflows | `/settings/workspace/products/skills` (+ `/workflows-2`) |
| API, Complementos, Deep Research, Programado, Gobernanza, Conocimiento de la empresa | (pendiente de confirmar ruta — ver secciones) |

---

## 1. Personal (`/settings/account/*`) — ajustes del usuario, no del workspace

### 1.1 Perfil — `/settings/account/profile`
«Gestiona tu perfil».
- **Imagen de perfil**: subida de archivo. Tipos: jpeg, jpg, png, heif, svg+xml, webp, gif, tiff, bmp, heic. Botón «Reemplazar».
- **Nombre completo**: campo de texto (placeholder «Juan Pérez»).
- **Cambiar correo**: no es autoservicio → «Contacta con nosotros» (cambio de email gated por soporte).
- **Contraseña**: «Añadir contraseña» (cuenta creada por SSO; la contraseña es opcional/añadible después).

**Para Moodly:** entidad `user` = {avatar, nombre, email (inmutable salvo soporte), password opcional}. Login SSO-first; el email como identidad estable.

### 1.2 Preferencias — `/settings/account/preferences`
«Personaliza tu experiencia». Todo es **por usuario**.
- **Modelos**
  - *Modelo predeterminado*: se preselecciona en cada chat nuevo (valor «None» = usar Auto). Promo «Cambiar a Auto».
  - *Auto* (router): elige modelo y nivel de razonamiento por tarea; «mejor relación calidad/consumo»; **todos los modelos alojados en la UE con zero data retention**; proveedores de ejemplo: Gemini, OpenAI, Claude. El enrutamiento se actualiza periódicamente.
  - *Modelo predeterminado de generación de imágenes*.
- **Idioma** (Español…).
- **Tema**: Sistema / Claro / Oscuro.
- **Encontrar acciones de integración automáticamente (Beta)**: el chat descubre acciones de apps conectadas sin etiquetar la app primero.
- **Funciones del chat** (toggles, solo chat normal, no agentes): Búsqueda web, Generación de imágenes, Memoria del chat.
- **Instrucciones personalizadas** (custom instructions): toggle Activo; campos «Sobre ti» e «Instrucciones para el modelo».
- **Memoria**: memorias privadas por usuario (no compartidas); «Aún no hay memorias».

**Para Moodly:** preferencias por usuario (modelo por defecto, idioma, tema), *custom instructions* y *memoria por usuario* además de la memoria de negocio. Modelo «Auto» = router de modelos con política de residencia UE + zero-retention (encaja con nuestro `packages/config` de modelos y MANUAL §5.12).

### 1.3 Uso y gasto — `/settings/account/usage`
«Supervisa tus límites de uso de IA».
- **Uso incluido**: el plan incluye límites que se restablecen periódicamente. **Al alcanzar el límite, todos los mensajes se enrutan a un modelo de reserva** (en el ejemplo «GPT-6 Luna»).
- **Sesión actual**: empieza al enviar un mensaje; medidor «% usado».
- **Uso semanal**: se restablece domingo a las 20:00; medidor «% usado».
- «Última actualización ahora mismo».

**Para Moodly:** medición de uso por usuario con ventanas (sesión + semanal) y **degradación a modelo barato** al superar el límite, en vez de cortar. Clave para los techos de autonomía/consumo (MANUAL).

### 1.4 Privacidad — `/settings/account/privacy`
«Gestiona tu configuración de privacidad».
- **Notificaciones por correo**: toggles por tipo (Event invites, Inside Langdock, Product updates) + «Darse de baja de todos los correos».
- **Sesiones activas**: lista con *navegador + SO*, etiqueta «Sesión actual», antigüedad («hace 7 horas») y **método de inicio de sesión** (Google / Código por correo). Varias sesiones simultáneas por dispositivo.
- **Chats compartidos**: chats compartidos por enlace dentro del workspace (alcance Espacio de trabajo / Soporte). «Aún no hay chats compartidos».
- **Zona peligrosa**: «Eliminar todos los chats» (borrado permanente).

**Para Moodly:** gestión de **sesiones activas** (dispositivo, método de login, creada, actual) → refuerza nuestro modelo `auth.sessions` + `session_is_active()`. Patrón «Zona peligrosa» para acciones destructivas, y preferencias de notificación por usuario.

### 1.5 Primeros pasos — `/settings/account/getting-started`
Onboarding **gamificado**: puntos, niveles y clasificación («Estás en la posición #1», «45 / 765» puntos). Tareas agrupadas en **Configurar el espacio de trabajo (0/6)**, **Chat (0/12)** y **Agentes (1/13)**, cada una con puntos (+5…+20).
- Revela **capacidades del producto** (útil como checklist funcional): enviar mensaje, chatear con documento, probar otro modelo, búsqueda web, generar/analizar imagen, voz, análisis de datos, crear documento, Deep Research, instrucciones personalizadas, buscar en conocimiento de la empresa; y de agentes: añadir conocimiento (carpetas/apps), chatear con agente, compartir con compañeros, etiquetar en chat, plantillas de agente, crear agente, **añadir integración**, **campos de formulario**, **subagentes**, **analíticas del agente**, plantillas.

**Para Moodly:** patrón de onboarding por puntos para activar al usuario; y lista implícita de capacidades que un agente debe soportar (conocimiento, integraciones, formularios, subagentes, analíticas, plantillas, compartir).

---

## 2. Gestión de usuarios (`/settings/workspace/user-management/*`)

### 2.1 Miembros — `/settings/workspace/user-management/members`
- **Resumen de miembros**: Total (1), «Ver detalles». Aviso: configurar uso/límites de gasto en la página *Uso y límites de gasto*.
- **Gestionar miembros**: buscador, filtro, **Exportar**, **Invitar miembros**. Tabla: **Nombre (+email) · Rol · Plan · Uso · acciones**. Cada fila: rol (combobox) y plan (combobox) editables inline.
- **Invitar miembros** (modal «Invitar miembros por correo electrónico»): campo de correos **en bloque** (separados por espacio o coma), **Rol** (Miembro/Editor/Admin) y **Plan** (Business…). → «Enviar invitación».

**Para Moodly:** alta por **invitación por email** (en bloque), con rol y plan asignados en la invitación. Cada miembro tiene rol + plan (asiento) + medición de uso. Esto coincide con nuestra tarea pendiente 3b (invitaciones en vez de INSERT directo).

### 2.2 Grupos — `/settings/workspace/user-management/groups`
- «Gestiona los miembros… en grupos». Pestañas/filtros: **Todos · SCIM · Público**. «Crear grupo».
- Dos orígenes de grupo: **SCIM** (aprovisionados por el IdP) y **Público** (uno al que cualquiera del workspace puede unirse).

**Para Moodly:** grupos de usuarios para organizar y para **scoping de permisos/compartición**; soporte **SCIM** para enterprise. Encaja con nuestro modelo de alcance (organización/región/local) + grupos.

### 2.3 Roles — `/settings/workspace/user-management/roles`  ★ (modelo RBAC)
«Define conjuntos con nombre de permisos para este espacio de trabajo. Para cambiar a una persona, ábrela en Miembros.»
- **Roles del sistema** (no eliminables):
  - **Miembro** — 15 permisos. «Acceso predeterminado».
  - **Editor** — 18 permisos. «Puede crear y compartir la mayoría de los productos, sin la configuración del espacio de trabajo.»
  - **Admin** — 25 permisos. «Siempre tiene todos los permisos.»
- **Roles personalizados**: «Crear rol». Editar un rol personalizado actualiza a todas las personas que lo tienen (los permisos cuelgan del rol, no de la persona).

**Catálogo de permisos** (agrupado por recurso; cada permiso = título + descripción; se marca «(X de Y)» por grupo). Visto en el rol Editor:
- **Agentes** (4): Crear agentes · Compartir con cualquier grupo (incl. grupos de los que no eres miembro) · Compartir con el espacio de trabajo · Configurar trazado Langfuse (observabilidad del agente).
- **Archivos** (3): Subir documentos (usarlos en chats/agentes/proyectos/carpetas) · Adjuntar/sincronizar carpetas de integraciones · Compartir carpetas y bases de conocimiento con el workspace (los admins siempre pueden gestionarlo).
- **Gobernanza** (1): Ver gobernanza.
- **Grupos** (2): Crear grupos · Crear grupos públicos.
- **Integraciones** (2): Crear integraciones (personalizadas y compartirlas) · Compartir conexiones OAuth 2.0 (preseleccionadas para acciones en agentes).
- **Plantillas de archivos** (2): Compartir plantillas (con usuarios/grupos) · Compartir con el workspace.
- **Prompts** (1): Compartir Prompts con el workspace.
- **Proyectos** (1): Compartir proyectos (con usuarios/grupos).
- **Skills** (3): Crear Skills · Compartir (usuarios/grupos) · Compartir con el workspace.
- **Workflows** (2): Crear/duplicar workflows · Compartir workflows.
- (+ permisos de configuración del workspace, solo Admin, hasta 25.)

**Para Moodly (clave para el backend):** RBAC = **roles con nombre = conjuntos de permisos**; 3 roles de sistema + roles personalizados por organización; permisos **granulares por recurso y por acción** (crear/compartir) y por **alcance de compartición** (individuo / grupo / todo el espacio). «Admin siempre todo». Esto debe mapear a nuestras políticas RLS + guardas por columna (ADR 0003) y a los roles del MANUAL (org_admin, location_manager, staff…). La compartición con 3 niveles (individuo/grupo/organización) es directamente trasladable al alcance organización/región/local.

### 2.4 Uso y gasto (workspace) — `/settings/workspace/usage`
«Uso y límites de gasto». Controles de uso del espacio de trabajo:
- **Activar uso adicional** (toggle): los usuarios pueden seguir usando todos los modelos tras agotar su uso incluido (overage).
- **Permitir solicitudes de uso**: el usuario puede **solicitar** un límite mayor; los **admins reciben aviso por correo** y revisan la solicitud aquí y en su bandeja de entrada.

**Para Moodly:** techos de consumo con *overage* opcional + **flujo de solicitud→aprobación** de ampliación de límite (usuario pide, admin aprueba). Encaja con los techos de autonomía y el modo aprobación del MANUAL.

---

## 3. Espacio de trabajo (`/settings/workspace/*`)

### 3.1 Resumen — `/settings/workspace/overview`
«Vista rápida de tu espacio de trabajo».
- **Explorar productos** (cada uno Activo/Activar → módulos activables por workspace): **Chat** (acceso a LLMs con control de datos), **Agentes** (agentes por caso de uso con conocimiento e instrucciones dedicadas), **Workflows** (automatización en segundo plano), **Deep Research** (investigación multi-paso en internet), **Conocimiento de la empresa** (buscar en la KB interna), **Skills** (reutilizables en el chat), **Programado** (tareas por horario: resumen diario/semanal), **Complementos de Microsoft Office** (Excel y Outlook).
- **Plan**: estado (Prueba/Caducado, fecha fin) + «Gestionar facturación y facturas».
- **Uso**: Usuarios activos (30 días), Usuarios totales, Mensajes 30 días (Chat + Agentes).

**Para Moodly:** los «productos» = capacidades modulares activables por organización. Para nosotros, los 4 agentes + funciones (memoria, coach, flujos, programado, conocimiento) deberían poder activarse/desactivarse por organización y plan.

### 3.2 General — `/settings/workspace/general`
- **Icono** (1:1, PNG/JPEG, ≤512 KB) y **Nombre** del espacio de trabajo.
- **Contexto de la empresa**: texto que **se añade a cada chat** para que el modelo conozca la organización. Guía: «mantenlo corto (gasta tokens en cada mensaje); 2-3 párrafos: a qué se dedica, estructura organizativa, siglas; evita marketing».
- **Zona peligrosa**: Eliminar espacio de trabajo (irreversible, borra todos los datos y miembros).

**Para Moodly:** valida nuestro card «Contexto de la empresa» de `configuracion/general`. Es **memoria de negocio inyectada en el prompt** (distinta de la memoria que aprende). Avisar del coste en tokens.

### 3.3 Modelos — `/settings/workspace/models`  ★
«Selecciona los modelos permitidos en tu espacio de trabajo».
- **Predeterminados**: modelo de chat por defecto (**Auto** router; el miembro puede fijar el suyo) y modelo de **generación de imágenes** por defecto.
- Filtros: Todos / Completion / Imagen / **Personalizado** → «Añadir modelo personalizado».
- **Catálogo agrupado por residencia de datos**: **Operado en la UE**, **Operado en EE. UU.**, **Despliegue global**. Dentro, por proveedor con contador de activados: OpenAI 12/23, Anthropic 7/14, Google 4/7, Mistral 0/2, Meta 0/1, Black Forest Labs 1/1, Z.ai, DeepSeek…
- Cada modelo muestra el **operador de hosting** («Operado por OpenAI / Microsoft Azure / Azure & OpenAI») distinto del creador, y **«Gestionar acceso»** (control de acceso por modelo → a qué grupos/roles).

**Para Moodly (clave):** catálogo de modelos por organización con **activar/desactivar por modelo**, **residencia UE/US/Global** explícita (nuestro requisito UE), **acceso por modelo a grupos**, **modelos personalizados** (BYO endpoint) y separación modelo↔hosting. Esto es exactamente `packages/config` + ADR de modelos.

### 3.4 Analítica — `/settings/workspace/analytics`
- Estadísticas en hora local; **Exportar**; **Agrupar por** (Día…); rango (Últimos 30 días).
- Dimensiones: Resumen · Miembros · Chat · Agentes · Skills · Integraciones · Workflows · API · Complementos de Microsoft.
- Métricas: usuarios totales/activos únicos, total de agentes/workflows/grupos, mensajes, **modelos usados**.

**Para Moodly:** panel de analítica por producto/dimensión con series temporales, export y modelos usados → alimenta nuestros Informes y el retorno (horas ahorradas).

### 3.5 Integraciones — `/settings/workspace/products/integrations`  ★
«Gestiona qué integraciones pueden usar tus usuarios».
- **Conjunto de herramientas predeterminado**: *suite* por defecto (Microsoft / Google / Ninguna) + **excepciones por categoría** (correo, calendario, archivos…). Se recomienda al registrarse/unirse.
- **Gestionar integraciones integradas**: los admins ven todas; activar/desactivar integradas para miembros/editores. Toggle **«Nuevas acciones activadas por defecto»**. **Acceso**: Activar todo / Seleccionar integraciones.
- **Catálogo** (78 activadas, ordenable por «Más populares»), cada integración con sus **acciones** descritas. Ejemplos: Google Drive, Gmail, Outlook (Email/Calendar), OneDrive, SharePoint, Confluence, Jira, Airtable, Asana, Ashby, AWS Kendra, Azure AI Search, Azure DevOps, BigQuery, Bitbucket, Calendly… (built-in + personalizadas).

**Para Moodly:** catálogo de integraciones (built-in + personalizadas) activables por organización, con **suite por defecto**, **defaults por categoría**, **acceso por integración** y **acciones** por integración (lo que el agente puede hacer). Es `packages/integrations` + `packages/channels`. La «suite por defecto» (Google vs Microsoft) es un buen patrón de onboarding.

### 3.6 Seguridad — `/settings/workspace/security`  ★ (enterprise auth)
- **Dominios de correo**: definir dominios para dirigir al workspace y al método de auth correcto; «Unirse por dominio» (cualquiera con email de esos dominios se une).
- **SAML SSO** (requiere dominio verificado): toggle «SAML activo» (los dominios verificados **deben** usar SSO). «Permitir autenticación externa» (quien no es de un dominio verificado puede entrar con *magic link*; SSO sigue obligatorio para los verificados). Config completa: URI de audiencia (SP Entity ID), ACS URL, Single Sign On URL, Emisor, URL de inicio de sesión, Certificado, «Firmar solicitudes SAML» (+ descargar cert SP).
- **SCIM**: sincronización de **usuarios** y de **grupos**; URL base SCIM; **Token Bearer** (se muestra una sola vez, regenerable); los grupos SCIM no se editan salvo cambios de rol; **rol de grupo predeterminado** para usuarios añadidos por SCIM (Editor).
- **Acceso de red**: *allowlist* por rangos de IP.
- **Zona peligrosa**: **«Cerrar sesión de todos los usuarios»** (invalida todas las sesiones y obliga a re-login).

**Para Moodly (clave):** modelo de auth enterprise completo: dominios → SSO SAML obligatorio por dominio, *magic link* como fallback, SCIM (usuarios+grupos) con token de un solo uso, **allowlist de IP** y **invalidación global de sesiones**. Esto refuerza nuestro `session_is_active()` y la tarea 3c-2 (config de Auth de producción). La «cerrar sesión de todos» = revocación masiva.

### 3.7 Facturación — `/settings/workspace/billing`
- Estado del plan (Prueba/Caducado + fecha); «Actualizar plan».
- **Facturación Mensual / Anual (20 % dto.)**.
- **Chat y Agentes** (por **puesto**): Prueba (gratis) · **Business 29 €/puesto/mes** (modelos IA incluidos) · Enterprise (personalizado).
- **Complemento Workflows** (por **espacio de trabajo**): Starter (incluido, 2.500 ejecuciones/mes) · Business (539 €/workspace/mes, 40.000 ejecuciones/mes). «El uso de modelos de IA en workflows se factura mediante la tarificación de la API».
- **FAQ**: licencias al añadir usuarios, prorrateo, cambio mensual↔anual, qué pasa al alcanzar un límite, si el uso extra no usado se traslada, integraciones/cargos por uso, facturas/método de pago/cancelar.

**Para Moodly:** modelo híbrido confirmado por el mercado: **por puesto** (chat+agentes) + **complementos por organización** con **cuotas de ejecución** + **uso de modelos facturado por API (variable)** + prorrateo. Encaja con nuestro «fijo + variable + implantación».

### 3.8 Archivos — `/settings/workspace/library`
- **Bases de conocimiento**: filtros Todas / Compartidas en el workspace / **Compartidas con la API** / Sin asignar. Columnas: Nombre · Propietario · Acceso · Archivos · Actualizado · Creado.
- **Carpetas**: filtros Todas / Compartidas en el workspace. Columnas: Nombre · Propietario · Acceso · Archivos · Actualizado.

**Para Moodly:** capa de **conocimiento** = bases de conocimiento + carpetas, cada una con **propietario, alcance de acceso y nº de archivos**. Las KB se pueden exponer **a la API**. Es `packages/knowledge` + la página Conocimiento.

### 3.9 Personalización — `/settings/workspace/customizations`  (white-label)
- **Visuales**: color principal personalizado; imagen de fondo de la home (1920×1080).
- **Chat**: mostrar/ocultar logo del workspace en nuevo chat; **ocultar logo del modelo** (mostrar el del workspace); **aviso del chat** (disclaimer legal bajo el input); hasta **3 cuadros informativos** en la pantalla de nuevo chat.
- **Agente**: aviso de compartición de agente (markdown).
- **Archivos**: aviso de compartición de carpetas/KB (markdown).
- **Enlaces personalizados** en la barra lateral.

**Para Moodly:** white-label enterprise (color, fondo, logos), **disclaimers legales** por superficie (chat / compartir agente / compartir carpeta) y enlaces propios en la sidebar. Relevante para cadenas/marca blanca.

### 3.10 Incorporación de usuarios — `/settings/workspace/onboarding`
- Activar la guía **Primeros pasos** para el workspace; **anonimizar la clasificación** (cada uno ve solo su posición); **tareas personalizadas** (con enlace «Más información»).

**Para Moodly:** el admin controla el onboarding gamificado (activar, anonimizar ranking, tareas propias).

---

## 4. Productos (`/settings/workspace/products/*`)

Patrón común en cada producto: **Acceso** (Acceso general / miembros o grupos específicos / solo específicos) + preferencias/toggles + (a veces) **límites y cuotas** + una **tabla de recursos** del workspace (propietario, acceso, uso, fechas). Rutas reales:

| Producto | Ruta |
| --- | --- |
| Chat | `/products/chat` |
| Agentes | `/products/agents` |
| Skills | `/products/skills` |
| Workflows | `/products/workflows-2` |
| API | `/products/api` |
| Complementos | `/products/integrations/addins` |
| Deep Research | `/products/deep-research` |
| Programado | `/products/automations` |
| Gobernanza | `/products/governance` |
| Conocimiento de la empresa | `/products/company-knowledge` |

### 4.1 Chat — `/products/chat`
- **Acceso** (3 niveles).
- **Funciones** (toggles): búsqueda web, generación de imágenes, crear/trabajar con archivos (docs, hojas, PDF, presentaciones), compartir chats, memoria del chat, activar memoria para todos, transcripción de voz.
- **Conservación de datos**: periodo de retención (por defecto «Para siempre»). **Cambiar a un periodo menor borra irreversiblemente todos los chats y archivos anteriores de TODOS los miembros.**
- **Gestionar proyectos**: tabla de proyectos (Nombre · Propietario · Acceso · Chats · fechas). Proyectos = contenedores de chats.

### 4.2 Agentes — `/products/agents`  ★
- **Archivado automático**: archivar agentes sin uso tras X (3 meses) + **periodo de gracia** (7 días); restaurables.
- **Preferencias**: búsqueda web, generación de imágenes (global), compartir info de usuario en el feedback del agente (nombre+email al creador, con opt-out), **restricción de acceso a fuentes** (el usuario ve la referencia pero no abre la fuente), **registros de agente** (observabilidad vía proveedores externos; qué roles pueden configurarlo se define en Roles).
- **Capacidades predeterminadas** de agentes nuevos (p. ej. búsqueda web).
- **Gestionar agentes**: tabla (Nombre · Propietario · Acceso [Privado…] · Mensajes · fechas); filtros Todos / Sin asignar / **Verificado**.
- **Etiquetas de Agente** (taxonomía por función): Éxito del cliente, Atención al cliente, Análisis de datos, Diseño, Documentación, Educación, Ingeniería, Finanzas, General, RR.HH., Legal, Marketing, Operaciones, Producto, Ventas, Soporte. Personalizables.

**Para Moodly (agent-core):** el agente es una entidad con {propietario, alcance de acceso, capacidades, conocimiento, integraciones, logging, etiquetas, estado (activo/archivado/verificado), métricas}. Ciclo de vida con archivado automático. Observabilidad por agente. La restricción de acceso a fuentes es clave para datos sensibles de clientes.

### 4.3 Skills — `/products/skills`
- **Acceso**. **Categorías** de skills predefinidas (toggle de disponibilidad), con nº de skills: Ventas 9, Finanzas 8, RR.HH. 6, Legal y compliance 8, Marketing 6, Engineering 10, Product 8, Operations 14, Design 7, Data 6, Customer Success 6, Productividad 11. **Skills personalizados** (tabla Skill · Creador).

**Para Moodly:** `packages/skills` = catálogo por categorías (built-in) + personalizados, activables por organización. Un skill tiene creador y alcance.

### 4.4 Workflows — `/products/workflows-2`
- **Plan** con **cuota de ejecuciones** (Starter 2.500/mes) y reinicio mensual; el uso de modelos cuenta para el límite.
- **Acceso** (3 niveles).
- **Límites de gasto**: límite mensual **predeterminado** por workflow (25 $) y **máximo** que un usuario puede fijar; límite global de gasto en modelos de workflows (p. ej. 500).

**Para Moodly:** flujos automáticos = automatizaciones en segundo plano con **cuota de ejecuciones** + **techos de gasto por flujo** (default/max/global). Encaja con worker/pg-boss + techos de autonomía.

### 4.5 API — `/products/api`
- Claves API **del workspace** y **personales**; caducidad predeterminada (12 meses, editable al crear). (No disponible en prueba.)
- **Coste y presupuesto**: ciclo de facturación, **tope de gasto mensual** (0/100 €), desglose de costes **(descargar CSV)**.
- **ID del espacio de trabajo**.
- **Modelos de API disponibles** (21): columnas Nombre · ID de modelo API · Proveedor · **Región** · **RPM** (límite de peticiones/min).

**Para Moodly:** producto API enterprise = claves (workspace/personales) con caducidad, tope de gasto mensual, export de costes, y catálogo de modelos con región + rate limit por modelo.

### 4.6 Complementos — `/products/integrations/addins`
- **Chatbots**: Bot de **Slack** y Bot de **Microsoft Teams** (usar Langdock dentro de esas apps; conectar; cualquier usuario con licencia).
- **Complementos de Microsoft Office**: Excel y Outlook, con **control de acceso por complemento** (Nadie/…).

**Para Moodly:** extensiones de superficie (bots en Slack/Teams, add-ins de Office) con acceso por complemento. Para nosotros el equivalente son los canales (WhatsApp, etc.), pero el patrón «usar el producto dentro de herramientas externas, con acceso configurable» aplica.

### 4.7 Deep Research — `/products/deep-research`
- **Acceso** (3 niveles). **Modelos** internos fijos (varios). **Límite de uso**: 15 tareas/mes por usuario.

**Para Moodly:** investigación multi-paso como producto con modelos internos + cuota por usuario.

### 4.8 Programado — `/products/automations`
- «Lista de todo el espacio de trabajo con cada tarea programada. Desactiva cualquiera para impedir que se ejecute y **notificar al propietario**.»
- **Acceso** (3 niveles). Tabla de tareas con filtros Todos / Programadas / Manual / Desactivadas / Más recientes.

**Para Moodly:** tareas programadas (cron) por organización con **supervisión del admin** (desactivar + avisar al dueño). Encaja con worker/pg-boss.

### 4.9 Gobernanza — `/products/governance`  ★
- Complemento (gratis hasta 1 ene 2027). «Gestiona el cumplimiento, la seguridad y los controles de acceso.»
- **Activar gobernanza** (los admins tienen acceso completo; se concede a otros desde Roles y grupos).
- **Ocultar recursos privados**: oculta lo no compartido. Aplica a **Agentes, Skills, Integraciones personalizadas y servidores MCP**. Las integraciones visibles muestran creador y con quién se comparten; **las claves API y secretos permanecen ocultos**.

**Para Moodly:** panel de gobernanza/cumplimiento que inventaría todos los recursos (agentes, skills, integraciones, **servidores MCP**) con creador y compartición, respetando la privacidad de secretos. Para auditoría y seguridad enterprise.

### 4.10 Conocimiento de la empresa — `/products/company-knowledge`
- **Acceso** (general / específico). **Integraciones disponibles** para consultar: SharePoint, Google Drive, OneDrive, Confluence, Outlook Email, Outlook Calendar, Gmail, Google Calendar, Microsoft Teams, Linear, Jira, Slack (toggle por fuente).

**Para Moodly:** búsqueda/RAG unificada sobre fuentes conectadas, activando cada fuente por organización. Es `packages/knowledge` + integraciones.

---

## 5. Síntesis para el backend de Moodly

### 5.1 Jerarquía de entidades (observada)
- **Workspace** (= nuestra *organización*): nombre, icono, contexto de empresa, plan, productos activables, retención de datos, branding, dominios/seguridad.
- **Miembro** = usuario ↔ workspace, con **Rol** (permisos) + **Plan** (asiento/tarifa) + medición de **uso**.
- **Grupo**: colección de miembros; origen **SCIM** o **Público**; usado para *scoping* de acceso/compartición.
- **Rol** = conjunto con nombre de **permisos** (sistema: Miembro/Editor/Admin; + personalizados por workspace).
- **Recursos de producto** compartibles: Agentes, Skills, Workflows, Proyectos (chats), Carpetas, Bases de conocimiento, Prompts, Plantillas de archivos, Integraciones (y servidores **MCP**). Cada uno: **propietario + alcance de acceso** (privado / individuos / grupos / todo el workspace) + fechas + métricas.
- **Sesión**: por dispositivo, con método de login y «sesión actual»; revocable individual y globalmente.

### 5.2 Permisos (RBAC) — mapeo a nuestro RLS (ADR 0003)
- Permisos **granulares por recurso × acción** (crear / compartir) y por **alcance de compartición** (individuo / grupo / workspace). «Admin siempre todo».
- Traslado a Moodly: el **alcance de compartición** (individuo/grupo/workspace) mapea a nuestro **alcance organización/región/local**; los permisos cuelgan del **rol** (no de la persona) → tabla `roles` + `role_permissions` + `memberships.role`. Editar un rol propaga a todos sus miembros.

### 5.3 Uso, cuotas y techos (clave para «techos de autonomía»)
- **Uso incluido** por usuario (ventanas sesión + semanal) con **degradación a modelo barato** al superar el límite (no se corta).
- **Overage** activable a nivel workspace + **solicitud→aprobación** de ampliación de límite (usuario pide, admin aprueba por email/bandeja).
- Productos con cuotas propias: Workflows (ejecuciones/mes + techos de gasto $ por flujo), Deep Research (tareas/mes), API (tope mensual € + RPM por modelo).

### 5.4 Modelos de IA
- Catálogo por workspace con **activar/desactivar por modelo** y **acceso por modelo a grupos**; agrupados por **residencia (UE / EE.UU. / Global)**; **modelos personalizados**; separación modelo↔hosting; defaults de chat e imagen (con override por usuario); router **«Auto»**. → Nuestro requisito UE + `packages/config`.

### 5.5 Seguridad/compliance
- Dominios → **SAML SSO** obligatorio por dominio (+ magic link fallback), **SCIM** (usuarios+grupos, token de un solo uso, rol por defecto), **allowlist de IP**, **invalidación global de sesiones**, **retención de datos** por producto, **gobernanza** (inventario de recursos + secretos ocultos), **disclaimers legales** por superficie. Refuerza `session_is_active()` y la tarea 3c-2.

### 5.6 IA de Configuración recomendada para Moodly (copiando la estructura, no la identidad)
Reutilizar los 4 grupos: **Personal** (perfil, preferencias, uso, privacidad+sesiones, primeros pasos) · **Gestión de usuarios** (miembros, grupos, roles, uso) · **Organización** (resumen, general+contexto, modelos, analítica, integraciones, seguridad, facturación, conocimiento, personalización, onboarding) · **Productos/Agentes** (los 4 agentes + flujos, programado, conocimiento, API, gobernanza). Cada producto con el patrón Acceso + toggles + límites + tabla de recursos. Nuestro **alcance organización/región/local** sustituye al par workspace/grupo de Langdock.
