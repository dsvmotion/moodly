-- Catálogo de agentes y skills (fase D, ADR 0030; MANUAL §1.4, §1.6, §4.2,
-- §5.5 y §5.6). Primer incremento: solo datos.
--
-- - agent_types: los 4 de serie (ADR 0023, la semilla de @repo/config
--   AGENT_TYPES), y más adelante los de plantilla y los propios.
-- - agents: un agente por tipo y organización. Se crean los 4 de serie al dar de
--   alta una organización, en borrador (sin configurar).
-- - skills y agent_skills: el catálogo de skills y cuáles tiene cada agente,
--   con el techo de autonomía de su clase de efecto.
--
-- La app solo lee: crear agentes propios, skills compuestas y activar skills
-- llega en fases posteriores (ADR 0030 §6), con sus políticas de escritura.
-- La herencia de configuración (config_overrides, config_snapshots) va en la
-- migración siguiente.
--
-- Vuelta atrás: drop table agent_skills, skills, agents, agent_types (en ese
-- orden), drop trigger create_builtin_agents on public.organizations y drop de
-- las funciones private.* de este archivo.

-- ---------------------------------------------------------------------------
-- Autonomía (MANUAL §1.6) y techo por clase de efecto (§5.6)
-- ---------------------------------------------------------------------------
create function private.autonomy_rank(p_level text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_level
    when 'suggest' then 1
    when 'draft' then 2
    when 'execute' then 3
    when 'autonomous' then 4
  end;
$$;

-- Techo por defecto de cada clase. Subir una skill financiera a execute será un
-- override explícito y auditado de un org_admin (§5.6), no un cambio del
-- catálogo.
create function private.effect_class_ceiling(p_class text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_class
    when 'read' then 'autonomous'
    when 'internal_write' then 'autonomous'
    when 'external_message' then 'autonomous'
    when 'external_outreach' then 'execute'
    when 'financial' then 'draft'
    when 'destructive' then 'draft'
  end;
$$;

revoke all on function private.autonomy_rank(text) from public;
revoke all on function private.effect_class_ceiling(text) from public;
grant execute on function private.autonomy_rank(text) to authenticated, service_role;
grant execute on function private.effect_class_ceiling(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.agent_types (
  id                uuid primary key default gen_random_uuid(),
  -- null = de la plataforma (de serie o de plantilla).
  organization_id   uuid references public.organizations (id) on delete cascade,
  origin            text not null check (origin in ('builtin', 'template', 'custom')),
  key               text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name              text not null check (length(btrim(name)) between 1 and 80),
  color             text not null check (color ~ '^agent-[a-z]+$'),
  description       text not null default '',
  organization_kind text not null default 'business' check (organization_kind in ('business')),
  base_instructions text not null default '',
  default_skills    text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Los propios son de una organización; los de serie y de plantilla, de nadie.
  constraint agent_types_origin_owner check ((origin = 'custom') = (organization_id is not null)),
  constraint agent_types_organization_id_key_key unique nulls not distinct (organization_id, key)
);

create table public.agents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_type_id   uuid not null references public.agent_types (id),
  version         int not null default 1 check (version >= 1),
  -- null = el nombre del tipo.
  display_name    text check (display_name is null or length(btrim(display_name)) between 1 and 80),
  status          text not null default 'draft' check (status in ('draft', 'testing', 'live', 'paused')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint agents_organization_id_agent_type_id_key unique (organization_id, agent_type_id)
);
create index agents_agent_type_id_idx on public.agents (agent_type_id);

create table public.skills (
  id                        uuid primary key default gen_random_uuid(),
  -- null = de la plataforma.
  organization_id           uuid references public.organizations (id) on delete cascade,
  key                       text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  version                   int not null default 1 check (version >= 1),
  kind                      text not null check (kind in ('code', 'composed', 'mcp')),
  name                      text not null check (length(btrim(name)) between 1 and 80),
  description               text not null default '',
  -- Solo las compuestas (ADR 0030 §2).
  definition                jsonb,
  -- Solo las de MCP. La FK llega con la tabla integrations.
  integration_id            uuid,
  effect_class              text not null check (effect_class in
                              ('read', 'internal_write', 'external_message', 'external_outreach', 'financial', 'destructive')),
  default_autonomy          text not null check (default_autonomy in ('suggest', 'draft', 'execute', 'autonomous')),
  max_autonomy              text not null check (max_autonomy in ('suggest', 'draft', 'execute', 'autonomous')),
  required_integration      text,
  -- Vacío = cualquier agente. Solo para skills peligrosas fuera de su contexto.
  restricted_to_agent_types text[] not null default '{}',
  input_schema              jsonb not null default '{}',
  output_schema             jsonb not null default '{}',
  status                    text not null default 'draft' check (status in ('draft', 'testing', 'published')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- Las de código son de la plataforma: el cliente no ejecuta código nuestro ni suyo.
  constraint skills_code_is_platform check (kind <> 'code' or organization_id is null),
  constraint skills_definition_only_composed check ((kind = 'composed') = (definition is not null)),
  constraint skills_integration_only_mcp check ((kind = 'mcp') = (integration_id is not null)),
  constraint skills_default_within_max check (private.autonomy_rank(default_autonomy) <= private.autonomy_rank(max_autonomy)),
  constraint skills_max_within_ceiling check (
    private.autonomy_rank(max_autonomy) <= private.autonomy_rank(private.effect_class_ceiling(effect_class))
  ),
  constraint skills_organization_id_key_version_key unique nulls not distinct (organization_id, key, version)
);

create table public.agent_skills (
  agent_id        uuid not null references public.agents (id) on delete cascade,
  skill_id        uuid not null references public.skills (id),
  -- Copia de la del agente, para RLS y para las consultas del worker con
  -- organization_id explícito. validate_agent_skill comprueba que coincide.
  organization_id uuid not null references public.organizations (id) on delete cascade,
  enabled         boolean not null default true,
  autonomy_level  text not null check (autonomy_level in ('suggest', 'draft', 'execute', 'autonomous')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (agent_id, skill_id)
);
create index agent_skills_skill_id_idx on public.agent_skills (skill_id);
create index agent_skills_organization_id_idx on public.agent_skills (organization_id);

create trigger set_updated_at before update on public.agent_types
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.agents
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.skills
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.agent_skills
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integridad. Como validate_scope: actúa para todos los roles, también la
-- plataforma. Security definer para comprobar contra los datos reales y no
-- contra lo que RLS deja ver; solo leen.
-- ---------------------------------------------------------------------------

-- Un agente solo usa un tipo de la plataforma o de su organización.
create function private.validate_agent_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.agent_types t
    where t.id = new.agent_type_id
      and (t.organization_id is null or t.organization_id = new.organization_id)
  ) then
    raise exception 'el tipo de agente no es de la plataforma ni de la organización %', new.organization_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_agent_type() from public;

create trigger validate_agent_type before insert or update on public.agents
  for each row execute function private.validate_agent_type();

-- Una skill de un agente: de la misma organización que el agente, de la
-- plataforma o de esa organización, permitida para su tipo y sin pasar de su
-- autonomía máxima.
create function private.validate_agent_skill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent_org uuid;
  v_type_key  text;
  v_skill     public.skills;
begin
  select a.organization_id, t.key into v_agent_org, v_type_key
  from public.agents a
  join public.agent_types t on t.id = a.agent_type_id
  where a.id = new.agent_id;

  if v_agent_org is distinct from new.organization_id then
    raise exception 'organization_id no coincide con el del agente'
      using errcode = '23503';
  end if;

  select * into v_skill from public.skills s where s.id = new.skill_id;

  if v_skill.organization_id is not null and v_skill.organization_id <> new.organization_id then
    raise exception 'la skill no es de la plataforma ni de la organización %', new.organization_id
      using errcode = '23503';
  end if;

  if cardinality(v_skill.restricted_to_agent_types) > 0
     and not (v_type_key = any (v_skill.restricted_to_agent_types)) then
    raise exception 'la skill % no se puede dar a un agente de tipo %', v_skill.key, v_type_key
      using errcode = '23514';
  end if;

  if private.autonomy_rank(new.autonomy_level) > private.autonomy_rank(v_skill.max_autonomy) then
    raise exception 'la autonomía % supera el máximo de la skill % (%)', new.autonomy_level, v_skill.key, v_skill.max_autonomy
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_agent_skill() from public;

create trigger validate_agent_skill before insert or update on public.agent_skills
  for each row execute function private.validate_agent_skill();

-- ---------------------------------------------------------------------------
-- Los 4 de serie (ADR 0023; @repo/config AGENT_TYPES es la semilla). Ids fijos
-- para que sean los mismos en local, en staging y en producción. El nombre y la
-- descripción son los de por defecto en español; la web los traduce por clave.
-- ---------------------------------------------------------------------------
insert into public.agent_types (id, organization_id, origin, key, name, color, description) values
  ('0a9e0000-0000-4000-8000-000000000001', null, 'builtin', 'reception', 'Recepción', 'agent-reception',
   'Agenda y citas: crea, mueve y cancela citas, gestiona la lista de espera y los recordatorios, organiza recursos y salas y atiende la línea de teléfono del negocio.'),
  ('0a9e0000-0000-4000-8000-000000000002', null, 'builtin', 'customer', 'Atención al cliente', 'agent-customer',
   'Atiende a tus clientes por WhatsApp, Instagram, email y la web: resuelve dudas e incidencias, gestiona reseñas y pasa a una persona lo que lo necesita.'),
  ('0a9e0000-0000-4000-8000-000000000003', null, 'builtin', 'sales', 'Comercial', 'agent-sales',
   'Capta y cualifica leads, lleva el CRM, prepara presupuestos, hace el seguimiento, recupera clientes y ejecuta las campañas que proponga el coach.'),
  ('0a9e0000-0000-4000-8000-000000000004', null, 'builtin', 'admin', 'Administración', 'agent-admin',
   'Facturación a través de tu software, cobros, gastos, inventario y proveedores, documentos y la información que necesita tu gestoría.');

-- ---------------------------------------------------------------------------
-- Cada organización nace con sus agentes de serie, en borrador. No es security
-- definer: corre como quien crea la organización, que solo puede ser la
-- plataforma (authenticated no tiene INSERT en organizations).
-- ---------------------------------------------------------------------------
create function private.create_builtin_agents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.agents (organization_id, agent_type_id)
  select new.id, t.id
  from public.agent_types t
  where t.origin = 'builtin' and t.organization_id is null
  on conflict (organization_id, agent_type_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_builtin_agents() from public;

create trigger create_builtin_agents after insert on public.organizations
  for each row execute function private.create_builtin_agents();

-- Las organizaciones que ya existen.
insert into public.agents (organization_id, agent_type_id)
select o.id, t.id
from public.organizations o
cross join public.agent_types t
where t.origin = 'builtin' and t.organization_id is null
on conflict (organization_id, agent_type_id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS. La app solo lee: el catálogo de la plataforma lo ve cualquier sesión
-- viva; lo de una organización, sus miembros y el equipo interno con permiso de
-- soporte vigente (staff_can_read, que ya exige aal2).
-- ---------------------------------------------------------------------------
alter table public.agent_types  enable row level security;
alter table public.agents       enable row level security;
alter table public.skills       enable row level security;
alter table public.agent_skills enable row level security;

alter table public.agent_types  force row level security;
alter table public.agents       force row level security;
alter table public.skills       force row level security;
alter table public.agent_skills force row level security;

-- Supabase concede todo a anon y authenticated en cada tabla nueva de public.
revoke all on public.agent_types, public.agents, public.skills, public.agent_skills from anon, authenticated;
grant select on public.agent_types, public.agents, public.skills, public.agent_skills to authenticated;

create policy agent_types_select on public.agent_types
  for select to authenticated
  using ((select private.session_is_active()) and (organization_id is null or private.has_org_role(organization_id)));

create policy agent_types_select_platform_staff on public.agent_types
  for select to authenticated
  using ((select private.session_is_active()) and organization_id is not null and private.staff_can_read(organization_id));

create policy agents_select on public.agents
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id));

create policy agents_select_platform_staff on public.agents
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

create policy skills_select on public.skills
  for select to authenticated
  using ((select private.session_is_active()) and (organization_id is null or private.has_org_role(organization_id)));

create policy skills_select_platform_staff on public.skills
  for select to authenticated
  using ((select private.session_is_active()) and organization_id is not null and private.staff_can_read(organization_id));

create policy agent_skills_select on public.agent_skills
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id));

create policy agent_skills_select_platform_staff on public.agent_skills
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));
