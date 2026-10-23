-- Objetivos del negocio (MANUAL §6.3): qué quiere conseguir la organización,
-- medido con qué métrica, para cuándo y en qué alcance (organización, región o
-- local). Los agentes los reciben en su contexto para priorizar y el coach
-- revisa su progreso. goal_progress guarda cada medición.
--
-- Quién los gestiona: el org_admin (con aal2) en cualquier alcance; el
-- region_manager en sus regiones y sus locales; el location_manager en sus
-- locales. Todos los miembros leen los objetivos de su alcance. El progreso lo
-- escribe la plataforma (métricas internas e integraciones), no la app.

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scope text not null check (scope in ('organization', 'region', 'location')),
  -- La organización, la región o el local, según scope (lo valida validate_goal).
  scope_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- Clave de la métrica (§12.3), p. ej. appointments.booked o leads.qualified.
  metric_key text not null check (metric_key ~ '^[a-z][a-z0-9_]{0,62}(\.[a-z][a-z0-9_]{0,62}){0,2}$'),
  -- Si se cumple llegando al valor (citas al mes) o sin pasarse (tiempo de respuesta).
  direction text not null default 'at_least' check (direction in ('at_least', 'at_most')),
  target_value numeric not null,
  -- Recurrentes (cada semana, mes, trimestre o año desde starts_on) o de una vez (con due_date).
  period text not null check (period in ('week', 'month', 'quarter', 'year', 'once')),
  starts_on date not null default current_date,
  due_date date,
  owner_user_id uuid references public.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused', 'achieved', 'missed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_due_date_only_once check ((period = 'once') = (due_date is not null)),
  constraint goals_due_after_start check (due_date is null or due_date >= starts_on),
  constraint goals_org_scope_is_org check (scope <> 'organization' or scope_id = organization_id)
);

create index goals_organization_id_idx on public.goals (organization_id);
create index goals_scope_idx on public.goals (organization_id, scope, scope_id);
create index goals_owner_user_id_idx on public.goals (owner_user_id);

create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  value numeric not null,
  measured_at timestamptz not null default now(),
  source text not null check (source in ('internal', 'integration', 'manual')),
  created_at timestamptz not null default now()
);

create index goal_progress_goal_id_idx on public.goal_progress (goal_id, measured_at desc);
create index goal_progress_organization_id_idx on public.goal_progress (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Integridad (para cualquier rol, también la plataforma)
-- ---------------------------------------------------------------------------
-- El alcance y la persona responsable son de la misma organización que el
-- objetivo. Security definer solo para leer regions, locations y memberships
-- sin depender de la RLS de quien escribe; no escribe nada.
create function private.validate_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope = 'region' and not exists (
    select 1 from public.regions r where r.id = new.scope_id and r.organization_id = new.organization_id
  ) then
    raise exception 'la región del objetivo no es de su organización' using errcode = '23514';
  end if;
  if new.scope = 'location' and not exists (
    select 1 from public.locations l where l.id = new.scope_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local del objetivo no es de su organización' using errcode = '23514';
  end if;
  if new.owner_user_id is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.owner_user_id and m.organization_id = new.organization_id
  ) then
    raise exception 'la persona responsable del objetivo no es de su organización' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_goal() from public;

create trigger validate_goal
  before insert or update on public.goals
  for each row execute function private.validate_goal();

create function private.validate_goal_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.goals g where g.id = new.goal_id and g.organization_id = new.organization_id
  ) then
    raise exception 'la medición no es de la organización de su objetivo' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_goal_progress() from public;

create trigger validate_goal_progress
  before insert or update on public.goal_progress
  for each row execute function private.validate_goal_progress();

-- ---------------------------------------------------------------------------
-- 3. Guardas (ADR 0003): desde la app, un objetivo no cambia de organización
--    ni de alcance (se crea otro).
-- ---------------------------------------------------------------------------
create trigger guard_immutable
  before update on public.goals
  for each row execute function private.guard_immutable_columns('organization_id', 'scope', 'scope_id');

create trigger set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.goals enable row level security;
alter table public.goals force row level security;
alter table public.goal_progress enable row level security;
alter table public.goal_progress force row level security;

-- Leer: cualquier miembro con acceso al alcance (los de la organización, todos;
-- los de una región o un local, quien llega a ellos).
create policy goals_select on public.goals
  for select to authenticated
  using ((select private.session_is_active()) and (
    (scope = 'organization' and private.has_org_role(organization_id))
    or (scope = 'region' and private.can_access_region(organization_id, scope_id))
    or (scope = 'location' and private.can_access_location(organization_id, scope_id))));

create policy goals_select_platform_staff on public.goals
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- Gestionar: el region_manager en sus regiones y sus locales, el
-- location_manager en sus locales y el org_admin (con aal2) en cualquiera.
create policy goals_insert on public.goals
  for insert to authenticated
  with check ((select private.session_is_active()) and (
    (scope = 'region' and private.has_org_role(organization_id, array['region_manager'])
      and private.can_access_region(organization_id, scope_id))
    or (scope = 'location' and private.can_access_location(organization_id, scope_id, array['region_manager', 'location_manager']))
    or ((select private.session_is_aal2()) and private.has_org_role(organization_id, array['org_admin']))));

create policy goals_update on public.goals
  for update to authenticated
  using ((select private.session_is_active()) and (
    (scope = 'region' and private.has_org_role(organization_id, array['region_manager'])
      and private.can_access_region(organization_id, scope_id))
    or (scope = 'location' and private.can_access_location(organization_id, scope_id, array['region_manager', 'location_manager']))
    or ((select private.session_is_aal2()) and private.has_org_role(organization_id, array['org_admin']))))
  with check ((select private.session_is_active()) and (
    (scope = 'region' and private.has_org_role(organization_id, array['region_manager'])
      and private.can_access_region(organization_id, scope_id))
    or (scope = 'location' and private.can_access_location(organization_id, scope_id, array['region_manager', 'location_manager']))
    or ((select private.session_is_aal2()) and private.has_org_role(organization_id, array['org_admin']))));

create policy goals_delete on public.goals
  for delete to authenticated
  using ((select private.session_is_active()) and (
    (scope = 'region' and private.has_org_role(organization_id, array['region_manager'])
      and private.can_access_region(organization_id, scope_id))
    or (scope = 'location' and private.can_access_location(organization_id, scope_id, array['region_manager', 'location_manager']))
    or ((select private.session_is_aal2()) and private.has_org_role(organization_id, array['org_admin']))));

-- El progreso se ve si se ve su objetivo (la subconsulta pasa por la RLS de goals).
create policy goal_progress_select on public.goal_progress
  for select to authenticated
  using ((select private.session_is_active()) and exists (select 1 from public.goals g where g.id = goal_id));

create policy goal_progress_select_platform_staff on public.goal_progress
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- ---------------------------------------------------------------------------
-- 5. Privilegios: la app gestiona objetivos y solo lee el progreso
-- ---------------------------------------------------------------------------
revoke all on public.goals, public.goal_progress from anon, authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select on public.goal_progress to authenticated;
