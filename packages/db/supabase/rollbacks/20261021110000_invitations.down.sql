-- Vuelta atrás de 20261021110000_invitations.sql: devuelve a los org_admin el
-- alta directa de memberships (con la misma expresión que tenía tras
-- 20260930101908_session_revocation) y elimina las invitaciones. Las
-- memberships creadas al aceptar invitaciones se conservan. Antes, desplegar
-- una versión de la app sin invitaciones. Aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

drop function if exists public.accept_invitation(text);
drop function if exists public.create_invitation(uuid, text, text, uuid[], uuid[]);
drop table if exists public.invitations;
drop function if exists private.guard_invitation_update();

commit;
