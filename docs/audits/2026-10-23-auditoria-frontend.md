# Auditoría del frontend — 2026-10-23

> Segunda parte de `2026-10-23-auditoria-estado.md`: diseño, rutas, pantallas, estructura, menús y desplegables de `apps/web`, frente a lo decidido (ADR 0023, MANUAL §9) y al prototipo (`apps/site/plataforma`, especificación visual). Rango: histórico (`docs/audits/`). Si discrepan, manda ADR > MANUAL > `docs/design/` > prototipo.

## 0. Resumen

El **esqueleto** está bien construido y probado. Tiene:
- barra lateral colapsable con las secciones de §9.2;
- selector de organización y de alcance;
- ⌘K y migas;
- tema claro y oscuro, español e inglés;
- PWA y WCAG AA comprobado con axe.

Pero:
- **la app no sigue el mapa de rutas decidido** (F-1);
- **no tiene Inicio**: `/app` redirige a Ajustes (F-2);
- **los Ajustes son dos páginas sueltas** frente a las 13 secciones del patrón P6 (F-3);
- de las ~45 pantallas del mapa (`docs/design/mapa-pantallas-datos.md`) solo 6 tienen datos reales.

**Orden propuesto, de más a menos estructural:**
1. rutas canónicas y navegación (F-1, F-4, F-5, F-6);
2. Ajustes P6 con navegación secundaria (F-3);
3. Inicio P1 (F-2);
4. login con diseño y traducido (F-7).

Las pantallas de negocio (P2, P3, P5 y P7) llegan con sus tablas (fase D en adelante), siempre con datos reales, nunca maquetas (MANUAL §9.8).

## 1. Inventario

### 1.1 Rutas de `apps/web` frente al mapa decidido (ADR 0023, MANUAL §9.4)

| Hoy en `apps/web` | Ruta canónica | Contenido hoy |
|---|---|---|
| `/app` | `/app` | Redirige a `/app/settings/organization` |
| `/app/inbox` | `/app/conversaciones` | Vacío honesto |
| `/app/approvals` | `/app/aprobaciones` | Vacío honesto |
| `/app/tasks` | `/app/tareas` | Vacío honesto |
| `/app/activity` | `/app/actividad` | Vacío honesto |
| `/app/analytics` | `/app/informes` | Vacío honesto |
| `/app/coach` | `/app/coach` | Vacío honesto |
| `/app/records/contacts` | `/app/clientes` | Vacío honesto |
| `/app/records/conversations` | (misma que la bandeja: `/app/conversaciones`) | Vacío honesto, duplicada |
| `/app/records/recommendations` | (dentro de `/app/coach`) | Vacío honesto, duplicada |
| `/app/records/goals` | `/app/objetivos` | Vacío honesto |
| `/app/records/knowledge` | `/app/conocimiento` | Vacío honesto |
| `/app/records/memory` | `/app/memoria` | Vacío honesto |
| `/app/records/locations` | `/app/ajustes/sedes` | **Datos reales:** tabla con vista previa (P2 + P4) |
| `/app/records/people` | `/app/ajustes/equipo` | **Datos reales:** tabla de personas |
| `/app/settings/organization` | `/app/ajustes/general` + `/equipo` + `/sedes` | **Datos reales:** organización, locales, personas e invitaciones |
| `/app/settings/security` | `/app/ajustes/seguridad` | **Datos reales:** alta y baja de TOTP |
| `/app/invitation` | `/app/invitacion` | **Datos reales:** aceptar invitación |
| `/login`, `/login/mfa` | (sin cambios: fuera de `/app`) | **Datos reales:** contraseña y código |

### 1.2 Pantallas del mapa sin equivalente en la app
- **Operación:** agenda, leads, facturas e inventario, llamadas.
- **Agentes:** ventana de cada agente (P5), skills, asistente (ADR 0029), reglas y aprobaciones, flujos, horarios.
- **Red:** red de franquicias.
- **Alta:** onboarding (§9.6).
- **Ajustes:** perfil, preferencias, privacidad, roles, modelos, integraciones, plan, facturación, auditoría y claves de API.
- **Panel interno:** `/ops` (ADR 0021).

Casi todas necesitan tablas que aún no existen (fase D en adelante).

### 1.3 Componentes de `packages/ui`
**Hay:**
- estructura: `AppShell`, `Sidebar`, `ScopeSwitcher`;
- navegación y búsqueda: `CommandPalette` y `Command`, `GlobalSearch`;
- datos: `DataTable`, `PreviewDrawer`, `Sheet`;
- menús y diálogos: `DropdownMenu`, `ConfirmDialog`;
- estados: `EmptyState`, `ErrorState`, `Skeleton`, `Toast`;
- básicos: `Badge`, `Button`, `Checkbox`, `Input`, `Kbd`.

**Faltan** (MANUAL §9.8), por orden de necesidad:
- `SettingsNav` (P6) e `InheritanceBadge`;
- `RecordPage`, `RecordTabs` y `AttributePanel` (P3);
- `ChatThread`, `Composer` y `AgentWindow` (P5);
- `KanbanBoard`, `ViewSwitcher`, `FilterBar` y `SavedViews`;
- `MetricWidget` y `GoalProgress` (P7);
- `ApprovalCard`, `RecommendationCard` y `ActivityTimeline`.

## 2. Hallazgos

| # | Hallazgo | Gravedad | Propuesta |
|---|---|---|---|
| F-1 | **Rutas fuera del mapa decidido.** El ADR 0023 (aceptado) fija rutas en español como identificadores estables y deja «renombrar las rutas de `apps/web`» como tarea de código pendiente. Cada pantalla nueva agranda la deuda. | **Alta** (contradice un ADR) | Renombrar ya, con los e2e. Las rutas viejas no se publicaron a nadie: no hacen falta redirecciones. |
| F-2 | **Sin Inicio (P1).** `/app` redirige a «Mi organización». | Alta (primera impresión) | Inicio con saludo, caja «¿Qué quieres que haga hoy?» y la bandeja del día. Primero con lo que hay de verdad: estado de la organización, locales en alcance, invitaciones pendientes, seguridad de la cuenta (MFA) y los 4 agentes «sin configurar». Sin cifras inventadas. |
| F-3 | **Ajustes no es un área (P6).** Hay dos páginas sueltas («Mi organización» y «Seguridad») con pestañas, frente a 13 secciones con navegación secundaria en el mapa y el prototipo («Personal», «Equipo y permisos», «Tu negocio», «IA y conexiones», «Seguridad»). | Media | Área `/app/ajustes/*` con su navegación agrupada como el prototipo. Reales hoy: General, Mi perfil, Preferencias, Miembros, Sedes y Seguridad. El resto, con un vacío que diga qué habrá y cuándo llega. |
| F-4 | **Pie de la barra lateral recargado.** Tema, idioma, email y salir van sueltos, cada uno con su control. §9.2 y el prototipo usan un **menú de usuario** desplegable: perfil, ajustes de la empresa, plan, tema, idioma, ayuda y cerrar sesión. | Media | Menú de usuario con `DropdownMenu` (Radix), con nombre e iniciales, y rol y organización como subtítulo. |
| F-5 | **Sección «Agentes» vacía** aunque los 4 tipos son canónicos (`AGENT_TYPES` en `@repo/config`, ADR 0023). | Media | Listar los 4 con su color y el estado «Sin configurar», enlazando a `/app/agentes/[tipo]` (P5). Cada ventana explica qué hará ese agente y que su configuración llega con el catálogo (fase D). |
| F-6 | **Entradas duplicadas.** «Bandeja» y Registros → «Conversaciones», y «Coach» y Registros → «Recomendaciones», van a pantallas distintas, pero el mapa tiene una ruta para cada par. «Locales» y «Personas» están en Registros, pero en el mapa son Ajustes (Sedes, Miembros). | Media | Una entrada por destino: Bandeja → `/app/conversaciones`; las recomendaciones, dentro de Coach; Locales y Personas pasan a Ajustes. Registros queda con objetos de negocio: Clientes, Objetivos, Conocimiento y Memoria. |
| F-7 | **Login mínimo.** Sin marca, sin traducir y sin estados (cargando, error y freno con su tiempo de espera). | Media | Pantalla de acceso con el logotipo y los tokens de marca, traducida (es/en), con los mismos mensajes genéricos (sin revelar si existe el email) y el paso de MFA con el mismo diseño. |
| F-8 | **Barra superior incompleta.** Solo migas. §9.2: migas, acciones de la vista y avisos. | Baja | Hueco de acciones por página (p. ej. «Invitar» en Miembros) y campana de avisos cuando haya eventos (fase D). |
| F-9 | **Móvil.** El cajón por debajo de 900 px funciona, pero §9.2 prioriza Aprobaciones y Bandeja, y el prototipo móvil usa una barra inferior. | Baja | Barra inferior (Inicio, Bandeja, Aprobaciones y Más) en móvil, cuando existan esas pantallas. |
| F-10 | **Los vacíos no dicen cuándo llegan.** Explican qué habrá, pero no qué falta para tenerlo. | Baja | Añadir «Llega con…» (catálogo de agentes, canales, etc.) para que producto pueda enseñar la app sin prometer fechas. |
| F-11 | **Prototipo y MANUAL discrepan en la barra lateral.** El prototipo agrupa Operación, Agentes y Red; el MANUAL, navegación principal, Agentes, Registros, vistas guardadas, favoritos y recientes. | Info | Manda el MANUAL (ADR 0023). Del prototipo se toman el menú de usuario, el selector de organización y sede, y la navegación de Configuración. |
| F-12 | **Marca.** La app no muestra el logotipo ni el nombre comercial en la barra lateral (el prototipo sí). | Baja | Logotipo (con `BRAND_NAME` como texto alternativo) encima del selector de organización. |

## 3. Navegación propuesta (MANUAL §9.2 con F-1, F-5 y F-6)

```
[Logo]
Organización ▾ · Alcance ▾ · Buscar ⌘K
Inicio                 /app
Coach                  /app/coach            (revisiones y recomendaciones)
Aprobaciones           /app/aprobaciones
Bandeja                /app/conversaciones
Tareas                 /app/tareas
Actividad              /app/actividad
Informes               /app/informes
AGENTES
  ● Recepción          /app/agentes/reception
  ● Atención cliente   /app/agentes/customer
  ● Comercial          /app/agentes/sales
  ● Administración     /app/agentes/admin
REGISTROS
  Clientes             /app/clientes
  Objetivos            /app/objetivos
  Conocimiento         /app/conocimiento
  Memoria              /app/memoria
VISTAS GUARDADAS · FAVORITOS · RECIENTES
[Menú de usuario ▴]   perfil · ajustes · tema · idioma · cerrar sesión
```

Ajustes (`/app/ajustes/*`, navegación propia como el prototipo):
- **Personal:** Mi perfil, Preferencias, Privacidad.
- **Equipo y permisos:** Miembros, Roles.
- **Tu negocio:** General, Sedes, Plan y consumo, Facturación.
- **IA y conexiones:** Modelos, Integraciones, Claves de API.
- **Seguridad:** Seguridad y acceso, Auditoría.

## 4. Qué falta por diseñar (no hay diseño, ni en el prototipo)
- **Del mapa (§7):**
  - OAuth de canal y plantillas de WhatsApp;
  - alta y revisión de la voz;
  - detalle de aprobación;
  - tomar el control de una conversación;
  - publicar una versión de agente;
  - ingesta de conocimiento con progreso;
  - exportar y borrar datos (RGPD);
  - checkout de Stripe;
  - SSO y SCIM;
  - claves de API.
- **Nuevo, de esta revisión:**
  - avisos (campana) y su centro;
  - estado «organización suspendida» (hoy, pantalla vacía sin explicación);
  - aviso de sesión caducada;
  - recuperar contraseña (no existe: llega con WorkOS o Supabase Auth con SMTP, B4);
  - códigos de recuperación del MFA (A2 pendiente).

## 5. Mejoras transversales
- **Estado en la URL** (§9.4): ya en el alcance (`?scope=`). Falta en filtros, orden y pestañas cuando lleguen las tablas P2.
- **Atajos:** ⌘K hecho. Faltan `g i` (Inicio), `g a` (Aprobaciones) y `?` para la ayuda de atajos.
- **Accesibilidad:** axe sin fallos en las pantallas actuales. Mantenerlo como check de cada pantalla nueva (ya está en los e2e).
- **Rendimiento:** listas con `fetchAll` (tope de 100.000 filas). Al llegar a P2 con volumen, virtualización (TanStack Virtual) y paginación del lado del servidor.

## 6. Plan de implementación (incrementos, cada uno con sus e2e)
1. **Navegación canónica:**
   - F-1, F-5, F-6 y F-12: rutas en español, Agentes con los 4 tipos, una entrada por destino y logotipo;
   - F-4: menú de usuario.
2. **Ajustes P6** (F-3): área con navegación secundaria. General, Mi perfil, Preferencias, Miembros, Sedes y Seguridad con datos reales; el resto, con vacío explicado.
3. **Inicio P1** (F-2) con lo que existe de verdad.
4. **Login y MFA con diseño y traducidos** (F-7).
5. **Pantallas de negocio:** con sus tablas (fase D), empezando por la ventana de agente (P5) y Aprobaciones.
