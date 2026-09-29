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
5. **Escritura de la estructura:**
   - Crear regiones y locales, y gestionar memberships y los datos de la organización: solo `org_admin`.
   - `region_manager` y `location_manager` pueden editar la operativa de los locales de su alcance: horario, dirección, zona horaria y estado. Nombre, organización y región solo los cambia el `org_admin`; lo garantiza el trigger `guard_structure`, porque RLS no restringe columnas.
   - Regiones y locales no se borran desde la app: se desactivan con `status`. El borrado físico (RGPD) lo hace la plataforma.
   - El alta y la baja de organizaciones no tienen política: las hace la plataforma con la service role.
   - Un trigger con bloqueo consultivo por organización impide que una organización se quede sin `org_admin` por acción de sus usuarios. La plataforma no queda bloqueada.
6. **Visibilidad de personas:**
   - Cada uno ve su membership y su perfil, y los de los `org_admin` de su organización (a quién escalar).
   - `org_admin` ve a toda la organización.
   - `region_manager` ve a las personas de los locales de su región.
   - `location_manager` y `staff` ven a quien comparte local con ellos (para pasar conversaciones o asignar tareas).
   - Un `location_manager` o `staff` ve también el nombre de la región de su local.
7. **Pruebas:**
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
- Las guardas de negocio (estructura del local y último admin) solo actúan cuando escribe el rol `authenticated`. La plataforma (service role, migraciones, cascadas de `auth`) debe respetar esas reglas por su cuenta.
- Invitar staff desde el `location_manager` queda para la tarea 3 (auth e invitaciones).
- Supabase CLI fijado a 2.118.0 en local y en el CI.

## Verificación
- `supabase test db`: 86 tests en 4 archivos, en verde (CLI 2.118.0).
- Pruebas negativas, cada una restaurada después con `supabase db reset`:
  - Borrar `locations_select`: fallan 14 tests.
  - Sustituirla por `using (true)`: fallan 10, entre ellos los de aislamiento A/B.
  - Quitar el trigger del último admin: fallan 4.
  - Quitar el trigger de estructura: fallan 7.
- Tras restaurar: 86/86.
- El rollback `supabase/rollbacks/20260929105448_tenants_rls.down.sql` se probó en local: deja 0 tablas en `public`, y la migración se vuelve a aplicar sin errores.
- `supabase db lint --fail-on warning`: sin errores.
- Evidencia completa en el PR #2.
