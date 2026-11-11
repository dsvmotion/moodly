-- D-01 y D-02 (auditoría preproducción 2026-11-10).
--
-- D-01. Borrar a una persona del equipo (auth.users → public.users) pone a
-- null, por sus claves ajenas «on delete set null», quién decidió una
-- aprobación (approvals.decided_by), quién la pidió (approvals.requested_by y
-- agent_runs.requested_by) y quién escribió una fuente de conocimiento
-- (knowledge_sources.created_by). Las guardas de esas tablas
-- (guard_approval, validate_agent_run y validate_knowledge_source) no dejan
-- cambiar esas columnas y rechazaban también ese null, así que no se podía
-- dar de baja ni borrar a nadie que hubiera decidido o pedido algo. Ahora
-- aceptan exactamente ese cambio: de una persona a null cuando esa persona ya
-- no existe en public.users (private.user_was_deleted). Cualquier otro cambio
-- de esas columnas sigue rechazado, para todos los roles.
--
-- D-02. Que lo que espera a una persona no se ejecute sin su aprobación vivía
-- solo en el código del worker. Ahora lo exige la base de datos, para todos
-- los roles (también la service role, con la que trabaja el worker, y el
-- dueño de las tablas): una máquina de estados en executions
-- (private.guard_execution_status).
--   Al nacer: suggested, drafted o needs_approval; executed o failed solo si
--   la política dejó ejecutar sin aprobación (autonomía execute o autonomous).
--   Nunca nace approved ni rejected.
--   Después:
--     suggested | drafted | needs_approval → approved | executed, solo con su
--       aprobación aprobada y con el mismo hash;
--     suggested | drafted | needs_approval → rejected | failed (no ejecutar
--       siempre se puede);
--     approved → executed | failed, también con su aprobación aprobada;
--     executed, failed y rejected son finales.
-- Y la service role ya no borra (ni vacía) runs, ejecuciones ni
-- aprobaciones: son el registro de qué se hizo y quién lo aprobó (borrar un
-- run borraría en cascada sus ejecuciones y aprobaciones). Ningún código de
-- producción los borra; el seed de desarrollo los limpia con la conexión del
-- dueño. Las cascadas (borrar un local o una organización) siguen
-- funcionando: las ejecuta el dueño de las tablas.
--
-- Security definer: private.user_was_deleted y
-- private.guard_execution_status solo leen (public.users y public.approvals),
-- sin pasar por sus políticas. No escriben en ninguna tabla.
--
-- Vuelta atrás: rollbacks/20261111200000_offboarding_execution_states.down.sql
-- (vuelve a las funciones de 20261030090000 y 20261031120000, quita el
-- trigger y las funciones nuevas y devuelve delete y truncate a la service
-- role en las tres tablas). No hay datos de clientes todavía.

-- ---------------------------------------------------------------------------
-- 1. D-01: el null que deja borrar a una persona
-- ---------------------------------------------------------------------------
-- Verdadero solo si la columna pasa de una persona a null y esa persona ya no
-- existe: el «on delete set null» de su clave ajena al borrarla.
create function private.user_was_deleted(p_old uuid, p_new uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_old is not null
     and p_new is null
     and not exists (select 1 from public.users u where u.id = p_old);
$$;
revoke all on function private.user_was_deleted(uuid, uuid) from public, anon, authenticated;
grant execute on function private.user_was_deleted(uuid, uuid) to service_role;

create or replace function private.validate_agent_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_by uuid := new.requested_by;
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
  if new.requested_by is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.requested_by and m.organization_id = new.organization_id
  ) then
    raise exception 'quien pide el run no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    -- Borrar a quien lo pidió deja el run sin él (D-01).
    if new.requested_by is distinct from old.requested_by then
      if private.user_was_deleted(old.requested_by, new.requested_by) then
        v_requested_by := old.requested_by;
      end if;
    end if;
    if (new.organization_id, new.location_id, new.agent_id, new.trigger, new.trigger_ref, v_requested_by, new.created_at)
       is distinct from (old.organization_id, old.location_id, old.agent_id, old.trigger, old.trigger_ref, old.requested_by, old.created_at) then
      raise exception 'la organización, el local, el agente y el origen de un run no cambian' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.guard_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_requested_by uuid := new.requested_by;
  v_decided_by uuid := new.decided_by;
begin
  -- Borrar a quien la pidió o a quien la decidió deja la aprobación sin él (D-01).
  if new.requested_by is distinct from old.requested_by then
    if private.user_was_deleted(old.requested_by, new.requested_by) then
      v_requested_by := old.requested_by;
    end if;
  end if;
  if new.decided_by is distinct from old.decided_by and new.status is not distinct from old.status then
    if private.user_was_deleted(old.decided_by, new.decided_by) then
      v_decided_by := old.decided_by;
    end if;
  end if;

  if (new.execution_id, new.organization_id, new.location_id, new.effect_class, new.input_hash,
      new.required_role, new.reason, v_requested_by, new.expires_at, new.created_at)
     is distinct from
     (old.execution_id, old.organization_id, old.location_id, old.effect_class, old.input_hash,
      old.required_role, old.reason, old.requested_by, old.expires_at, old.created_at) then
    raise exception 'lo que se aprueba no cambia' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then
    if (v_decided_by, new.decided_at) is distinct from (old.decided_by, old.decided_at) then
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

create or replace function private.validate_knowledge_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_by uuid := new.created_by;
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local de la fuente no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    -- Borrar a quien la escribió deja la fuente sin autor (D-01).
    if new.created_by is distinct from old.created_by then
      if private.user_was_deleted(old.created_by, new.created_by) then
        v_created_by := old.created_by;
      end if;
    end if;
    if (new.organization_id, new.location_id, v_created_by, new.created_at)
       is distinct from (old.organization_id, old.location_id, old.created_by, old.created_at) then
      raise exception 'la organización, el local y el autor de una fuente no cambian' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. D-02: la máquina de estados de una ejecución
-- ---------------------------------------------------------------------------
create function private.guard_execution_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved boolean;
begin
  if tg_op = 'INSERT' then
    if new.status in ('approved', 'rejected') then
      raise exception 'una ejecución no nace aprobada ni rechazada' using errcode = '42501';
    end if;
    if new.status in ('executed', 'failed') and new.autonomy_applied not in ('execute', 'autonomous') then
      raise exception 'sin autonomía para ejecutar, una ejecución nace esperando a una persona' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('executed', 'failed', 'rejected') then
    raise exception 'una ejecución terminada no cambia de estado' using errcode = '42501';
  end if;

  v_approved := exists (
    select 1 from public.approvals a
    where a.execution_id = new.id
      and a.status = 'approved'
      and a.input_hash = new.input_hash
  );
  if old.status in ('suggested', 'drafted', 'needs_approval') then
    if new.status in ('rejected', 'failed') then
      return new;
    end if;
    if new.status in ('approved', 'executed') then
      if not v_approved then
        raise exception 'lo que espera a una persona no se ejecuta sin su aprobación' using errcode = '42501';
      end if;
      return new;
    end if;
  elsif old.status = 'approved' then
    if new.status in ('executed', 'failed') then
      if not v_approved then
        raise exception 'lo que espera a una persona no se ejecuta sin su aprobación' using errcode = '42501';
      end if;
      return new;
    end if;
  end if;
  raise exception 'una ejecución no pasa de % a %', old.status, new.status using errcode = '42501';
end;
$$;
revoke all on function private.guard_execution_status() from public, anon, authenticated, service_role;
create trigger guard_execution_status before insert or update on public.executions
  for each row execute function private.guard_execution_status();

-- ---------------------------------------------------------------------------
-- 3. D-02: nadie de la app ni de la plataforma borra el registro
-- ---------------------------------------------------------------------------
revoke delete, truncate on public.agent_runs, public.executions, public.approvals from service_role;
