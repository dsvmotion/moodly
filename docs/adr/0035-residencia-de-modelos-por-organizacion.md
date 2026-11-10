# 0035 — Residencia del procesamiento de modelos por organización

- **Estado:** aceptado (producto, 2026-10-30)
- **Cambiado en parte (producto, 2026-11-10; auditoría de preproducción §18.1 #6):** la residencia por defecto pasa de `any` a `eu`, con `us` como opción que elige el cliente. Lo fija el ADR de T6 del hito M0 (con su migración); hasta entonces, manda la decisión de producto (MANUAL §18.0).
- **Fecha:** 2026-10-30
- **Secciones del MANUAL afectadas:** §4 (`org_model_settings`), §11, §18 #5
- **Relación:**
  - concreta el ADR 0019 §1 (residencia como política por organización, sin cruzar la frontera en el respaldo);
  - recoge la decisión de producto del 2026-10-24 (cualquier proveedor con DPA por defecto; «Solo UE» como opción);
  - la aplica el enrutador del ADR 0033;
  - la tabla es la del 0034.

## Contexto

Hay dos residencias distintas y no deben mezclarse:
- **dónde se guardan los datos:** `organizations.data_region`, la UE para todos, la decide la plataforma;
- **dónde se procesa cada llamada a un modelo:** depende del proveedor y de la vía.

Producto decidió que por defecto vale cualquier proveedor con DPA y transferencias cubiertas, y que una organización puede pedir «Solo UE».

## Decisión

1. **`org_model_settings`** (una fila por organización, opcional; sin fila, la política de plataforma) guarda:
   - **`residency`:** `any` (por defecto) o `eu`;
   - **`allowed_providers`:** nombres en minúsculas, sin repetir, como mucho 20; vacía = cualquiera de los configurados;
   - **`model_by_task`:** solo claves lógicas de `@repo/config`, nunca un ID de proveedor. Los embeddings siempre con `embedding`, y nada más con ella;
   - **topes de gasto** por run y por día, con el del run nunca por encima del del día.
2. **Quién la gestiona:** la ve y la cambia el `org_admin`, con `aal2` para cambiarla, como todo lo que administra. El resto del equipo no la ve.
3. **Auditoría:** cada cambio, de la app o de la plataforma, queda en `audit_logs` con lo que cambió y quién lo hizo, o `system` si fue la plataforma. Un cambio que no cambia nada no deja rastro.
   - Lo escribe un trigger `SECURITY DEFINER` que solo inserta esa fila.
   - Quién hizo el cambio lo decide la guarda (`updated_by`), que ve el rol real.
4. **El enrutador la lee con `policyFromSettings()`**, que la valida otra vez; si algo no cuadra, falla en vez de adivinar. Con «Solo UE», ninguna llamada ni ningún respaldo sale de la región (ADR 0033).

## Alternativas consideradas

- **Reutilizar `organizations.data_region` para los modelos.** Mezcla dónde viven los datos con dónde se procesan, y no permite «datos en la UE, modelos con DPA donde convenga», que es lo que decidió producto.
- **Residencia por agente.** Más fina, pero nadie la ha pedido. Se puede añadir como override en la configuración heredada (D2) si un cliente la necesita.

## Consecuencias

- La pantalla Ajustes → Modelos (residencia, proveedores y topes) llega cuando haya proveedores activos.
- El informe de residencia (qué región procesó cada llamada) sale del registro de cada llamada del enrutador (`usage_records`, MANUAL §15).

## Verificación

- **pgTAP `23_model_settings_secrets`:**
  - quién la ve y quién la cambia (con y sin `aal2`, otra organización, location_manager y staff);
  - el formato cerrado;
  - que la app no cambia el modo de conexión ni `updated_by`;
  - la auditoría, de persona y de plataforma.

  7 mutaciones, todas detectadas.
- **`policyFromSettings`, 9 tests,** incluido uno que compara las tareas y claves que valida la base de datos con las de `@repo/config`.
