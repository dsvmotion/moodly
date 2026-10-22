-- Vuelta atrás de 20261022120000_admin_mfa.sql: las escrituras de org_admin y
-- las inserciones del equipo interno en audit_logs vuelven a no exigir aal2
-- (mismas expresiones que tras 20260930101908_session_revocation,
-- 20261006170108_platform_staff_audit y 20261022090000_invitations).
-- Antes, desplegar una versión de la app que no dependa del requisito.
-- Aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

alter policy organizations_update on public.organizations
  using ((select private.session_is_active()) and private.has_org_role(id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(id, array['org_admin']));

alter policy regions_insert on public.regions
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy regions_update on public.regions
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

alter policy locations_insert on public.locations
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy locations_update on public.locations
  using ((select private.session_is_active())
         and private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']))
  with check ((select private.session_is_active())
              and private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']));

alter policy memberships_update on public.memberships
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy memberships_delete on public.memberships
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

alter policy invitations_insert on public.invitations
  with check ((select private.session_is_active())
              and private.has_org_role(organization_id, array['org_admin'])
              and invited_by = (select auth.uid()));
alter policy invitations_update on public.invitations
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

alter policy audit_logs_insert_platform_staff on public.audit_logs
  with check (
    (select private.session_is_active())
    and (select private.is_platform_staff())
    and actor_type = 'platform_staff'
    and actor_id = (select auth.uid())
  );

commit;
