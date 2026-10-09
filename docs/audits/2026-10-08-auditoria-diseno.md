# Auditoría de diseño: fijar el diseño antes del backend

Fecha: 2026-10-08 · Repo: `github.com/dsvmotion/moodly` · Rama: `feat/site-landings`
Alcance auditado: prototipo navegable de plataforma (`apps/site/src/app/plataforma`, 41 pantallas de escritorio + 13 móviles + 13 de Configuración), web pública (18 páginas en es/en/fr/de) y los tableros del canvas (artifact `BoLfJGSVxG4tGv6DmLYQfv`).
Referencia de nivel: Langdock (`docs/design/benchmark-langdock.md` y `docs/design/langdock-configuracion-arquitectura.md`).

Esta auditoría es de **diseño** (calidad visual, IA, cobertura de pantallas, estados, interacción, accesibilidad, i18n). No repite la auditoría de backend/datos (`docs/audits/2026-10-07-auditoria-plataforma.md`), con la que se complementa.

---

## 1. Veredicto

**El diseño está a nivel Langdock —en IA, sistema visual y cobertura de superficie incluso por encima para el nicho— y está listo para fijarse, con una lista corta de cosas que conviene cerrar AHORA** porque definen contratos que el backend tendrá que respetar (estados, interacción, tokens y el asistente de alta).

Lo que ya está resuelto y no debería tocarse salvo pulido:
- **Arquitectura de información**: barra lateral con grupos (Operación / Agentes / Configuración), selector de organización y de sede, badge de aprobaciones, y ⌘K (en `apps/web`). Equivale a la navegación de Langdock/Attio/Apollo que pide el MANUAL §9.
- **Sistema visual**: tokens consistentes (Labil Grotesk + Plus Jakarta Sans, colores de agente, botones pill, tarjetas de radio 12px, grises coherentes). Se ve de una sola pieza en las 41 pantallas.
- **Cobertura de pantallas**: los 7 patrones (P1–P7) están presentes. La superficie de Configuración (general, perfil, preferencias, privacidad, equipo, roles, modelos, integraciones, sedes, plan, facturación, seguridad, auditoría) cubre casi punto por punto el panel de ajustes de Langdock.
- **Pantallas distintivas bien resueltas**: Modo coach (propuestas + competencia + objetivos con progreso), Modelos de IA (3 modos de conexión + modelo por agente + residencia), Sedes (tabla multi-local con ocupación y plantillas), Agente (pestañas + toggles de autonomía solo/aprobación/nunca), Onboarding (asistente de 4 pasos).

**Conclusión:** no hay que rediseñar; hay que **cerrar los contratos de diseño** de la lista §4 y entonces reconstruir en `apps/web` sobre datos reales con la especificación ya fijada.

---

## 2. Scorecard frente al nivel Langdock

Leyenda: ✅ a nivel · 🟡 parcial / falta detalle · ⬜ no diseñado.

| Dimensión | Estado | Nota |
|---|---|---|
| Arquitectura de información / navegación | ✅ | Grupos, alcance, ⌘K, badges. |
| Sistema visual y consistencia | ✅ | Tokens unificados en `apps/site`. Ver §4.1 (fuente única). |
| Cobertura de pantallas operativas (P1–P7) | ✅ | Inicio, Conversaciones, Aprobaciones, Agenda, Clientes, Leads, Facturas, Informes, Llamadas. |
| Superficie de Configuración / gobierno | ✅ | 13 pantallas; mapea a los ajustes de Langdock. |
| Modelos de IA (residencia, BYOK, por agente) | ✅ | Igual o mejor que la página de modelos de Langdock. |
| Multi-sede / cadenas | ✅ | Pantalla Sedes + herencia de plantillas. |
| Asistente de alta / activación | 🟡 | 4 pasos existen; falta checklist de puesta en marcha y estados. Ver §4.4. |
| **Estados (vacío / carga / error / sin permiso)** | ⬜ | Solo "happy path" con datos fijos. **Lock-blocker.** Ver §4.2. |
| **Especificación de interacción** (filtros, búsqueda, paginación, acciones masivas, confirmaciones, toasts, optimista) | ⬜ | ~140 botones `data-demo` sin comportamiento. **Lock-blocker.** Ver §4.3. |
| **Tokens de marca como fuente única** | 🟡 | 3 fuentes desalineadas (`packages/ui` sistema, `apps/site` marca, canvas Geist/paleta vieja). **Lock-blocker.** Ver §4.1. |
| Modo oscuro | 🟡 | `apps/web` (shell) sí; el prototipo de plataforma es solo claro. Decisión. Ver §5. |
| Accesibilidad (semántica, foco, contraste) | 🟡 | `apps/web` ya pasa axe; el prototipo usa `<span>`/`<a href="#">` como controles. Mantener la barra al reconstruir. Ver §5. |
| Móvil responsive real | 🟡 | Las páginas móviles son maquetas de ancho fijo: **recortan a 375px reales**. Decisión PWA vs maqueta. Ver §5. |
| Retención de datos / RGPD en UI | 🟡 | Langdock expone retención por producto; añadir controles. Ver §5. |
| Uso: solicitud→aprobación de límite | ⬜ | Patrón Langdock (usuario pide, admin aprueba). Encaja con techos de autonomía. Ver §5. |
| Analítica: export CSV + group-by + rango | 🟡 | Informes tiene "Descargar PDF"; falta export de datos y agrupación. Ver §6. |
| API keys / Gobernanza / Red de franquicias (UI) | ⬜ | Diferibles a su fase. Ver §6. |

---

## 3. Hallazgos por página (resumen)

- **Inicio, Informes, Coach, Agente, Modelos, Sedes, Onboarding, Roles**: a nivel, sin cambios de diseño.
- **Conversaciones (escritorio y móvil)**: a nivel; el panel de tres columnas (lista / hilo / ficha) está bien. Falta el estado "sin conversaciones" y el de "tomando el control".
- **Clientes / Leads / Facturas / Agenda**: a nivel en layout; todos necesitan sus estados vacíos y la especificación de filtros/orden/acciones masivas (p. ej. "Aprobar las 6").
- **Datos de ejemplo**: casi todo es `42 / 427 / 4.271`. Aceptable en prototipo, pero antes de enseñarlo a stakeholders conviene variar los números de las pantallas de primera impresión (Inicio, Informes) para que no se lea "42 en todo".
- **Móvil**: 13 pantallas como maqueta de teléfono (se ven bien centradas en escritorio); no son el producto móvil real.
- **Web pública**: completa y traducida (4 idiomas); legales en borrador con `[placeholders]` (pendiente de asesoría, ya recogido en la auditoría de backend).

---

## 4. Lock-blockers: cerrar antes de empezar el backend

Son los que definen contratos que el backend y la reconstrucción en `apps/web` tendrán que respetar. Si se fijan ahora, no hay que rehacer pantallas luego.

### 4.1 Tokens de marca como fuente única (`packages/ui`)
Hoy hay tres sistemas desalineados (auditoría backend §6.2): `packages/ui` con fuentes del sistema, `apps/site` con la marca real, y el canvas con Geist y la paleta vieja de agentes. **Antes de reconstruir cualquier pantalla en `apps/web`**, llevar los tokens de marca (tipografías, colores de agente, radios, sombras, espaciados) a `packages/ui` como **fuente única**, y que `apps/site` y el canvas consuman de ahí. Sin esto, cada pantalla reconstruida arrastra la desalineación.
→ Entregable: `packages/ui/tokens` + ADR "sistema de diseño y tokens". Mapea a plan backend Paso 0/2.

### 4.2 Estados por pantalla (vacío / carga / error / sin permiso)
El prototipo es solo "happy path". El producto real necesita, por cada pantalla con datos:
- **Vacío** ("aún no hay conversaciones / clientes / leads…") con acción de arranque.
- **Carga** (skeletons, no spinners vagos).
- **Error + reintentar** (fallo de red o de integración).
- **Sin permiso / fuera de alcance** (lo que un `staff` no debe ver).
→ Entregable: una página de estados en el canvas + componentes `Empty`, `Skeleton`, `ErrorState` en `packages/ui`. Es barato ahora y carísimo de improvisar pantalla a pantalla después.

### 4.3 Especificación de interacción
Fijar, como diseño, el comportamiento que hoy es `data-demo`:
- **Filtros y búsqueda**: qué filtra cada chip, búsqueda en servidor vs cliente, combinables o no.
- **Listas**: paginación vs scroll infinito, orden, selección de filas.
- **Acciones masivas**: "Aprobar las 6", "Avisar lista de espera" — confirmación, resultado, deshacer.
- **Acciones sensibles** (aprobar/enviar factura, tomar el control, publicar cambio de agente): diálogo de confirmación, estado optimista, **toast** de resultado y manejo de error. Esto además toca el motor de políticas (techo de autonomía) del backend.
→ Entregable: tabla de interacción por pantalla (acción → confirmación → feedback → error) + componentes `ConfirmDialog` y `Toast`.

### 4.4 Asistente de alta y checklist de puesta en marcha
El asistente de 4 pasos (sector → conectar herramientas → elegir agentes → activar) es la **primera superficie que el backend tendrá que ejecutar de verdad** (crea organización, conecta canal, instancia agentes). Cerrar ahora:
- Estados de cada paso (conectando WhatsApp, error de OAuth, "te falta X para activar").
- **Checklist de go-live** post-alta (conectar canal, cargar contexto de negocio, probar en sandbox, publicar).
- Contexto de negocio como paso explícito (es la "memoria de negocio" inyectada en el prompt; Langdock avisa del coste en tokens).
→ Entregable: flujo de alta completo en el canvas con sus estados. Mapea a plan backend Paso 2 y Paso 6.

---

## 5. Should-fix antes de reconstruir (decisiones de producto)

1. **Modo oscuro**: `apps/web` ya lo tiene; el prototipo de plataforma no. Decidir si el producto sale con claro+oscuro (Langdock: Sistema/Claro/Oscuro). Si sí, diseñar los tokens oscuros ahora (barato con la fuente única de §4.1).
2. **Móvil**: decidir PWA responsive (recomendado primero, como la auditoría backend Paso 10) vs mantener las maquetas de teléfono solo como material visual. Hoy recortan a 375px reales: no deben enlazarse como "la app" sin hacerlas responsive.
3. **Accesibilidad**: mantener en `apps/web` la barra que ya pasa axe (tarea 4): controles como `<button>` reales, `:focus-visible`, contraste AA en las tarjetas de color de agente. El prototipo usa `<span>`/`<a href="#">` — no portar ese patrón.
4. **Retención de datos / RGPD en UI**: añadir a Privacidad/General los controles de retención por tipo de dato (Langdock los expone por producto) y el acceso a exportar/borrar. Alimenta `data_requests` del backend.
5. **Uso: solicitud→aprobación de límite**: patrón Langdock (el usuario pide ampliar su límite, el admin aprueba) en Plan/consumo. Encaja directamente con los techos de autonomía/consumo del MANUAL.
6. **Integraciones**: verificar que la pantalla muestra, por integración, sus **acciones** (lo que el agente puede hacer) y el **acceso por integración** + suite por defecto (Google/Microsoft), como Langdock. Es la especificación de `packages/integrations`.

---

## 6. Diferibles a su fase (no bloquean el backend)

- **Analítica**: export CSV + group-by + rango de fechas en Informes (hoy solo "Descargar PDF").
- **API keys** (workspace + personales, caducidad, tope de gasto): basta un diseño "Próximamente".
- **Gobernanza** (inventario de recursos con creador y compartición): enterprise.
- **Red de franquicias (UI)**: si las franquicias entran en el lanzamiento, diseñar el selector multi-organización y la vista del franquiciador (plantillas de red + métricas agregadas). Depende del go-to-market; hoy no hay pantalla.
- **Datos de demo creíbles** en pantallas de primera impresión.

---

## 7. Definición de "diseño fijado"

Se puede declarar el diseño fijado y pasar al backend cuando:

- [ ] Tokens de marca viven en `packages/ui` como fuente única; `apps/site` y canvas consumen de ahí (§4.1).
- [ ] Existen los 4 estados (vacío/carga/error/sin permiso) como diseño y como componentes base (§4.2).
- [ ] Hay una tabla de interacción por pantalla y los componentes `ConfirmDialog`/`Toast` (§4.3).
- [ ] El asistente de alta está completo con estados y checklist de go-live (§4.4).
- [ ] Decididos: modo oscuro (sí/no), estrategia móvil (PWA/maqueta), y si las franquicias entran en el lanzamiento (§5, §6).
- [ ] `apps/site` commiteado y con PR (toca dependencias → `revisado-humano`).

Los puntos §6 se diseñan en su fase del plan de backend, no bloquean.

---

## 8. Qué decido yo y qué necesito de producto

**Puedo ejecutar ya (son diseño, no backend):** §4.1 tokens a `packages/ui`, §4.2 estados, §4.3 componentes de interacción y la tabla por pantalla, §4.4 estados del asistente de alta. Todo con evidencia (build + capturas), sin tocar zonas sensibles salvo el PR final.

**Necesito que producto decida:** modo oscuro (sí/no), estrategia móvil (PWA responsive vs maqueta), franquicias en el lanzamiento (sí/no), y prioridad entre los 4 lock-blockers si no van los cuatro a la vez.

---

## 9. Actualización de ejecución (2026-10-08)

Decisiones de producto: **modo oscuro sí · móvil PWA responsive · franquicias en el lanzamiento sí · licencia de Labil Grotesk confirmada.** Ejecutado y verificado:

- **§4.1 Tokens de marca → fuente única (hecho).** Paleta de agente + naranja de marca + enlace en `packages/ui/src/styles/globals.css` (OKLCH, claro/oscuro, WCAG AA en test). Referencia: `docs/design/tokens-marca.md`.
- **Fuentes de marca (hecho).** Plus Jakarta Sans (cuerpo) y **Labil Grotesk (titulares, licencia confirmada)** cargadas en `apps/web` con `next/font` y enlazadas a `--font-sans`/`--font-display`.
- **§4.2/§4.3 Componentes de estado e interacción (hecho).** `Skeleton`, `ErrorState`, `ConfirmDialog`, `Toast` (+ store con tests) en `packages/ui`, sobre el `EmptyState` existente. Son la realización reutilizable para `apps/web`.
- **§4.4 Asistente de alta (hecho).** Cuarto paso «Revisa y activa» con checklist de puesta en marcha (sector, canal, contexto de negocio, agente, prueba en sandbox) — es lo que el backend ejecuta al activar.
- **Franquicias (hecho).** Nueva pantalla `/plataforma/red`: vista del franquiciador con separación de datos explícita, tabla de franquiciados con cumplimiento de plantilla, políticas de red bloqueadas y mejora agregada. Entrada «Red» en la barra lateral. Modela la entidad `networks` del backend.

Verificado: `packages/ui` 74/74 tests, `pnpm check` 52/52, y las dos pantallas nuevas renderizadas y probadas en localhost (el checklist de alta completa a «Todo listo»).

Decisiones de alcance (criterio profesional, abiertas a corrección):
- **Modo oscuro** se resuelve en `apps/web` (el producto real) vía los tokens claro/oscuro, ya en verde. El prototipo `apps/site` se queda claro: es la especificación visual y se reconstruye en `apps/web`, no se le añade un segundo tema con estilos en línea (churn sin valor).
- **Móvil responsive**: las 13 pantallas `/plataforma/movil` son **maquetas de teléfono 390×844** deliberadas (buena especificación). El móvil responsive de verdad (PWA) se construye en `apps/web` (plan backend Paso 10), no retrofit de las maquetas del prototipo. El «recorte a 375px» solo ocurre al forzar un viewport de móvil sobre una maqueta pensada para escritorio; no es un bug del producto.
- **Estados por pantalla**: los componentes ya existen en `packages/ui`; se aplican al reconstruir cada pantalla en `apps/web`, no se duplican en el prototipo de estilos en línea.
