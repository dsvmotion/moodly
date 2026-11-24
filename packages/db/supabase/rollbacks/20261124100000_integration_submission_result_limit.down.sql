-- Vuelta atrás de 20261124100000_integration_submission_result_limit.sql:
-- quita el freno y el resultado del último envío, y deja las dos listas
-- blancas como en 20261114110000.
drop trigger if exists limit_secret_submissions on public.integration_secret_submissions;
drop function if exists private.limit_secret_submissions();
drop function if exists private.recent_key_submissions(uuid, uuid, timestamptz);
drop index if exists public.domain_events_key_submitted_idx;

create or replace function private.guard_integration_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if not (new.kind = 'platform' or (new.kind = 'native' and new.provider = 'koibox')) then
    raise exception 'una persona solo conecta integraciones de plataforma o de clave del cliente' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.external_connection_id is not null or new.secret_id is not null
       or new.server_version is not null or new.last_health_check is not null or new.scopes <> '{}'
       or new.last_submission_at is not null or new.last_submission_id is not null then
      raise exception 'una integración nueva empieza pendiente y sin conexión' using errcode = '42501';
    end if;
    new.connected_by := (select auth.uid());
    return new;
  end if;
  if (new.kind, new.provider) is distinct from (old.kind, old.provider) then
    raise exception 'el tipo y el proveedor de una integración no cambian' using errcode = '42501';
  end if;
  if (new.scopes, new.secret_id, new.server_version, new.last_health_check, new.last_submission_at, new.last_submission_id)
     is distinct from (old.scopes, old.secret_id, old.server_version, old.last_health_check, old.last_submission_at, old.last_submission_id) then
    raise exception 'esa columna de la integración no la cambia una persona' using errcode = '42501';
  end if;
  if new.status not in ('pending', 'disconnected') then
    raise exception 'una persona solo reconecta o desconecta una integración' using errcode = '42501';
  end if;
  if new.external_connection_id is distinct from old.external_connection_id
     and (new.external_connection_id is not null or new.status <> 'disconnected') then
    raise exception 'el id de la conexión lo pone la plataforma' using errcode = '42501';
  end if;
  if new.status = 'pending' then
    new.connected_by := (select auth.uid());
  elsif new.connected_by is distinct from old.connected_by then
    raise exception 'quién conectó la integración no cambia al desconectarla' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_worker_integration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'moodly_worker' then
    return new;
  end if;

  if old.kind = 'platform' then
    if new.status is distinct from old.status then
      if old.status = 'disconnected' then
        raise exception 'una integración desconectada solo la vuelve a conectar una persona' using errcode = '42501';
      end if;
      if new.status not in ('active', 'error') then
        raise exception 'el worker solo pone una integración activa o en error' using errcode = '42501';
      end if;
    end if;
    if new.external_connection_id is distinct from old.external_connection_id
       and (new.external_connection_id is null or new.status <> 'active') then
      raise exception 'el worker solo cambia el id de la conexión al activarla' using errcode = '42501';
    end if;
    if (new.last_submission_at, new.last_submission_id) is distinct from (old.last_submission_at, old.last_submission_id) then
      raise exception 'una integración de plataforma no recibe claves' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Solo las nativas de clave del cliente (hoy, Koibox: la misma lista que la
  -- guarda de la app); las mcp y las demás nativas, no.
  if not (old.kind = 'native' and old.provider = 'koibox') then
    raise exception 'el worker solo cambia integraciones de plataforma o de clave del cliente' using errcode = '42501';
  end if;

  -- Nativas (ADR 0055 §3).
  if new.status is distinct from old.status then
    if old.status = 'disconnected' then
      raise exception 'una integración desconectada solo la vuelve a conectar una persona' using errcode = '42501';
    end if;
    if new.status not in ('active', 'error') then
      raise exception 'el worker solo pone una integración activa o en error' using errcode = '42501';
    end if;
  end if;
  if new.external_connection_id is distinct from old.external_connection_id then
    raise exception 'una integración nativa no tiene id de conexión externa' using errcode = '42501';
  end if;
  if new.secret_id is distinct from old.secret_id then
    if new.secret_id is null then
      if not ((old.status = 'disconnected' and new.status = 'disconnected')
              or (old.status = 'pending' and new.status = 'error')) then
        raise exception 'el worker solo quita el secreto de una integración desconectada o de una pendiente que pasa a error'
          using errcode = '42501';
      end if;
    else
      if old.status = 'disconnected' then
        raise exception 'una integración desconectada no recibe un secreto' using errcode = '42501';
      end if;
      if not exists (
        select 1 from public.integration_secrets s
         where s.id = new.secret_id
           and s.organization_id = new.organization_id
           and s.kind = 'integration'
           and s.name = new.provider || '.' || coalesce(new.location_id::text, 'api_key')
      ) then
        raise exception 'ese secreto no es el de esta integración' using errcode = '42501';
      end if;
    end if;
  end if;
  if (new.last_submission_at, new.last_submission_id) is distinct from (old.last_submission_at, old.last_submission_id) then
    if new.last_submission_at is null or new.last_submission_id is null
       or (old.last_submission_at is not null
           and (new.last_submission_at, new.last_submission_id) <= (old.last_submission_at, old.last_submission_id)) then
      raise exception 'la marca del último envío solo avanza' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke select (last_submission_result), update (last_submission_result) on public.integrations from moodly_worker;
alter table public.integrations
  drop constraint if exists integrations_last_submission_result_pair,
  drop column if exists last_submission_result;
