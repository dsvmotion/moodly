-- Ejecución de agentes y aprobaciones atadas al contenido (ADR 0047, paso 2b;
-- MANUAL §4 «Ejecución, aprobaciones y auditoría» y §5.7). Control 3.3 de la
-- revisión de seguridad del 2026-10-20: que nadie apruebe una cosa y se ejecute
-- otra, ni apruebe sin sesión, sin el rol o fuera de su alcance.
--
-- - agent_runs: cada ejecución de un agente (un workflow de DBOS).
-- - executions: cada llamada a una skill que dejó pasar el motor de políticas,
--   con la entrada validada, el destino que resolvió el runtime y su hash
--   (executionHash de @repo/agent-core). La entrada, el destino y el hash no
--   cambian nunca, para nadie: tampoco para el worker.
-- - approvals: la aprobación de una ejecución, con el mismo hash.
--
-- Quién escribe: el worker (service role) crea los runs, las ejecuciones y las
-- aprobaciones, y avanza sus estados. La app solo lee. Aprobar o rechazar solo
-- lo hace una persona con su sesión (rol authenticated), con el rol y el
-- alcance que pide la aprobación y con aal2 para lo financiero, lo destructivo
-- o si es org_admin. Ni la service role ni una función security definer pueden
-- aprobar.
--
-- Vuelta atrás: drop de las tres tablas (approvals, executions, agent_runs, en
-- ese orden) y de las funciones private.member_role_rank,
-- private.can_decide_approval, private.validate_agent_run,
-- private.validate_execution, private.guard_execution,
-- private.validate_approval, private.guard_approval y
-- private.emit_approval_decided. No hay datos de clientes todavía.

-- ---------------------------------------------------------------------------
-- 1. Rango de los roles de miembro: quién puede decidir lo que pide otro rol
-- ---------------------------------------------------------------------------
create function private.member_role_rank(p_role text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'staff' then 1
    when 'location_manager' then 2
    when 'region_manager' then 3
    when 'org_admin' then 4
  end;
$$;
revoke all on function private.member_role_rank(text) from public;
grant execute on function private.member_role_rank(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  trigger text not null check (trigger in ('inbound_message', 'schedule', 'domain_event', 'staff_instruction')),
  trigger_ref text check (trigger_ref is null or length(trigger_ref) between 1 and 200),
  config_snapshot_id uuid references public.config_snapshots (id) on delete set null,
  -- El workflow de DBOS que lo ejecuta (ADR 0027).
  workflow_id text check (workflow_id is null or length(workflow_id) between 1 and 200),
  status text not null default 'running'
    check (status in ('running', 'awaiting_approval', 'awaiting_knowledge', 'handed_off', 'completed', 'failed')),
  model text check (model is null or length(model) between 1 and 200),
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  cost_eur numeric(12, 6) not null default 0 check (cost_eur >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_runs_organization_id_idx on public.agent_runs (organization_id, created_at desc);
create index agent_runs_location_id_idx on public.agent_runs (location_id);
create index agent_runs_agent_id_idx on public.agent_runs (agent_id);
create index agent_runs_config_snapshot_id_idx on public.agent_runs (config_snapshot_id);

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  skill_key text not null check (skill_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  skill_version int not null check (skill_version >= 1),
  effect_class text not null check (effect_class in
    ('read', 'internal_write', 'external_message', 'external_outreach', 'financial', 'destructive')),
  autonomy_applied text not null check (autonomy_applied in ('suggest', 'draft', 'execute', 'autonomous')),
  -- La entrada validada con el esquema de la skill y el destino del runtime
  -- (Target de @repo/agent-core). Con ellos se recalcula input_hash.
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  target jsonb not null check (jsonb_typeof(target) = 'object' and target ? 'kind'),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  -- Lo que verá quien aprueba (SkillPreview): se pone una vez.
  preview jsonb check (preview is null or jsonb_typeof(preview) = 'object'),
  output jsonb,
  status text not null
    check (status in ('suggested', 'drafted', 'needs_approval', 'approved', 'rejected', 'executed', 'failed')),
  rationale text check (rationale is null or length(rationale) between 1 and 2000),
  idempotency_key text not null unique check (length(idempotency_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index executions_run_id_idx on public.executions (run_id);
create index executions_organization_id_idx on public.executions (organization_id, created_at desc);
create index executions_location_id_idx on public.executions (location_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null unique references public.executions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  -- Copiados de la ejecución al crearla (validate_approval comprueba que coinciden)
  -- para que la política de decidir no tenga que mirar otra tabla.
  effect_class text not null check (effect_class in
    ('read', 'internal_write', 'external_message', 'external_outreach', 'financial', 'destructive')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  required_role text not null check (required_role in ('org_admin', 'region_manager', 'location_manager', 'staff')),
  reason text check (reason is null or length(reason) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  decided_by uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Sin local, la aprobación es de toda la organización: solo la decide un org_admin.
  constraint approvals_org_level_needs_admin check (location_id is not null or required_role = 'org_admin'),
  constraint approvals_decided_at check ((status in ('approved', 'rejected')) = (decided_at is not null)),
  constraint approvals_expiry_after_creation check (expires_at > created_at)
);
create index approvals_pending_idx on public.approvals (organization_id, status, expires_at);
create index approvals_location_id_idx on public.approvals (location_id);
create index approvals_decided_by_idx on public.approvals (decided_by);

-- ---------------------------------------------------------------------------
-- 3. Coherencia entre tablas (para todos los roles)
-- ---------------------------------------------------------------------------
-- El local y el agente de un run son de su organización.
create function private.validate_agent_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.agents a where a.id = new.agent_id and a.organization_id = new.organization_id) then
    raise exception 'el agente del run no es de su organización' using errcode = '23514';
  end if;
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local del run no es de su organización' using errcode = '23514';
  end if;
  if new.config_snapshot_id is not null and not exists (
    select 1 from public.config_snapshots s where s.id = new.config_snapshot_id and s.organization_id = new.organization_id
  ) then
    raise exception 'el snapshot del run no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id, new.location_id, new.agent_id, new.trigger, new.trigger_ref, new.created_at)
     is distinct from (old.organization_id, old.location_id, old.agent_id, old.trigger, old.trigger_ref, old.created_at) then
    raise exception 'la organización, el local, el agente y el origen de un run no cambian' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_agent_run() from public;
create trigger validate_agent_run before insert or update on public.agent_runs
  for each row execute function private.validate_agent_run();
create trigger set_updated_at before update on public.agent_runs
  for each row execute function private.set_updated_at();

-- Una ejecución es de la organización y del local de su run.
create function private.validate_execution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.agent_runs r
    where r.id = new.run_id
      and r.organization_id = new.organization_id
      and r.location_id is not distinct from new.location_id
  ) then
    raise exception 'la ejecución no es de la organización y el local de su run' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_execution() from public;
create trigger validate_execution before insert on public.executions
  for each row execute function private.validate_execution();

-- Lo que se ejecuta no cambia nunca, para nadie (también para la service role):
-- es lo que se aprobó. Solo avanzan el estado, la salida y el motivo, y la
-- vista previa se pone una vez.
create function private.guard_execution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.run_id, new.organization_id, new.location_id, new.skill_key, new.skill_version, new.effect_class,
      new.autonomy_applied, new.input, new.target, new.input_hash, new.idempotency_key, new.created_at)
     is distinct from
     (old.run_id, old.organization_id, old.location_id, old.skill_key, old.skill_version, old.effect_class,
      old.autonomy_applied, old.input, old.target, old.input_hash, old.idempotency_key, old.created_at) then
    raise exception 'la entrada, el destino y el hash de una ejecución no cambian' using errcode = '42501';
  end if;
  if old.preview is not null and new.preview is distinct from old.preview then
    raise exception 'la vista previa de una ejecución no cambia' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_execution() from public;
create trigger guard_execution before update on public.executions
  for each row execute function private.guard_execution();
create trigger set_updated_at before update on public.executions
  for each row execute function private.set_updated_at();

-- Una aprobación nace pendiente y copia de su ejecución la organización, el
-- local, la clase de efecto y el hash. Si no coinciden, no nace.
create function private.validate_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.executions e
    where e.id = new.execution_id
      and e.organization_id = new.organization_id
      and e.location_id is not distinct from new.location_id
      and e.effect_class = new.effect_class
      and e.input_hash = new.input_hash
  ) then
    raise exception 'la aprobación no coincide con su ejecución (organización, local, clase o hash)' using errcode = '23514';
  end if;
  if new.status <> 'pending' or new.decided_by is not null or new.decided_at is not null then
    raise exception 'una aprobación nace pendiente y sin decidir' using errcode = '23514';
  end if;
  new.created_at := now();
  if new.expires_at <= now() then
    raise exception 'una aprobación nace sin caducar' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_approval() from public;
create trigger validate_approval before insert on public.approvals
  for each row execute function private.validate_approval();

-- Qué cambia en una aprobación, para todos los roles:
-- - lo que se aprueba (ejecución, hash, clase, local, rol, motivo, caducidad) nunca;
-- - el estado solo sale de pending, y una vez;
-- - approved y rejected solo los pone una persona con su sesión (authenticated),
--   antes de caducar; decided_by y decided_at los pone la base de datos;
-- - expired lo pone la plataforma, nunca una persona.
create function private.guard_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.execution_id, new.organization_id, new.location_id, new.effect_class, new.input_hash,
      new.required_role, new.reason, new.expires_at, new.created_at)
     is distinct from
     (old.execution_id, old.organization_id, old.location_id, old.effect_class, old.input_hash,
      old.required_role, old.reason, old.expires_at, old.created_at) then
    raise exception 'lo que se aprueba no cambia' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then
    if (new.decided_by, new.decided_at) is distinct from (old.decided_by, old.decided_at) then
      raise exception 'la decisión de una aprobación no cambia' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'una aprobación ya decidida o caducada no cambia' using errcode = '42501';
  end if;
  if new.status in ('approved', 'rejected') then
    if current_user <> 'authenticated' or (select auth.uid()) is null then
      raise exception 'solo una persona con su sesión aprueba o rechaza' using errcode = '42501';
    end if;
    if now() >= old.expires_at then
      raise exception 'la aprobación ha caducado' using errcode = '42501';
    end if;
    new.decided_by := (select auth.uid());
    new.decided_at := now();
  elsif new.status = 'expired' then
    if current_user = 'authenticated' then
      raise exception 'una persona no marca una aprobación como caducada' using errcode = '42501';
    end if;
    new.decided_by := null;
    new.decided_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_approval() from public;
create trigger guard_approval before update on public.approvals
  for each row execute function private.guard_approval();

-- ---------------------------------------------------------------------------
-- 4. La decisión despierta al run (ADR 0009, MANUAL §5.7)
-- ---------------------------------------------------------------------------
-- Security definer: la persona que decide no puede escribir en domain_events.
-- Escribe solo esa fila, con la organización y el local de la aprobación que
-- acaba de pasar RLS y su guarda, y sin datos personales. No la puede llamar
-- nadie: es un trigger y no tiene EXECUTE para ningún rol de la app.
create function private.emit_approval_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_events (organization_id, location_id, type, payload)
  select new.organization_id, new.location_id, 'approval.decided',
         jsonb_build_object('approval_id', new.id, 'execution_id', new.execution_id,
                            'run_id', e.run_id, 'decision', new.status)
  from public.executions e
  where e.id = new.execution_id;
  return null;
end;
$$;
revoke all on function private.emit_approval_decided() from public;
create trigger emit_approval_decided after update of status on public.approvals
  for each row
  when (old.status = 'pending' and new.status in ('approved', 'rejected'))
  execute function private.emit_approval_decided();

-- ---------------------------------------------------------------------------
-- 5. Quién puede decidir
-- ---------------------------------------------------------------------------
-- La persona tiene un rol igual o superior al que pide la aprobación y llega a
-- su local (el org_admin a todos; el region_manager a los de sus regiones; el
-- location_manager y el staff a los suyos). Sin local, solo el org_admin.
-- Security definer: lee memberships sin pasar por sus políticas; solo lee.
create function private.can_decide_approval(p_org uuid, p_location uuid, p_required_role text)
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
      left join public.locations l
        on l.id = p_location
       and l.organization_id = m.organization_id
      where m.user_id = (select auth.uid())
        and m.organization_id = p_org
        and private.member_role_rank(m.role) >= private.member_role_rank(p_required_role)
        and (
          m.role = 'org_admin'
          or (l.id is not null and m.role = 'region_manager' and l.region_id = any (m.scope_region_ids))
          or (l.id is not null and m.role in ('location_manager', 'staff') and l.id = any (m.scope_location_ids))
        )
    );
$$;
revoke all on function private.can_decide_approval(uuid, uuid, text) from public;
grant execute on function private.can_decide_approval(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.agent_runs enable row level security;
alter table public.agent_runs force row level security;
alter table public.executions enable row level security;
alter table public.executions force row level security;
alter table public.approvals enable row level security;
alter table public.approvals force row level security;

-- Leer: quien llega al local; lo que no tiene local, el org_admin.
create policy agent_runs_select on public.agent_runs
  for select to authenticated
  using ((select private.session_is_active()) and (
    (location_id is null and private.has_org_role(organization_id, array['org_admin']))
    or (location_id is not null and private.can_access_location(organization_id, location_id))));

create policy agent_runs_select_platform_staff on public.agent_runs
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

create policy executions_select on public.executions
  for select to authenticated
  using ((select private.session_is_active()) and (
    (location_id is null and private.has_org_role(organization_id, array['org_admin']))
    or (location_id is not null and private.can_access_location(organization_id, location_id))));

create policy executions_select_platform_staff on public.executions
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

create policy approvals_select on public.approvals
  for select to authenticated
  using ((select private.session_is_active()) and (
    (location_id is null and private.has_org_role(organization_id, array['org_admin']))
    or (location_id is not null and private.can_access_location(organization_id, location_id))));

create policy approvals_select_platform_staff on public.approvals
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- Decidir: una aprobación pendiente y sin caducar, con el rol y el alcance que
-- pide, y con aal2 si es financiera o destructiva o si decide un org_admin
-- (como en todo lo que administra, 13_admin_mfa). El equipo interno no decide.
create policy approvals_decide on public.approvals
  for update to authenticated
  using ((select private.session_is_active())
         and status = 'pending'
         and expires_at > now()
         and private.can_decide_approval(organization_id, location_id, required_role)
         and ((select private.session_is_aal2())
              or (effect_class not in ('financial', 'destructive')
                  and not private.has_org_role(organization_id, array['org_admin']))))
  with check ((select private.session_is_active())
              and status in ('approved', 'rejected')
              and expires_at > now()
              and private.can_decide_approval(organization_id, location_id, required_role)
              and ((select private.session_is_aal2())
                   or (effect_class not in ('financial', 'destructive')
                       and not private.has_org_role(organization_id, array['org_admin']))));

-- ---------------------------------------------------------------------------
-- 7. Privilegios: la app lee y solo puede cambiar el estado de una aprobación
-- ---------------------------------------------------------------------------
revoke all on public.agent_runs, public.executions, public.approvals from anon, authenticated;
grant select on public.agent_runs, public.executions, public.approvals to authenticated;
grant update (status) on public.approvals to authenticated;
