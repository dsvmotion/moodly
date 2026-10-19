# Auditoría completa del prototipo — flujos, rutas y pantallas

Fecha: 2026-10-19 · Autor: diseño (Claude) · Sustituye a
[`2026-10-14-auditoria-rutas-interaccion.md`](2026-10-14-auditoria-rutas-interaccion.md), que
se quedaba corta (ver §1).

Motivo: en «Mis agentes» solo se veía Recepción y no se podía cambiar de agente. Producto
pidió arreglarlo **todo** y auditar de nuevo flujos, rutas y pantallas para que cada pantalla
tenga sentido, esté bien enrutada y no queden fallos evitables antes del backend.

---

## 1. Por qué la auditoría anterior no bastaba

La del 14-oct concluyó «0 pestañas estáticas» porque solo buscaba `role="tab"`. La mayoría de
selectores del prototipo eran **`<span>` con aspecto de botón**, que esa búsqueda no veía.
Además, al cablear la navegación ese día **introduje** un fallo (cada conversación llevaba a
`/tomar`, que siempre muestra a Laura). Esta auditoría busca por **comportamiento**, no por
etiqueta, y se verifica en el navegador.

## 2. Qué se encontró — 6 clases de fallo

| Clase | Ejemplos | Causa raíz |
|---|---|---|
| **Seleccionar no cambia el detalle** | Mis agentes (solo Recepción); Clientes, Llamadas y Conversaciones (la ficha no cambiaba al elegir otra fila) | Los datos traían **una sola** ficha por sede |
| **Selectores falsos** (`<span>` que parecen filtros) | Clientes, Conversaciones, Leads, Facturas (×2), Informes, Chats/Clientes/Informes móvil | Maquetados como texto, sin estado |
| **Desplegables falsos** («… ⌄» que no abren) | Agenda (profesional), Informes (rango, agrupar), Horarios, General (retención), Equipo (rol ×3), Reglas (aprobador), Inicio móvil y Más (sede) | Igual |
| **Flujo que abre otra entidad** | Probar/Publicar/Voz/Techo con agente fijo; `/privacidad` siempre «Laura»; aprobación «ficha completa» siempre la factura; conversaciones → Laura | Pantallas sin parámetro de entrada |
| **Datos incoherentes entre pantallas** | 4 sedes en Ajustes vs 2 en todo lo demás (y «Sede Sur» inventada); Comercial «Pausado» en Inicio y «Activo» en su ficha; Calendar «Conectado» vs «en error»; factura de Laura F-0101 42,71 € vs F-0412 75 €; KPI «6 por aprobar» con 4 filas; Informes móvil ≠ escritorio; contador móvil «3» fijo; colores de agente distintos en 3 pantallas | Datos copiados a mano en cada pantalla |
| **Entradas mal enrutadas** | «Añadir agente» → onboarding de la empresa; 3 de 4 agentes en Inicio con `href="#"`; Aprobaciones sin sede | Enlaces provisionales |

## 3. Qué se cambió

**Una fuente de datos** (`components/sede-data.js`), con ficha propia por elemento:
`clientDetail()`, `convDetail()` + `convStatus()`, `callsFor()`, `approvalsFor()`; segmentos
por cliente, estado por factura, inventario por sede, origen en todas las tarjetas de lead.
Inicio, menú, Aprobaciones, Sedes y móvil leen las mismas aprobaciones; escritorio y móvil, los
mismos informes.

**Componentes compartidos nuevos:**
- `Pills` — filtros y periodos accesibles (`<button aria-pressed>`), sustituye a los `<span>`.
- `useAgentParam` (`agent-param.js`) — los flujos de agente abren el agente desde el que llegas.
- `MobileFrame` + `ApprovalsBadge` — marco móvil único con el contador real de la sede.
- `SedeName` / `SedeCycle` / `SedeSelect` — controles de sede para pantallas estáticas.

**Contrato de navegación por URL** (todos verificados):

| Parámetro | Abre | Lo envían |
|---|---|---|
| `?a=` agente | `/agente`, `/probar`, `/publicar`, `/voz`, `/autonomia` | Inicio, Informes, Mis agentes, Nuevo agente |
| `?c=` cliente/conversación | `/clientes`, `/conversaciones`, `/privacidad`, `/movil/conversacion` | Llamadas, Leads, Conversaciones, Clientes, Chats |
| `?i=` aprobación | `/aprobaciones` | Inicio, Conversaciones, Facturas, Agenda |
| `?prov=` `?byoc=` | `/byok` | Proveedores |

**Pantallas** (36 archivos): todas las de §2 corregidas. Destacan: Conversaciones vuelve a ser
maestro-detalle (y «Tomar el control» gana la confirmación y el mensaje de sistema que solo
tenía `/tomar`); `/tomar` entra ahora por un aviso urgente en Inicio; Leads tiene panel de
detalle y «mover de etapa»; Facturas, vista Inventario real y aprobación por fila/en bloque;
Agenda navega por semanas y filtra por profesional; Informes, periodo real que fija también la
granularidad del gráfico.

## 4. Cómo se verificó

1. **Auditoría estática** — [`apps/site/scripts/audit-prototipo.py`](../../apps/site/scripts/audit-prototipo.py)
   (`python3 apps/site/scripts/audit-prototipo.py apps/site/src`): 63 pantallas, **0** rutas
   rotas, **0** `href="#"` sin respuesta, **0** selectores o desplegables falsos, **0**
   parámetros sin lector (11 enlaces con parámetro), **0** sedes inventadas, **0** contadores
   fijos. Sale con código 0.
2. **Build** — `pnpm --filter @repo/site build`: compila y prerenderiza **137/137** páginas.
3. **10 recorridos en el navegador**, clicando: Inicio → Comercial (abre Comercial, *Pausado*);
   sus 4 flujos abren Comercial; Revisar → su aprobación; Clientes (filtros, buscador, Pedro →
   su ficha → su RGPD → vuelta); Conversaciones (filtros, Ana/Pedro con su hilo, CRM y
   aprobación; tomar el control con confirmación; marcar resuelta); Llamadas → ficha de Jorge
   con esa misma llamada en su historial; Leads (origen, panel, mover etapa); Facturas (KPI =
   tabla, aprobar en bloque, inventario); Agenda e Informes; cambio a Sede Norte (menú 2,
   sus aprobaciones, sus llamadas, Sedes coherente); móvil (sede, interruptores, chat de Pedro).
4. **Barrido de humo** de las 63 pantallas: todas cargan con su título y contenido; consola
   sin errores en las pantallas reescritas; log del servidor sin errores.

## 5. Lo que sigue siendo demostrativo (a propósito)

- **91 acciones `data-demo`** (Guardar, Exportar, PDF, Invitar, Llamar de vuelta…): responden
  con un aviso contextual (`DemoActions`). Escriben datos, así que son trabajo de backend.
- El **estado de cada pantalla es local**: aprobar en Inicio no reduce el contador del menú;
  mover un lead no persiste al recargar. Coherente dentro de la pantalla; persistirlo es backend.
- **Otras semanas de la agenda** reutilizan las citas de la demo recolocadas.

## 6. Decisiones para producto

1. **Nº de sedes de la organización demo.** Lo he dejado en **2** (Centro y Norte), que es lo
   que usaban el selector, los datos y la memoria del negocio. Ajustes → Sedes mostraba 4
   (Playa, Universidad). Si la demo debe enseñar una cadena de 4, hay que dar datos a las otras
   2 en todas las pantallas (≈1 jornada).
2. **`/tomar` y `/revisar`** quedan como vistas a pantalla completa de un caso concreto
   (aviso urgente; factura). Alternativa: hacerlas también paramétricas.
3. **Script de auditoría como comando oficial**: hoy se ejecuta a mano. Para que lo corra el CI
   hay que añadirlo a `package.json`/CI y a `CLAUDE.md` (zonas que requieren revisión humana).
