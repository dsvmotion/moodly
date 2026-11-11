-- Vuelta atrás de 20261111200000_offboarding_execution_states.sql: las guardas
-- vuelven a rechazar el null que deja borrar a una persona (D-01), las
-- ejecuciones vuelven a no tener máquina de estados en la base de datos y la
-- service role vuelve a poder borrar ejecuciones y aprobaciones (D-02).
-- Las funciones vuelven a su versión de 20261030090000 y 20261031120000.

grant delete, truncate on public.executions, public.approvals to service_role;

drop trigger guard_execution_status on public.executions;
drop function private.guard_execution_status();

create or replace function private.validate_agent_run()
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
  if new.requested_by is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.requested_by and m.organization_id = new.organization_id
  ) then
    raise exception 'quien pide el run no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id, new.location_id, new.agent_id, new.trigger, new.trigger_ref, new.requested_by, new.created_at)
     is distinct from (old.organization_id, old.location_id, old.agent_id, old.trigger, old.trigger_ref, old.requested_by, old.created_at) then
    raise exception 'la organización, el local, el agente y el origen de un run no cambian' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.execution_id, new.organization_id, new.location_id, new.effect_class, new.input_hash,
      new.required_role, new.reason, new.requested_by, new.expires_at, new.created_at)
     is distinct from
     (old.execution_id, old.organization_id, old.location_id, old.effect_class, old.input_hash,
      old.required_role, old.reason, old.requested_by, old.expires_at, old.created_at) then
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

create or replace function private.validate_knowledge_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local de la fuente no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id, new.location_id, new.created_by, new.created_at)
     is distinct from (old.organization_id, old.location_id, old.created_by, old.created_at) then
    raise exception 'la organización, el local y el autor de una fuente no cambian' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop function private.user_was_deleted(uuid, uuid);
