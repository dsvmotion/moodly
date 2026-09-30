-- Vuelta atrás de 20260930101908_session_revocation.sql: devuelve las 15
-- políticas a su expresión anterior y elimina private.session_is_active().
-- No borra datos. Aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

alter policy organizations_select on public.organizations using (private.has_org_role(id));
alter policy organizations_update on public.organizations
  using (private.has_org_role(id, array['org_admin']))
  with check (private.has_org_role(id, array['org_admin']));

alter policy regions_select on public.regions using (private.can_access_region(organization_id, id));
alter policy regions_insert on public.regions with check (private.has_org_role(organization_id, array['org_admin']));
alter policy regions_update on public.regions
  using (private.has_org_role(organization_id, array['org_admin']))
  with check (private.has_org_role(organization_id, array['org_admin']));

alter policy locations_select on public.locations using (private.can_access_location(organization_id, id));
alter policy locations_insert on public.locations with check (private.has_org_role(organization_id, array['org_admin']));
alter policy locations_update on public.locations
  using (private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']))
  with check (private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']));

alter policy users_select on public.users using (private.can_see_user(id));
alter policy users_insert_self on public.users with check (id = (select auth.uid()));
alter policy users_update_self on public.users
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy memberships_select on public.memberships
  using (private.can_see_membership(organization_id, user_id, role, scope_region_ids, scope_location_ids));
alter policy memberships_insert on public.memberships with check (private.has_org_role(organization_id, array['org_admin']));
alter policy memberships_update on public.memberships
  using (private.has_org_role(organization_id, array['org_admin']))
  with check (private.has_org_role(organization_id, array['org_admin']));
alter policy memberships_delete on public.memberships using (private.has_org_role(organization_id, array['org_admin']));

drop function if exists private.session_is_active();

delete from supabase_migrations.schema_migrations where version = '20260930101908';

commit;
