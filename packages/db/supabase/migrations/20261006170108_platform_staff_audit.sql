-- Equipo interno (platform_staff) y auditoría (MANUAL §4.2, §4.4, §10.2, §10.5;
-- ADR 0021). Fase 0, /ops mínimo · PR 1: solo base de datos.
-- - platform_staff: identidad del equipo interno, separada de los roles tenant.
-- - private.is_platform_staff(): helper de RLS anclado en auth.uid().
-- - Identidades separadas: un interno no revocado no puede tener memberships.
-- - Políticas SELECT del equipo interno, de solo lectura, en las 5 tablas de
--   tenants. Los helpers y las políticas tenant no se tocan.
-- - audit_logs: solo inserción, con `at` fijado por la base de datos.
-- Vuelta atrás: supabase/rollbacks/20261006170108_platform_staff_audit.down.sql

-- ---------------------------------------------------------------------------
-- platform_staff
-- ---------------------------------------------------------------------------
-- Nunca "staff" a secas: ese es el rol tenant más bajo de memberships.
-- revoked_at (añadido a §4.2): retira el acceso sin borrar el historial. Con
-- cualquier valor (también futuro) la fila cuenta como revocada.
create table public.platform_staff (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.users (id) on delete cascade,
  role       text not null check (role in ('platform_admin', 'platform_operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create trigger set_updated_at before update on public.platform_staff
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Identidades separadas (D2): un usuario no puede ser a la vez equipo interno
-- no revocado y tener una membership tenant. El equipo interno usa una cuenta
-- dedicada. Es integridad, no una guarda de la app: actúa para todos los
-- roles, también la plataforma (como validate_scope). Security definer para
-- comprobar contra los datos reales y no contra lo que RLS deja ver. El
-- bloqueo consultivo por usuario serializa altas simultáneas en las dos tablas.
-- ---------------------------------------------------------------------------
create function private.validate_identity_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('identity:' || new.user_id::text, 0));

  if tg_table_name = 'memberships' then
    if exists (
      select 1 from public.platform_staff ps
      where ps.user_id = new.user_id and ps.revoked_at is null
    ) then
      raise exception 'una cuenta del equipo interno (platform_staff) no puede tener memberships de tenants'
        using errcode = '23514';
    end if;
  elsif new.revoked_at is null and exists (
    select 1 from public.memberships m where m.user_id = new.user_id
  ) then
    raise exception 'un usuario con memberships de tenants no puede ser equipo interno (platform_staff)'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_identity_separation() from public;

create trigger validate_identity before insert or update of user_id on public.memberships
  for each row execute function private.validate_identity_separation();
create trigger validate_identity before insert or update of user_id, revoked_at on public.platform_staff
  for each row execute function private.validate_identity_separation();

-- ---------------------------------------------------------------------------
-- Helper de RLS: ¿el usuario actual es equipo interno no revocado?
-- p_roles null = cualquier rol interno. En la Fase 0 platform_admin y
-- platform_operator tienen el mismo acceso de solo lectura (D1).
-- Security definer (lee platform_staff sin pasar por su RLS); solo lee.
-- ---------------------------------------------------------------------------
create function private.is_platform_staff(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff ps
    where ps.user_id = (select auth.uid())
      and ps.revoked_at is null
      and (p_roles is null or ps.role = any (p_roles))
  );
$$;

revoke all on function private.is_platform_staff(text[]) from public;
grant execute on function private.is_platform_staff(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- audit_logs (§10.5): solo inserción para todos los roles de aplicación.
-- organization_id admite null solo en eventos internos o de sistema entre
-- tenants, como ver la lista de organizaciones (D7).
-- actor_id sin FK: el registro sobrevive al actor (usuario, agente o sistema).
-- La regla de borrado RGPD queda abierta (D6, ADR 0021).
-- on delete restrict: borrar una organización con auditoría exige decidir
-- antes qué se hace con ella (D6); no se borra en cascada en silencio.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete restrict,
  actor_type      text not null check (actor_type in ('agent', 'user', 'platform_staff', 'system')),
  actor_id        uuid,
  action          text not null check (length(trim(action)) > 0),
  target          jsonb not null default '{}'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  at              timestamptz not null default now(),
  constraint audit_logs_organization_required check (
    organization_id is not null or actor_type in ('platform_staff', 'system')
  ),
  -- Solo el sistema puede no tener actor identificado.
  constraint audit_logs_actor_required check (actor_id is not null or actor_type = 'system')
);

-- Índice de la FK y de la consulta "por organización, más recientes primero".
create index audit_logs_organization_id_at_idx on public.audit_logs (organization_id, at desc);
create index audit_logs_at_idx                 on public.audit_logs (at desc);

-- `at` lo fija la base de datos: nadie puede antedatar (ni posfechar) una fila.
create function private.audit_logs_set_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.at := now();
  return new;
end;
$$;

revoke all on function private.audit_logs_set_at() from public;

create trigger set_at before insert on public.audit_logs
  for each row execute function private.audit_logs_set_at();

-- Sin UPDATE, DELETE ni TRUNCATE para ningún rol de aplicación (§10.5),
-- tampoco la service role (D6). Segunda capa tras los revoke de más abajo.
-- La plataforma (migraciones, SQL con credenciales de plataforma) no queda
-- bloqueada.
create function private.guard_audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon', 'service_role') then
    raise exception 'audit_logs es solo inserción: % no permitido', tg_op
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.guard_audit_logs_append_only() from public;

create trigger guard_append_only before update or delete on public.audit_logs
  for each row execute function private.guard_audit_logs_append_only();
create trigger guard_append_only_truncate before truncate on public.audit_logs
  for each statement execute function private.guard_audit_logs_append_only();

-- ---------------------------------------------------------------------------
-- RLS y privilegios de las tablas nuevas
-- ---------------------------------------------------------------------------
alter table public.platform_staff enable row level security;
alter table public.audit_logs     enable row level security;
alter table public.platform_staff force row level security;
alter table public.audit_logs     force row level security;

revoke all on public.platform_staff, public.audit_logs from anon;
-- Conceder y retirar acceso interno es una operación de plataforma (D4): la
-- app no puede escribir en platform_staff, ni por política ni por privilegio.
revoke insert, update, delete, truncate, references, trigger on public.platform_staff from authenticated;
revoke update, delete, truncate, references, trigger on public.audit_logs from authenticated;
revoke update, delete, truncate on public.audit_logs from service_role;

-- platform_staff: cada usuario ve solo su propia fila (la puerta de /ops la
-- lee así, sin service role). Sin políticas de INSERT/UPDATE/DELETE.
create policy platform_staff_select_self on public.platform_staff
  for select to authenticated
  using ((select private.session_is_active()) and user_id = (select auth.uid()));

-- audit_logs: el equipo interno solo inserta filas propias, como platform_staff.
create policy audit_logs_insert_platform_staff on public.audit_logs
  for insert to authenticated
  with check (
    (select private.session_is_active())
    and (select private.is_platform_staff())
    and actor_type = 'platform_staff'
    and actor_id = (select auth.uid())
  );

-- audit_logs: el equipo interno lee todas las filas.
create policy audit_logs_select_platform_staff on public.audit_logs
  for select to authenticated
  using ((select private.session_is_active()) and (select private.is_platform_staff()));

-- audit_logs: el org_admin lee las de su organización (D5, "exportable por
-- organización"). Sin UI tenant todavía.
create policy audit_logs_select_org_admin on public.audit_logs
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

-- ---------------------------------------------------------------------------
-- Lectura entre tenants del equipo interno: políticas SELECT permisivas
-- nuevas, separadas de las tenant. Sin INSERT/UPDATE/DELETE: las guardas del
-- ADR 0003 siguen como segunda capa. users solo tiene full_name y locale (el
-- email vive en auth.users y no se expone).
-- ---------------------------------------------------------------------------
create policy organizations_select_platform_staff on public.organizations
  for select to authenticated
  using ((select private.session_is_active()) and (select private.is_platform_staff()));

create policy regions_select_platform_staff on public.regions
  for select to authenticated
  using ((select private.session_is_active()) and (select private.is_platform_staff()));

create policy locations_select_platform_staff on public.locations
  for select to authenticated
  using ((select private.session_is_active()) and (select private.is_platform_staff()));

create policy memberships_select_platform_staff on public.memberships
  for select to authenticated
  using ((select private.session_is_active()) and (select private.is_platform_staff()));

create policy users_select_platform_staff on public.users
  for select to authenticated
  using ((select private.session_is_active()) and (select private.is_platform_staff()));
