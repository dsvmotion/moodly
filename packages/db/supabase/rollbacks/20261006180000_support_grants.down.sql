-- Vuelta atrás de 20261006180000_support_grants.sql: devuelve las políticas
-- del equipo interno a la lectura permanente (sin permiso ni MFA) y elimina
-- support_grants y sus funciones. Las filas de audit_logs que dejaron los
-- permisos se conservan (solo inserción).
-- OJO: vuelve a dar al equipo interno lectura de todos los clientes. No
-- aplicar en un entorno alojado sin cerrar antes el acceso a /ops.
-- Aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

alter policy organizations_select_platform_staff on public.organizations
  using ((select private.session_is_active()) and (select private.is_platform_staff()));
alter policy regions_select_platform_staff on public.regions
  using ((select private.session_is_active()) and (select private.is_platform_staff()));
alter policy locations_select_platform_staff on public.locations
  using ((select private.session_is_active()) and (select private.is_platform_staff()));
alter policy memberships_select_platform_staff on public.memberships
  using ((select private.session_is_active()) and (select private.is_platform_staff()));
alter policy users_select_platform_staff on public.users
  using ((select private.session_is_active()) and (select private.is_platform_staff()));
alter policy audit_logs_select_platform_staff on public.audit_logs
  using ((select private.session_is_active()) and (select private.is_platform_staff()));

drop table if exists public.support_grants;
drop function if exists private.audit_support_grants();
drop function if exists private.guard_support_grants();
drop function if exists private.staff_can_read(uuid);
drop function if exists private.is_staff_user(uuid, boolean);
drop function if exists private.session_is_aal2();

commit;
