# Auditoría de rutas e interacción del prototipo

> **Sustituida por [`2026-10-19-auditoria-completa-prototipo.md`](2026-10-19-auditoria-completa-prototipo.md).** Esta revisión solo buscaba `role="tab"` y no detectó los selectores hechos con `<span>`; su conclusión de «0 pestañas estáticas» era incompleta.

Fecha: 2026-10-14 · Autor: diseño (Claude) · Motivo: en «Mis agentes» solo se veía un
agente fijo (Recepción) sin poder cambiar. Barrido para que cada pantalla «tenga sentido y
esté bien enrutada» y no haya fallos evitables antes de backend.

## Qué revisé

1. **Selectores/pestañas que parecen interactivos pero no cambian** (el bug del agente).
2. **Enlaces internos a rutas inexistentes** (404 evitables).
3. **Puntos de entrada** a cada flujo (cableado de navegación).

## Resultado

| Comprobación | Resultado |
|---|---|
| Enlaces internos (`/plataforma/*`) a rutas que no existen | **0 de 40** — ningún 404 |
| Pestañas `role="tab"` estáticas que no cambian | **0** tras corregir el agente |
| Selector de agente en «Mis agentes» | **Corregido** — ahora cambia entre los 4 |

## Bug corregido: selector de agentes

`/plataforma/agente` estaba cableado a Recepción con datos fijos y pestañas que no
cambiaban. Reescrito con un **selector de agente** (Recepción · Atención · Comercial ·
Administración + «Nuevo agente»): al elegir, cambian color, subtítulo, **skills**, tono y
ejemplo. Verificado en navegador.

## Tres niveles de interacción (cómo leer el prototipo)

Para que no haya sorpresas, cada elemento es una de estas tres cosas:

- **Navega** — enlaces entre secciones y a los flujos. **Funciona** (0 enlaces rotos).
- **Selecciona** — cambiar de entidad o de estado dentro de una pantalla: agente (✓ nuevo),
  sede (✓ `use-sede`), listas de aprobaciones (✓), pestañas de Modelos (✓), toggles de
  skills (✓), política de residencia (✓), etc.
- **Placeholder (demo)** — afordances de **acción por registro** que hoy no hacen nada porque
  necesitan backend: «Editar», «Descargar PDF», «Exportar», «Guardar cambios», «Método de
  pago», y abrir el **detalle de un registro** (una llamada, una ficha de cliente, una
  factura). Son intencionales, no bugs; se activan en la fase backend con datos reales.

## Lo que queda como placeholder intencional (y por qué)

- **Detalle de registro**: clic en una fila de Clientes, Llamadas, Leads o Facturas. No hay
  pantalla de ficha individual porque es una vista sobre datos reales (fase backend). Hoy la
  fila es demostrativa. Opciones: (a) dejarlo así hasta backend, o (b) diseñar las fichas de
  detalle ahora como especificación (≈4–6 pantallas nuevas).
- **Acciones por registro** (Editar/PDF/Exportar/Guardar): se conectan con el backend.

## Recomendación

El prototipo ya es **recorrible y coherente**: navegación sin dead-ends, y los selectores que
deben cambiar, cambian. Lo que falta son **fichas de detalle de registro** y las acciones que
escriben datos — ambas son naturales de la fase backend. Decisión de producto: diseñar ahora
las fichas de detalle como spec, o cerrarlas con el backend.
