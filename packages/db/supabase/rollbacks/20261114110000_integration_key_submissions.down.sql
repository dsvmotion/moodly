-- Vuelta atrás de 20261114110000 (alta de la clave de una integración nativa,
-- ADR 0055). Antes: desplegar una web y un worker sin el alta de la clave, y
-- borrar las integraciones nativas creadas desde la app (no hay datos de
-- clientes). Los eventos integration.key_submitted e integration.disconnected
-- ya escritos se quedan: sin consumidor, el worker de la versión anterior solo
-- los registra. Los secretos que el worker ya guardó se quedan (cifrados).

-- 5. Guardas del worker: la de los secretos fuera; la de integrations, como en 20261112210000.
drop trigger guard_worker_integration_secret on public.integration_secrets;
drop function private.guard_worker_integration_secret();
create or replace function private.guard_worker_integration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'moodly_worker' then
    return new;
  end if;
  -- Las mcp y native no las toca el worker (su conexión no viene de un webhook).
  if old.kind <> 'platform' then
    raise exception 'el worker solo cambia integraciones de plataforma' using errcode = '42501';
  end if;
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
  return new;
end;
$$;

-- 4. Privilegios de moodly_worker
revoke update (secret_id, last_submission_at, last_submission_id) on public.integrations from moodly_worker;
revoke select (last_submission_at, last_submission_id) on public.integrations from moodly_worker;
revoke delete on public.integration_secrets from moodly_worker;
revoke update (key_ref, encrypted_data_key, ciphertext, rotated_at) on public.integration_secrets from moodly_worker;
revoke insert (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext) on public.integration_secrets from moodly_worker;

-- 3. Eventos
drop trigger emit_integration_disconnected on public.integrations;
drop function private.emit_integration_disconnected();

-- 2. Los envíos (con sus políticas, su guarda y su evento)
drop table public.integration_secret_submissions;
drop function private.emit_integration_key_submitted();
drop function private.guard_secret_submission();

-- 1. integrations: la lista blanca de la app, como en 20261112210000; fuera la marca y la restricción.
create or replace function private.guard_integration_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.kind <> 'platform' then
    raise exception 'una persona solo conecta integraciones de plataforma' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.external_connection_id is not null or new.secret_id is not null
       or new.server_version is not null or new.last_health_check is not null or new.scopes <> '{}' then
      raise exception 'una integración nueva empieza pendiente y sin conexión' using errcode = '42501';
    end if;
    new.connected_by := (select auth.uid());
    return new;
  end if;
  if (new.scopes, new.secret_id, new.server_version, new.last_health_check)
     is distinct from (old.scopes, old.secret_id, old.server_version, old.last_health_check) then
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
alter table public.integrations
  drop constraint integrations_native_active_has_secret,
  drop constraint integrations_last_submission_pair,
  drop column last_submission_id,
  drop column last_submission_at;
