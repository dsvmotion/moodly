-- Tenants y RLS (MANUAL §4.1, §4.2, §4.4).
-- Jerarquía: organization → region (opcional) → location.
-- Acceso de usuarios vía memberships: rol + alcance de regiones y locales.
-- Vuelta atrás: supabase/rollbacks/20260929105448_tenants_rls.down.sql

-- ---------------------------------------------------------------------------
-- Esquema privado: helpers de RLS y triggers. No se expone en la API
-- (config.toml → api.schemas solo incluye public y graphql_public).
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  kind           text not null default 'business' check (kind in ('business', 'personal')),
  vertical       text,
  plan           text,
  contract_type  text not null default 'smb' check (contract_type in ('smb', 'enterprise')),
  default_locale text not null default 'es-ES',
  data_region    text not null default 'eu',
  status         text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.regions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Destino de la FK compuesta de locations: impide colgar un local
  -- de una región de otra organización.
  unique (organization_id, id)
);

create table public.locations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  region_id       uuid,
  name            text not null check (length(trim(name)) > 0),
  address         text,
  timezone        text not null default 'Europe/Madrid',
  opening_hours   jsonb not null default '{}'::jsonb,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, region_id)
    references public.regions (organization_id, id) on delete restrict
);

-- Perfil de aplicación vinculado 1:1 a auth.users.
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  locale     text not null default 'es-ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  role               text not null check (role in ('org_admin', 'region_manager', 'location_manager', 'staff')),
  scope_region_ids   uuid[] not null default '{}',
  scope_location_ids uuid[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, organization_id),
  -- Coherencia rol ↔ alcance: org_admin ve toda la organización;
  -- region_manager se acota por regiones; location_manager y staff por locales.
  constraint memberships_scope_matches_role check (
    case role
      when 'org_admin'        then cardinality(scope_region_ids) = 0 and cardinality(scope_location_ids) = 0
      when 'region_manager'   then cardinality(scope_region_ids) > 0 and cardinality(scope_location_ids) = 0
      else                         cardinality(scope_region_ids) = 0 and cardinality(scope_location_ids) > 0
    end
  )
);

-- Índices para FKs y para las búsquedas de los helpers de RLS. Ya cubiertos
-- por unique: regions (organization_id, id) y memberships (user_id,
-- organization_id), que es la búsqueda de todos los helpers.
create index locations_organization_id_idx    on public.locations (organization_id, region_id);
create index memberships_organization_id_idx  on public.memberships (organization_id);

create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.regions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.locations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.users
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();

-- Los ids de alcance deben pertenecer a la misma organización que la membership.
-- Los arrays no admiten FK, así que se valida con trigger. Es security definer
-- para comprobar contra los datos reales y no contra lo que RLS deja ver.
create function private.validate_membership_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(new.scope_region_ids) as s(id)
    where not exists (
      select 1 from public.regions r
      where r.id = s.id and r.organization_id = new.organization_id
    )
  ) then
    raise exception 'scope_region_ids contiene regiones ajenas a la organización %', new.organization_id
      using errcode = '23503';
  end if;

  if exists (
    select 1 from unnest(new.scope_location_ids) as s(id)
    where not exists (
      select 1 from public.locations l
      where l.id = s.id and l.organization_id = new.organization_id
    )
  ) then
    raise exception 'scope_location_ids contiene locales ajenos a la organización %', new.organization_id
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_membership_scope() from public;

create trigger validate_scope before insert or update on public.memberships
  for each row execute function private.validate_membership_scope();

-- ---------------------------------------------------------------------------
-- Helpers de RLS (security definer: leen memberships sin disparar sus propias
-- políticas y evitan recursión). Todos se anclan en auth.uid() del llamante.
-- ---------------------------------------------------------------------------

-- ¿El usuario actual tiene alguno de estos roles en la organización?
-- p_roles null = cualquier rol (basta con ser miembro).
create function private.has_org_role(p_org uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = p_org
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

-- ¿El usuario actual tiene este local en su alcance?
-- p_roles null = cualquier rol (ver); con roles, solo si su rol está en la lista
-- (p. ej. gestionar = org_admin, region_manager o location_manager).
create function private.can_access_location(p_org uuid, p_location uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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

-- ¿El usuario actual puede ver esta región? Un location_manager/staff ve
-- la región a la que pertenece su local (solo el nombre de la agrupación).
create function private.can_access_region(p_org uuid, p_region uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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

-- ¿El usuario actual puede ver la membership (p_org, p_user, p_role, alcance)?
-- - La propia: siempre.
-- - Las de los org_admin de su organización: cualquier miembro (a quién escalar).
-- - org_admin: todas las de su organización.
-- - region_manager: las que tocan sus regiones o locales de sus regiones.
-- - location_manager y staff: las que comparten algún local con él
--   (compañeros a los que pasar una conversación o asignar una tarea).
create function private.can_see_membership(
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
    or exists (
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
    );
$$;

-- ¿El usuario actual puede ver el perfil de p_user? Sí si es él mismo o si
-- puede ver alguna de sus memberships.
create function private.can_see_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid())
    or exists (
      select 1
      from public.memberships m
      where m.user_id = p_user
        and private.can_see_membership(m.organization_id, m.user_id, m.role, m.scope_region_ids, m.scope_location_ids)
    );
$$;

revoke all on function private.has_org_role(uuid, text[])                     from public;
revoke all on function private.can_access_location(uuid, uuid, text[])                from public;
revoke all on function private.can_access_region(uuid, uuid)                  from public;
revoke all on function private.can_see_membership(uuid, uuid, text, uuid[], uuid[]) from public;
revoke all on function private.can_see_user(uuid)                             from public;
grant execute on function private.has_org_role(uuid, text[])                     to authenticated, service_role;
grant execute on function private.can_access_location(uuid, uuid, text[])                to authenticated, service_role;
grant execute on function private.can_access_region(uuid, uuid)                  to authenticated, service_role;
grant execute on function private.can_see_membership(uuid, uuid, text, uuid[], uuid[]) to authenticated, service_role;
grant execute on function private.can_see_user(uuid)                             to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Guardas de negocio para usuarios de la app. Solo actúan cuando quien
-- escribe es el rol authenticated: la plataforma (service role, migraciones,
-- cascadas de auth) no queda bloqueada.
-- ---------------------------------------------------------------------------

-- Los managers editan la operativa de sus locales (horario, dirección, zona
-- horaria, estado); nombre, organización y región solo los cambia el org_admin.
create function private.guard_location_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (new.organization_id, new.region_id, new.name) is distinct from (old.organization_id, old.region_id, old.name)
     and not private.has_org_role(old.organization_id, array['org_admin'])
  then
    raise exception 'solo un org_admin puede cambiar el nombre, la organización o la región de un local'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_location_structure() from public;

create trigger guard_structure before update on public.locations
  for each row execute function private.guard_location_structure();

-- Una organización nunca se queda sin org_admin por acción de sus usuarios.
-- El bloqueo consultivo por organización serializa bajas simultáneas (dos
-- admins degradándose a la vez); cada consulta posterior ve lo ya confirmado.
create function private.guard_last_org_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and old.role = 'org_admin'
     and (tg_op = 'DELETE' or new.role <> 'org_admin' or new.organization_id <> old.organization_id)
  then
    perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text, 0));
    if not exists (
      select 1 from public.memberships m
      where m.organization_id = old.organization_id
        and m.role = 'org_admin'
        and m.id <> old.id
    ) then
      raise exception 'la organización % se quedaría sin org_admin', old.organization_id
        using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.guard_last_org_admin() from public;

create trigger guard_last_admin before update or delete on public.memberships
  for each row execute function private.guard_last_org_admin();

-- ---------------------------------------------------------------------------
-- RLS: activado y forzado en todas las tablas. anon no tiene acceso.
-- Alta y baja de organizaciones: solo plataforma (service role), sin política.
-- Regiones y locales no se borran desde la app (sin política de delete): se
-- desactivan con status. El borrado físico (RGPD) lo hace la plataforma.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.regions       enable row level security;
alter table public.locations     enable row level security;
alter table public.users         enable row level security;
alter table public.memberships   enable row level security;

alter table public.organizations force row level security;
alter table public.regions       force row level security;
alter table public.locations     force row level security;
alter table public.users         force row level security;
alter table public.memberships   force row level security;

revoke all on public.organizations, public.regions, public.locations, public.users, public.memberships from anon;

-- organizations
create policy organizations_select on public.organizations
  for select to authenticated
  using (private.has_org_role(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (private.has_org_role(id, array['org_admin']))
  with check (private.has_org_role(id, array['org_admin']));

-- regions
create policy regions_select on public.regions
  for select to authenticated
  using (private.can_access_region(organization_id, id));

create policy regions_insert on public.regions
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['org_admin']));

create policy regions_update on public.regions
  for update to authenticated
  using (private.has_org_role(organization_id, array['org_admin']))
  with check (private.has_org_role(organization_id, array['org_admin']));

-- locations
create policy locations_select on public.locations
  for select to authenticated
  using (private.can_access_location(organization_id, id));

create policy locations_insert on public.locations
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['org_admin']));

-- Managers con el local en su alcance también; los campos estructurales los
-- protege el trigger guard_structure.
create policy locations_update on public.locations
  for update to authenticated
  using (private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']))
  with check (private.can_access_location(organization_id, id, array['org_admin', 'region_manager', 'location_manager']));

-- users (perfiles)
create policy users_select on public.users
  for select to authenticated
  using (private.can_see_user(id));

create policy users_insert_self on public.users
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memberships
create policy memberships_select on public.memberships
  for select to authenticated
  using (private.can_see_membership(organization_id, user_id, role, scope_region_ids, scope_location_ids));

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['org_admin']));

create policy memberships_update on public.memberships
  for update to authenticated
  using (private.has_org_role(organization_id, array['org_admin']))
  with check (private.has_org_role(organization_id, array['org_admin']));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (private.has_org_role(organization_id, array['org_admin']));
