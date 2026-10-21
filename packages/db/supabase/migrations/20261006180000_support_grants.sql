-- Acceso del equipo interno a datos de clientes: solo con un permiso temporal,
-- motivo, MFA y auditoría en la base de datos (auditoría backend 2026-10-21,
-- P0-3; decisión D3 aprobada por producto; cierra D8 y D12 del ADR 0021).
--
-- Antes, cualquier interno no revocado leía todas las filas de todos los
-- clientes por la API REST, sin MFA, y la «fila de auditoría por vista» solo
-- la imponía la app: llamando a REST directamente no quedaba rastro.
--
-- Ahora, para leer los datos de una organización, el interno necesita a la vez:
--   - sesión viva (como siempre);
--   - MFA en esa sesión (aal2 en el JWT);
--   - un permiso vigente en public.support_grants para esa organización:
--     con motivo, caducidad de 8 h como máximo y revocable.
-- Crear o revocar un permiso escribe una fila en audit_logs en la misma
-- transacción. Solo un platform_admin con MFA concede o revoca.
-- Vuelta atrás: supabase/rollbacks/20261006180000_support_grants.down.sql

create table public.support_grants (
  id              uuid primary key default gen_random_uuid(),
  staff_user_id   uuid not null references public.platform_staff (user_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reason          text not null check (length(btrim(reason)) between 10 and 500),
  granted_by      uuid not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  constraint support_grants_window check (expires_at > created_at and expires_at <= created_at + interval '8 hours')
);

create index support_grants_staff_org_idx on public.support_grants (staff_user_id, organization_id, expires_at);
create index support_grants_organization_id_idx on public.support_grants (organization_id);

-- ¿La sesión actual tiene MFA (aal2)?
create function private.session_is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

revoke all on function private.session_is_aal2() from public;
grant execute on function private.session_is_aal2() to authenticated, service_role;

-- ¿El interno actual puede leer esta organización ahora? Interno no revocado,
-- MFA y un permiso vigente para ella. Security definer: lee platform_staff y
-- support_grants sin pasar por sus políticas; solo lee.
create function private.staff_can_read(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.session_is_aal2()
    and exists (
      select 1
      from public.support_grants g
      join public.platform_staff ps on ps.user_id = g.staff_user_id
      where g.staff_user_id = (select auth.uid())
        and g.organization_id = p_org
        and g.revoked_at is null
        and g.expires_at > now()
        and ps.revoked_at is null
    );
$$;

revoke all on function private.staff_can_read(uuid) from public;
grant execute on function private.staff_can_read(uuid) to authenticated, service_role;

-- ¿p_user es equipo interno? p_active_only: solo si no está revocado.
-- Security definer: platform_staff solo deja ver la propia fila por su política.
create function private.is_staff_user(p_user uuid, p_active_only boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = p_user and (not p_active_only or ps.revoked_at is null)
  );
$$;

revoke all on function private.is_staff_user(uuid, boolean) from public;
grant execute on function private.is_staff_user(uuid, boolean) to authenticated, service_role;

-- Fija quién concede y cuándo; solo se puede cambiar revoked_at (y una vez).
create function private.guard_support_grants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' then
      new.granted_by := (select auth.uid());
      new.created_at := now();
      new.revoked_at := null;
    end if;
    return new;
  end if;

  if current_user = 'authenticated'
     and ((to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at')
          or old.revoked_at is not null
          or new.revoked_at is null)
  then
    raise exception 'de un permiso de soporte solo se puede revocar (una vez)' using errcode = '42501';
  end if;
  if new.revoked_at is not null and old.revoked_at is null then
    new.revoked_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.guard_support_grants() from public;

create trigger guard before insert or update on public.support_grants
  for each row execute function private.guard_support_grants();

-- Auditoría en la misma transacción. Security invoker: la fila entra por la
-- política audit_logs_insert_platform_staff (actor = el propio interno).
create function private.audit_support_grants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target, metadata)
  values (
    new.organization_id,
    'platform_staff',
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'support_grant.created' else 'support_grant.revoked' end,
    jsonb_build_object('support_grant_id', new.id, 'staff_user_id', new.staff_user_id),
    jsonb_build_object('reason', new.reason, 'expires_at', new.expires_at)
  );
  return new;
end;
$$;

revoke all on function private.audit_support_grants() from public;

create trigger audit after insert or update of revoked_at on public.support_grants
  for each row execute function private.audit_support_grants();

alter table public.support_grants enable row level security;
alter table public.support_grants force row level security;
revoke all on public.support_grants from anon;
revoke delete, truncate, references, trigger on public.support_grants from authenticated;

-- Los internos con MFA ven sus permisos; el platform_admin con MFA, todos.
create policy support_grants_select on public.support_grants
  for select to authenticated
  using (
    (select private.session_is_active())
    and (select private.session_is_aal2())
    and (
      (staff_user_id = (select auth.uid()) and (select private.is_platform_staff()))
      or (select private.is_platform_staff(array['platform_admin']))
    )
  );

-- Conceder: solo platform_admin con MFA, a un interno no revocado.
create policy support_grants_insert on public.support_grants
  for insert to authenticated
  with check (
    (select private.session_is_active())
    and (select private.session_is_aal2())
    and (select private.is_platform_staff(array['platform_admin']))
    and private.is_staff_user(staff_user_id, true)
  );

-- Revocar: solo platform_admin con MFA (qué columnas, lo decide la guarda).
create policy support_grants_update on public.support_grants
  for update to authenticated
  using (
    (select private.session_is_active())
    and (select private.session_is_aal2())
    and (select private.is_platform_staff(array['platform_admin']))
  )
  with check (
    (select private.session_is_active())
    and (select private.session_is_aal2())
    and (select private.is_platform_staff(array['platform_admin']))
  );

-- ---------------------------------------------------------------------------
-- Lectura de datos de clientes por el equipo interno: de permanente a
-- permiso vigente + MFA.
-- ---------------------------------------------------------------------------
alter policy organizations_select_platform_staff on public.organizations
  using ((select private.session_is_active()) and private.staff_can_read(id));

alter policy regions_select_platform_staff on public.regions
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

alter policy locations_select_platform_staff on public.locations
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

alter policy memberships_select_platform_staff on public.memberships
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- Perfiles: los de las personas de una organización con permiso vigente, y
-- los de otros internos (con MFA).
alter policy users_select_platform_staff on public.users
  using (
    (select private.session_is_active())
    and (select private.session_is_aal2())
    and (select private.is_platform_staff())
    and (
      private.is_staff_user(users.id)
      or exists (
        select 1 from public.memberships m
        where m.user_id = users.id and private.staff_can_read(m.organization_id)
      )
    )
  );

-- La auditoría completa también exige MFA.
alter policy audit_logs_select_platform_staff on public.audit_logs
  using ((select private.session_is_active()) and (select private.session_is_aal2()) and (select private.is_platform_staff()));
