-- MFA obligatorio para administrar (revisión de seguridad 2026-10-20, hallazgo
-- 2.3; auditoría backend P0-6). Toda escritura como org_admin exige una sesión
-- aal2 (contraseña + segundo factor). También las inserciones del equipo interno
-- en audit_logs, que ya solo puede leer con aal2 (20261006180000_support_grants).
--
-- - Leer no cambia: un org_admin con sesión aal1 sigue viendo su organización;
--   cualquier cambio falla por RLS hasta que complete el paso de MFA.
-- - Los managers (region_manager, location_manager) siguen pudiendo cambiar sus
--   locales con aal1: el requisito es para quien administra la organización.
-- - session_is_aal2() lee el claim aal del JWT, que firma Supabase Auth: solo
--   vale aal2 después de verificar un factor.
--
-- Se conservan nombres, comandos y roles (ALTER POLICY); solo cambia la expresión.
-- Vuelta atrás: supabase/rollbacks/20261022120000_admin_mfa.down.sql

-- organizations
alter policy organizations_update on public.organizations
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(id, array['org_admin']));

-- regions
alter policy regions_insert on public.regions
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));
alter policy regions_update on public.regions
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

-- locations: el org_admin, con aal2; los managers de ese local, como antes.
alter policy locations_insert on public.locations
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));
alter policy locations_update on public.locations
  using ((select private.session_is_active())
         and (private.can_access_location(organization_id, id, array['region_manager', 'location_manager'])
              or ((select private.session_is_aal2())
                  and private.can_access_location(organization_id, id, array['org_admin']))))
  with check ((select private.session_is_active())
              and (private.can_access_location(organization_id, id, array['region_manager', 'location_manager'])
                   or ((select private.session_is_aal2())
                       and private.can_access_location(organization_id, id, array['org_admin']))));

-- memberships (el alta es por invitación: 20261022090000_invitations)
alter policy memberships_update on public.memberships
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));
alter policy memberships_delete on public.memberships
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']));

-- invitations: ver las pendientes sigue sin pedir MFA; crear y revocar, sí.
alter policy invitations_insert on public.invitations
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin'])
              and invited_by = (select auth.uid()));
alter policy invitations_update on public.invitations
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

-- audit_logs: el equipo interno solo escribe con MFA, igual que lee.
alter policy audit_logs_insert_platform_staff on public.audit_logs
  with check (
    (select private.session_is_active())
    and (select private.session_is_aal2())
    and (select private.is_platform_staff())
    and actor_type = 'platform_staff'
    and actor_id = (select auth.uid())
  );
