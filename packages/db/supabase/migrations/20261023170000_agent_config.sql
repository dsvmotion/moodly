-- Configuración de agentes con herencia y bloqueos (fase D2; MANUAL §1.7 y
-- §4.3; ADR 0030).
--
--   resolved = base ⊕ override(organization) ⊕ override(region) ⊕ override(location)
--
-- - ⊕ es un merge profundo por clave (private.jsonb_deep_merge).
-- - Una clave bloqueada en un nivel (locked_keys, rutas con puntos: "tone" o
--   "messages.welcome") no la puede cambiar un nivel inferior. Se rechaza al
--   guardar (trigger validate_config_override), y la resolución tampoco la
--   aplica aunque llegara a estar (defensa en profundidad).
-- - La base es '{}' hasta que existan las plantillas por vertical
--   (agent_templates): entonces será template.defaults.
-- - config_snapshots: la configuración ya resuelta, inmutable y con hash, que
--   usará cada ejecución (agent_runs.config_snapshot_id, cuando exista). La
--   crea el worker con private.snapshot_agent_config().
--
-- La app solo lee: editar la configuración llega con su pantalla, con las
-- políticas de escritura por rol.
--
-- Vuelta atrás: rollbacks/20261023170000_agent_config.down.sql.

-- ---------------------------------------------------------------------------
-- Utilidades jsonb (puras)
-- ---------------------------------------------------------------------------

-- Merge profundo: si los dos lados son objetos, se mezclan clave a clave; si
-- no, gana el de la derecha (b), también si es un null de JSON.
create function private.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when b is null then a
    when a is null then b
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then (
      select coalesce(jsonb_object_agg(
        k,
        case
          when a ? k and b ? k then private.jsonb_deep_merge(a -> k, b -> k)
          when b ? k then b -> k
          else a -> k
        end
      ), '{}'::jsonb)
      from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b)) as keys
    )
    else b
  end;
$$;

-- Rutas de las hojas de un objeto ("a.b.c"). Un array o un escalar es una hoja.
create function private.jsonb_leaf_paths(j jsonb, prefix text default null)
returns setof text
language sql
immutable
set search_path = ''
as $$
  select case when prefix is null then e.key else prefix || '.' || e.key end
  from jsonb_each(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end) as e
  where jsonb_typeof(e.value) <> 'object' or e.value = '{}'::jsonb
  union all
  select private.jsonb_leaf_paths(e.value, case when prefix is null then e.key else prefix || '.' || e.key end)
  from jsonb_each(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end) as e
  where jsonb_typeof(e.value) = 'object' and e.value <> '{}'::jsonb;
$$;

-- ¿Escribir en p_path toca la clave bloqueada p_locked? Sí si es la misma, si
-- está dentro de ella o si la contiene (reemplazar "messages" pisa
-- "messages.welcome").
create function private.config_path_conflicts(p_path text, p_locked text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path = p_locked
      or p_path like p_locked || '.%'
      or p_locked like p_path || '.%';
$$;

-- Quita de j las rutas bloqueadas (y lo que cuelga de ellas). Si una clave
-- tiene rutas bloqueadas dentro y su valor no es un objeto, también se quita:
-- reemplazarla entera pisaría lo bloqueado.
create function private.jsonb_strip_paths(j jsonb, p_paths text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select jsonb_object_agg(e.key, case
        when jsonb_typeof(e.value) = 'object' then private.jsonb_strip_paths(
          e.value,
          array(select substr(p, length(e.key) + 2) from unnest(p_paths) p where p like e.key || '.%'))
        else e.value
      end)
     from jsonb_each(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end) as e
     where not (e.key = any (p_paths))
       and not (jsonb_typeof(e.value) <> 'object'
                and exists (select 1 from unnest(p_paths) p where p like e.key || '.%'))),
    '{}'::jsonb);
$$;

-- Rutas válidas para locked_keys: claves en minúscula separadas por puntos.
create function private.config_paths_valid(p_paths text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p is not null and p ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'), true)
  from unnest(p_paths) as p;
$$;

revoke all on function private.config_paths_valid(text[]) from public;
grant execute on function private.config_paths_valid(text[]) to service_role;

revoke all on function private.jsonb_deep_merge(jsonb, jsonb) from public;
revoke all on function private.jsonb_leaf_paths(jsonb, text) from public;
revoke all on function private.config_path_conflicts(text, text) from public;
revoke all on function private.jsonb_strip_paths(jsonb, text[]) from public;
grant execute on function private.jsonb_deep_merge(jsonb, jsonb) to service_role;
grant execute on function private.jsonb_leaf_paths(jsonb, text) to service_role;
grant execute on function private.config_path_conflicts(text, text) to service_role;
grant execute on function private.jsonb_strip_paths(jsonb, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.config_overrides (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_id        uuid not null references public.agents (id) on delete cascade,
  level           text not null check (level in ('organization', 'region', 'location')),
  -- El id de la organización, de la región o del local, según el nivel.
  level_id        uuid not null,
  "values"        jsonb not null default '{}' check (jsonb_typeof("values") = 'object'),
  locked_keys     text[] not null default '{}' check (private.config_paths_valid(locked_keys)),
  version         int not null default 1 check (version >= 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint config_overrides_agent_id_level_level_id_key unique (agent_id, level, level_id),
  constraint config_overrides_org_level_is_org check (level <> 'organization' or level_id = organization_id)
);
create index config_overrides_organization_id_idx on public.config_overrides (organization_id);

create table public.config_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_id        uuid not null references public.agents (id) on delete cascade,
  -- null = sin local (configuración de la organización).
  location_id     uuid references public.locations (id) on delete cascade,
  resolved        jsonb not null,
  -- sha256 del jsonb resuelto (su forma de texto es canónica).
  hash            text not null check (hash ~ '^[0-9a-f]{64}$'),
  created_at      timestamptz not null default now(),
  constraint config_snapshots_agent_id_location_id_hash_key unique nulls not distinct (agent_id, location_id, hash)
);
create index config_snapshots_organization_id_idx on public.config_snapshots (organization_id);
create index config_snapshots_location_id_idx on public.config_snapshots (location_id);

create trigger set_updated_at before update on public.config_overrides
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integridad y bloqueos. Actúan para todos los roles, también la plataforma.
-- Security definer para comprobar contra los datos reales; solo leen.
-- ---------------------------------------------------------------------------

-- Las claves bloqueadas por encima de un override: para una región, las de la
-- organización; para un local, las de la organización y las de su región.
create function private.config_locks_above(p_agent uuid, p_level text, p_level_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct k), '{}')
  from public.config_overrides o
  cross join unnest(o.locked_keys) as k
  where o.agent_id = p_agent
    and (
      (p_level in ('region', 'location') and o.level = 'organization')
      or (p_level = 'location' and o.level = 'region'
          and o.level_id = (select l.region_id from public.locations l where l.id = p_level_id))
    );
$$;

revoke all on function private.config_locks_above(uuid, text, uuid) from public;

create function private.validate_config_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked   text[];
  v_conflict text;
begin
  if not exists (select 1 from public.agents a where a.id = new.agent_id and a.organization_id = new.organization_id) then
    raise exception 'el agente no es de la organización %', new.organization_id using errcode = '23503';
  end if;

  if (new.level = 'region' and not exists (
        select 1 from public.regions r where r.id = new.level_id and r.organization_id = new.organization_id))
     or (new.level = 'location' and not exists (
        select 1 from public.locations l where l.id = new.level_id and l.organization_id = new.organization_id)) then
    raise exception 'el % % no es de la organización %', new.level, new.level_id, new.organization_id
      using errcode = '23503';
  end if;

  -- Hacia abajo: este override no puede tocar lo bloqueado por encima.
  v_locked := private.config_locks_above(new.agent_id, new.level, new.level_id);
  select p into v_conflict
  from private.jsonb_leaf_paths(new."values") as p
  where exists (select 1 from unnest(v_locked) as k where private.config_path_conflicts(p, k))
  limit 1;
  if v_conflict is not null then
    raise exception 'la clave % está bloqueada en un nivel superior', v_conflict using errcode = '23514';
  end if;

  -- Hacia arriba: no se bloquea una clave que un nivel inferior ya cambia.
  if new.level in ('organization', 'region') and cardinality(new.locked_keys) > 0 then
    select p into v_conflict
    from public.config_overrides o
    cross join private.jsonb_leaf_paths(o."values") as p
    where o.agent_id = new.agent_id
      and o.id <> new.id
      and (
        (new.level = 'organization' and o.level in ('region', 'location'))
        or (new.level = 'region' and o.level = 'location'
            and exists (select 1 from public.locations l where l.id = o.level_id and l.region_id = new.level_id))
      )
      and exists (select 1 from unnest(new.locked_keys) as k where private.config_path_conflicts(p, k))
    limit 1;
    if v_conflict is not null then
      raise exception 'no se puede bloquear: un nivel inferior ya cambia %', v_conflict using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_config_override() from public;

create trigger validate_config_override before insert or update on public.config_overrides
  for each row execute function private.validate_config_override();

-- Snapshots inmutables: nadie los cambia (sí se borran en cascada con su
-- agente, local u organización).
create function private.guard_config_snapshot_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'un config_snapshot no se modifica' using errcode = '42501';
end;
$$;

revoke all on function private.guard_config_snapshot_immutable() from public;

create trigger guard_immutable before update on public.config_snapshots
  for each row execute function private.guard_config_snapshot_immutable();

-- ---------------------------------------------------------------------------
-- Resolución y snapshot (los usa el worker, con la service role)
-- ---------------------------------------------------------------------------

-- Configuración resuelta de un agente en un local (o sin local), respetando los
-- bloqueos aunque un override los incumpliera.
create function private.resolve_agent_config(p_agent uuid, p_location uuid default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_org      uuid;
  v_region   uuid;
  v_resolved jsonb := '{}'::jsonb;  -- base: template.defaults cuando existan las plantillas
  v_locked   text[] := '{}'::text[];
  v_override public.config_overrides;
begin
  select a.organization_id into v_org from public.agents a where a.id = p_agent;
  if v_org is null then
    raise exception 'agente % desconocido', p_agent using errcode = 'P0002';
  end if;

  if p_location is not null then
    select l.region_id into v_region
    from public.locations l where l.id = p_location and l.organization_id = v_org;
    if not found then
      raise exception 'el local % no es de la organización del agente', p_location using errcode = '23503';
    end if;
  end if;

  for v_override in
    select o.* from public.config_overrides o
    where o.agent_id = p_agent
      and (
        o.level = 'organization'
        or (o.level = 'region' and o.level_id = v_region)
        or (o.level = 'location' and o.level_id = p_location)
      )
    order by case o.level when 'organization' then 1 when 'region' then 2 else 3 end
  loop
    v_resolved := private.jsonb_deep_merge(v_resolved, private.jsonb_strip_paths(v_override."values", v_locked));
    v_locked := v_locked || v_override.locked_keys;
  end loop;

  return v_resolved;
end;
$$;

-- Crea (o reutiliza, si nada ha cambiado) el snapshot de un agente en un local
-- y devuelve su id. Cada ejecución guardará este id.
create function private.snapshot_agent_config(p_agent uuid, p_location uuid default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_resolved jsonb := private.resolve_agent_config(p_agent, p_location);
  v_hash     text := encode(extensions.digest(v_resolved::text, 'sha256'), 'hex');
  v_id       uuid;
begin
  insert into public.config_snapshots (organization_id, agent_id, location_id, resolved, hash)
  select a.organization_id, p_agent, p_location, v_resolved, v_hash
  from public.agents a where a.id = p_agent
  on conflict (agent_id, location_id, hash) do nothing
  returning id into v_id;

  if v_id is null then
    select s.id into v_id from public.config_snapshots s
    where s.agent_id = p_agent and s.location_id is not distinct from p_location and s.hash = v_hash;
  end if;
  return v_id;
end;
$$;

revoke all on function private.resolve_agent_config(uuid, uuid) from public;
revoke all on function private.snapshot_agent_config(uuid, uuid) from public;
grant execute on function private.resolve_agent_config(uuid, uuid) to service_role;
grant execute on function private.snapshot_agent_config(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: la app solo lee. Cada uno ve la configuración de su alcance (la de la
-- organización, su región o sus locales); los snapshots, los miembros de la
-- organización; y el equipo interno con permiso de soporte vigente.
-- ---------------------------------------------------------------------------
alter table public.config_overrides enable row level security;
alter table public.config_snapshots enable row level security;
alter table public.config_overrides force row level security;
alter table public.config_snapshots force row level security;

revoke all on public.config_overrides, public.config_snapshots from anon, authenticated;
grant select on public.config_overrides, public.config_snapshots to authenticated;

create policy config_overrides_select on public.config_overrides
  for select to authenticated
  using (
    (select private.session_is_active())
    and (
      (level = 'organization' and private.has_org_role(organization_id))
      or (level = 'region' and private.can_access_region(organization_id, level_id))
      or (level = 'location' and private.can_access_location(organization_id, level_id))
    )
  );

create policy config_overrides_select_platform_staff on public.config_overrides
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

create policy config_snapshots_select on public.config_snapshots
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id));

create policy config_snapshots_select_platform_staff on public.config_snapshots
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));
