# 0003 — Supabase Postgres con RLS como barrera de aislamiento

- **Estado:** propuesto (pendiente de revisión humana de las políticas RLS)
- **Fecha:** 2026-09-29
- **Secciones del MANUAL afectadas:** §4.1, §4.2, §4.4, §10.2, §13, §14

## Contexto
La plataforma es multi-tenant (organización → región → local) y la autorización tiene que vivir en la base de datos (MANUAL §10.2). Un fallo en la capa de API no puede exponer datos de otra organización ni de otro local. La primera migración (tarea 2 de la Fase 0) fija el patrón que heredarán todas las tablas con datos de cliente.

## Decisión
1. **RLS activado y forzado** (`enable` + `force row level security`) en todas las tablas de `public`. `anon` no tiene privilegios sobre ellas.
2. **El acceso se deriva de `memberships`** (rol + `scope_region_ids[]` + `scope_location_ids[]`). La coherencia entre rol y alcance se garantiza con un CHECK: `org_admin` sin alcance, `region_manager` solo con regiones, `location_manager`/`staff` solo con locales.
3. **Helpers `security definer` en un esquema `private`** que la API no expone (`has_org_role`, `can_access_location`, `can_access_region`, `can_see_membership`, `can_see_user`). Todos:
   - se anclan en `auth.uid()` del llamante,
   - fijan `search_path = ''`,
   - solo pueden ejecutarlos `authenticated` y `service_role`.
   Así las políticas leen `memberships` sin recursión y la lógica de acceso vive en un solo sitio.
4. **Integridad entre tenants con la propia base de datos, no solo con RLS:**
   - FK compuesta `locations (organization_id, region_id) → regions (organization_id, id)`.
   - Trigger que exige que los ids de alcance de una membership pertenezcan a su organización.
5. **Escritura de la estructura** (regiones, locales, memberships, datos de la organización): solo `org_admin`. El alta y la baja de organizaciones no tienen política: las hace la plataforma con la service role.
6. **Pruebas:**
   - pgTAP con un fixture de dos organizaciones y un usuario por rol, en `packages/db/supabase/tests/database`.
   - Un test estructural genérico que falla si una tabla nueva de `public` no tiene RLS activado y forzado, alguna política y los privilegios de `anon` revocados.
   - Todo corre en CI.

## Alternativas consideradas
- **Políticas con subconsultas directas a `memberships`:** provocan recursión infinita en las políticas de la propia `memberships` y duplican la lógica en cada tabla.
- **Claims personalizados en el JWT** (rol y alcances dentro del token): evitan consultas, pero el alcance queda obsoleto hasta que se renueva el token. Se puede reconsiderar si el rendimiento lo exige, manteniendo RLS como barrera.
- **Filtrado solo en la API:** descartado por el MANUAL §4.4 (RLS es la barrera real).

## Consecuencias
- Toda tabla nueva con datos de cliente debe llevar `organization_id` y (cuando aplique) `location_id`, y reutilizar estos helpers en sus políticas. El test estructural lo vigila.
- Los helpers se evalúan por fila. Con volúmenes grandes habrá que medirlo con `EXPLAIN ANALYZE` y, si hace falta, cambiar a helpers que devuelvan los ids accesibles una sola vez por consulta.
- Un `org_admin` puede quitarse su propia membership y dejar la organización sin administrador. La recuperación la hace la plataforma. Queda pendiente decidir si se bloquea.
- Visibilidad de personas: un `location_manager` ve las memberships y los perfiles que comparten local con él; un `staff` solo se ve a sí mismo. Es una decisión de producto que conviene revisar.

## Verificación
- `supabase test db`: 69 tests en 4 archivos, en verde.
- Prueba negativa 1: borrar `locations_select` hace fallar 7 tests.
- Prueba negativa 2: sustituirla por `using (true)` hace fallar 10 tests, entre ellos los de aislamiento A/B.
- Tras restaurar (`supabase db reset`), otra vez en verde.
- El rollback `supabase/rollbacks/20260929105448_tenants_rls.down.sql` se probó en local: deja 0 tablas en `public`, y la migración se vuelve a aplicar sin errores.
- `supabase db lint --fail-on warning`: sin errores.
- Evidencia completa en el PR de la tarea 2.
