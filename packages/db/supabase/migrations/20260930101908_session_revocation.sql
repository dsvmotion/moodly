-- Revocación real de sesiones (tarea 3c-1; ADR 0003).
-- Tras cerrar sesión, el access token (JWT) sigue siendo criptográficamente
-- válido hasta que caduca (jwt_expiry): Supabase Auth borra la sesión de
-- auth.sessions pero no puede "des-firmar" el token. Sin esta comprobación,
-- un token copiado antes del logout seguía leyendo datos por la API REST.
-- Supabase documenta la solución: comprobar que el session_id del JWT sigue
-- existiendo en auth.sessions.
-- Vuelta atrás: supabase/rollbacks/20260930101908_session_revocation.down.sql

-- ¿La sesión del JWT actual sigue viva? No depende de columnas de la fila:
-- las políticas la usan como (select private.session_is_active()) y Postgres
-- la evalúa una sola vez por consulta (InitPlan), no una vez por fila.
-- Security definer para leer auth.sessions/auth.users (authenticated no
-- puede); solo lee, y se ancla en el sub y el session_id del propio JWT.
create function private.session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    -- Un session_id ausente o mal formado cuenta como "sin sesión": se valida
    -- el formato antes del cast para no depender de si el planificador llega
    -- a evaluarlo (fallo cerrado y determinista, sin error).
    where s.id = (
        select case
          when claim ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then claim::uuid
        end
        from (select (select auth.jwt()) ->> 'session_id' as claim) as jwt
      )
      and s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

revoke all on function private.session_is_active() from public;
grant execute on function private.session_is_active() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Todas las políticas de las 5 tablas de tenants exigen sesión viva. Se
-- conservan nombres, comandos y roles (ALTER POLICY); solo cambia la expresión.
-- ---------------------------------------------------------------------------

-- organizations
alter policy organizations_select on public.organizations
  using ((select private.session_is_active()) and private.has_org_role(id));
alter policy organizations_update on public.organizations
  using ((select private.session_is_active()) and private.has_org_role(id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(id, array['org_admin']));

-- regions
alter policy regions_select on public.regions
  using ((select private.session_is_active()) and private.can_access_region(organization_id, id));
alter policy regions_insert on public.regions
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy regions_update on public.regions
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

-- locations
alter policy locations_select on public.locations
  using ((select private.session_is_active()) and private.can_access_location(organization_id, id));
alter policy locations_insert on public.locations
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy locations_update on public.locations
  using ((select private.session_is_active())
         and private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']))
  with check ((select private.session_is_active())
              and private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']));

-- users (perfiles)
alter policy users_select on public.users
  using ((select private.session_is_active()) and private.can_see_user(id));
alter policy users_insert_self on public.users
  with check ((select private.session_is_active()) and id = (select auth.uid()));
alter policy users_update_self on public.users
  using ((select private.session_is_active()) and id = (select auth.uid()))
  with check ((select private.session_is_active()) and id = (select auth.uid()));

-- memberships
alter policy memberships_select on public.memberships
  using ((select private.session_is_active())
         and private.can_see_membership(organization_id, user_id, role, scope_region_ids, scope_location_ids));
alter policy memberships_insert on public.memberships
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy memberships_update on public.memberships
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
alter policy memberships_delete on public.memberships
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
