-- Conectores (paso 3c; ADR 0036, sobre el 0030 §2 y la revisión de seguridad
-- §7.3). Solo modelo de datos: no conecta ningún servidor ni guarda ninguna
-- credencial real.
--
-- - integrations: cada integración de una organización (o de uno de sus
--   locales), nativa o MCP. La ve el org_admin; la escribe solo la plataforma
--   hasta que llegue el flujo de conexión (OAuth), con su propia política.
-- - skills de tipo mcp: cada herramienta de un servidor MCP conectado, fijada a
--   su nombre y a la huella de su definición. Entra, y vuelve a entrar si la
--   herramienta cambia, como external_message en draft: nada se ejecuta sin
--   aprobación hasta que alguien la clasifica (ADR 0030 §2).
--
-- Vuelta atrás: drop de los triggers y funciones private.validate_integration,
-- private.validate_mcp_skill y private.reset_mcp_skill_classification; de las
-- columnas mcp_tool_name y mcp_tool_hash y de las restricciones nuevas de
-- skills; de la tabla integrations y de la restricción
-- integration_secrets_id_organization_id_key. No hay datos de clientes todavía.

-- Para que una integración solo use secretos de su organización (clave externa compuesta).
alter table public.integration_secrets
  add constraint integration_secrets_id_organization_id_key unique (id, organization_id);

-- ---------------------------------------------------------------------------
-- 1. integrations
-- ---------------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = toda la organización.
  location_id uuid references public.locations (id) on delete cascade,
  -- El conector: la clave del servidor MCP revisado o del conector nativo.
  provider text not null check (provider ~ '^[a-z][a-z0-9-]{1,39}$'),
  kind text not null check (kind in ('mcp', 'native')),
  -- Solo MCP: la versión revisada del servidor con la que se conectó.
  server_version text check (server_version ~ '^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disconnected')),
  scopes text[] not null default '{}',
  -- Las credenciales, cifradas (ADR 0034), de la misma organización.
  secret_id uuid,
  connected_by uuid references public.users (id) on delete set null,
  last_health_check timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integrations_mcp_has_version check ((kind = 'mcp') = (server_version is not null)),
  constraint integrations_id_organization_id_key unique (id, organization_id),
  -- Una por proveedor en cada ámbito (la organización entera o un local).
  constraint integrations_scope_provider_key unique nulls not distinct (organization_id, location_id, provider),
  constraint integrations_secret_same_org foreign key (secret_id, organization_id)
    references public.integration_secrets (id, organization_id) on delete set null (secret_id)
);
create index integrations_location_id_idx on public.integrations (location_id);
create index integrations_connected_by_idx on public.integrations (connected_by);
create index integrations_secret_id_idx on public.integrations (secret_id, organization_id);

create trigger set_updated_at before update on public.integrations
  for each row execute function private.set_updated_at();

-- El local y quien la conectó son de su organización, y lo que identifica la
-- integración no cambia. Como validate_agent_run: para todos los roles;
-- security definer para comprobar contra los datos reales. Solo lee.
create function private.validate_integration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local de la integración no es de su organización' using errcode = '23514';
  end if;
  if new.connected_by is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.connected_by and m.organization_id = new.organization_id
  ) then
    raise exception 'quien conectó la integración no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id, new.location_id, new.provider, new.kind, new.created_at)
     is distinct from (old.organization_id, old.location_id, old.provider, old.kind, old.created_at) then
    raise exception 'la organización, el local, el proveedor y el tipo de una integración no cambian' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_integration() from public;
create trigger validate_integration before insert or update on public.integrations
  for each row execute function private.validate_integration();

alter table public.integrations enable row level security;
alter table public.integrations force row level security;

-- La ve el org_admin (y el equipo interno con acceso de soporte). El resto del
-- equipo ve las skills que salen de ella, no la integración.
create policy integrations_select on public.integrations
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

create policy integrations_select_platform_staff on public.integrations
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

revoke all on public.integrations from anon, authenticated;
grant select on public.integrations to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Skills de tipo mcp: una herramienta fijada de una integración MCP
-- ---------------------------------------------------------------------------
alter table public.skills
  -- El nombre de la herramienta en el servidor y la huella (SHA-256) de su
  -- definición tal y como se revisó: nombre, descripción y esquema de entrada.
  add column mcp_tool_name text check (mcp_tool_name ~ '^[A-Za-z0-9_.-]{1,128}$'),
  add column mcp_tool_hash text check (mcp_tool_hash ~ '^[0-9a-f]{64}$'),
  -- Una skill mcp sale de la integración de una organización: nunca es de la plataforma.
  add constraint skills_mcp_is_organization check (kind <> 'mcp' or organization_id is not null),
  add constraint skills_mcp_tool_pinned check (
    (kind = 'mcp') = (mcp_tool_name is not null) and (kind = 'mcp') = (mcp_tool_hash is not null)
  ),
  -- Y de una integración de su misma organización. Sin cascada: una integración
  -- con skills no se borra, se desconecta (status); al borrar la organización
  -- caen las dos en la misma sentencia.
  add constraint skills_integration_same_org foreign key (integration_id, organization_id)
    references public.integrations (id, organization_id);
create index skills_integration_id_idx on public.skills (integration_id, organization_id);
-- Una skill por herramienta y versión en cada integración.
create unique index skills_mcp_tool_key on public.skills (integration_id, mcp_tool_name, version) where kind = 'mcp';

-- La integración de una skill mcp es de tipo mcp. Security definer para
-- comprobar contra los datos reales; solo lee.
create function private.validate_mcp_skill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'mcp' and not exists (
    select 1 from public.integrations i where i.id = new.integration_id and i.kind = 'mcp'
  ) then
    raise exception 'una skill mcp sale de una integración MCP' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_mcp_skill() from public;
create trigger validate_mcp_skill before insert or update on public.skills
  for each row execute function private.validate_mcp_skill();

-- Una herramienta MCP sin clasificar entra como external_message en draft, y
-- vuelve a ese estado si cambia la herramienta fijada (otro nombre, otra
-- huella u otra integración): lo que se revisó ya no es lo que hay. La
-- clasificación posterior es un update aparte. Para todos los roles, también
-- la plataforma: es la red del importador, no una regla de permisos.
create function private.reset_mcp_skill_classification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'mcp' and (
    tg_op = 'INSERT'
    or (new.integration_id, new.mcp_tool_name, new.mcp_tool_hash)
       is distinct from (old.integration_id, old.mcp_tool_name, old.mcp_tool_hash)
  ) then
    new.effect_class := 'external_message';
    new.default_autonomy := 'draft';
    new.max_autonomy := 'draft';
    new.status := 'draft';
  end if;
  return new;
end;
$$;
revoke all on function private.reset_mcp_skill_classification() from public;
create trigger reset_mcp_skill_classification before insert or update on public.skills
  for each row execute function private.reset_mcp_skill_classification();

-- Si baja el techo de una skill (una herramienta MCP que cambia y vuelve a
-- draft, o una reclasificación), los agentes que la tenían por encima bajan
-- con ella: agent_skills nunca supera skills.max_autonomy (validate_agent_skill
-- lo exige al asignarla). Invoker: hoy solo la plataforma cambia skills.
create function private.cap_agent_skills_autonomy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.autonomy_rank(new.max_autonomy) < private.autonomy_rank(old.max_autonomy) then
    update public.agent_skills s
       set autonomy_level = new.max_autonomy
     where s.skill_id = new.id
       and private.autonomy_rank(s.autonomy_level) > private.autonomy_rank(new.max_autonomy);
  end if;
  return null;
end;
$$;
revoke all on function private.cap_agent_skills_autonomy() from public;
-- Sin «update of max_autonomy»: ese filtro no ve el cambio que hace un trigger
-- before (reset_mcp_skill_classification), y ese es justo el caso que importa.
create trigger cap_agent_skills_autonomy after update on public.skills
  for each row execute function private.cap_agent_skills_autonomy();
