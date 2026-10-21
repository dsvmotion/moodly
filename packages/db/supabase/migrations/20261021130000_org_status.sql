-- Organizaciones suspendidas o archivadas (auditoría backend 2026-10-21, P0-2).
-- organizations.status existía, pero ninguna política lo consultaba: un
-- miembro de una organización 'suspended' seguía leyendo y escribiendo todo
-- (comprobado en local). Ahora los helpers de RLS solo conceden acceso si la
-- organización está 'active'. Se toca en un único sitio (los helpers), así
-- que cubre todas las políticas actuales y las futuras que los usen.
--
-- Lo único que sigue viendo un miembro de una organización no activa es su
-- propio perfil y su propia membership: la app los necesita para mostrar
-- «organización suspendida» en vez de una pantalla vacía.
--
-- Cambiar organizations.status sigue siendo solo de la plataforma
-- (guard_organization_fields).
-- Vuelta atrás: supabase/rollbacks/20261021130000_org_status.down.sql

-- ¿La organización está activa? Security definer para leer organizations sin
-- pasar por su propia política (que a su vez usa estos helpers).
create function private.org_is_active(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org and o.status = 'active'
  );
$$;

revoke all on function private.org_is_active(uuid) from public;
grant execute on function private.org_is_active(uuid) to authenticated, service_role;

create or replace function private.has_org_role(p_org uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_is_active(p_org)
    and exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = p_org
        and (p_roles is null or m.role = any (p_roles))
    );
$$;

create or replace function private.can_access_location(p_org uuid, p_location uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_is_active(p_org)
    and exists (
      select 1
      from public.memberships m
      join public.locations l
        on l.id = p_location
       and l.organization_id = m.organization_id
      where m.user_id = (select auth.uid())
        and m.organization_id = p_org
        and (p_roles is null or m.role = any (p_roles))
        and (
          m.role = 'org_admin'
          or (m.role = 'region_manager' and l.region_id = any (m.scope_region_ids))
          or (m.role in ('location_manager', 'staff') and l.id = any (m.scope_location_ids))
        )
    );
$$;

create or replace function private.can_access_region(p_org uuid, p_region uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_is_active(p_org)
    and exists (
      select 1
      from public.memberships m
      join public.regions r
        on r.id = p_region
       and r.organization_id = m.organization_id
      where m.user_id = (select auth.uid())
        and m.organization_id = p_org
        and (
          m.role = 'org_admin'
          or (m.role = 'region_manager' and r.id = any (m.scope_region_ids))
          or (
            m.role in ('location_manager', 'staff')
            and exists (
              select 1 from public.locations l
              where l.organization_id = m.organization_id
                and l.region_id = r.id
                and l.id = any (m.scope_location_ids)
            )
          )
        )
    );
$$;

-- La propia membership sigue visible; las de los demás, solo con la
-- organización activa.
create or replace function private.can_see_membership(
  p_org uuid,
  p_user uuid,
  p_role text,
  p_region_ids uuid[],
  p_location_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid())
    or (
      private.org_is_active(p_org)
      and exists (
        select 1
        from public.memberships viewer
        where viewer.user_id = (select auth.uid())
          and viewer.organization_id = p_org
          and (
            p_role = 'org_admin'
            or viewer.role = 'org_admin'
            or (
              viewer.role = 'region_manager'
              and (
                p_region_ids && viewer.scope_region_ids
                or exists (
                  select 1 from public.locations l
                  where l.organization_id = p_org
                    and l.id = any (p_location_ids)
                    and l.region_id = any (viewer.scope_region_ids)
                )
              )
            )
            or (viewer.role in ('location_manager', 'staff') and p_location_ids && viewer.scope_location_ids)
          )
      )
    );
$$;
