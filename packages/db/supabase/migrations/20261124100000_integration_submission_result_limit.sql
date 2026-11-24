-- El alta de la clave de una integración nativa (ADR 0055; int-koibox),
-- segunda parte de la base de datos. Decisiones de producto del 2026-11-24:
--
-- 1. integrations.last_submission_result ('applied' | 'rejected'): qué pasó con
--    el último envío procesado, para que la pantalla diga «clave no válida»
--    también al rotar (la integración sigue activa con la clave anterior).
--    - Lo escribe solo el worker y solo junto con la marca
--      (last_submission_at, last_submission_id): cada vez que la marca avanza
--      lleva su resultado, y el resultado no cambia sin que avance la marca
--      (guard_worker_integration).
--    - Una persona no lo pone ni lo cambia (guard_integration_write, la lista
--      blanca de la app).
--    - Sin marca no hay resultado (integrations_last_submission_result_pair).
--    - moodly_worker: SELECT y UPDATE de la columna.
--
-- 2. El freno de envíos: como mucho 5 envíos por integración en 15 minutos,
--    en la propia base de datos, al insertar.
--    - limit_secret_submissions: AFTER INSERT FOR EACH ROW en
--      integration_secret_submissions, solo con authenticated (como las
--      guardas, ADR 0003). Es AFTER y no BEFORE porque el evento lo escribe
--      emit_integration_key_submitted, que también es AFTER ROW: los AFTER de una
--      sentencia corren al acabarla, fila a fila y, en cada fila, por orden
--      alfabético (emit_… antes que limit_…). Así, en un INSERT de varias filas
--      (la API acepta un array), cada fila cuenta los eventos de las anteriores
--      y el suyo; con un BEFORE, todas verían 0 y entrarían todas.
--    - Cuenta los eventos integration.key_submitted de la misma organización e
--      integración de los últimos 15 minutos (now(), la hora del servidor), no
--      las filas de envíos: el worker borra cada envío en cuanto lo procesa
--      (ADR 0055 §3, el texto cifrado vive lo mínimo), y nadie borra
--      domain_events fuera de los tests. El evento lo escribe la base de datos,
--      con la organización y la integración de la fila (NEW), nunca del cliente.
--    - Con más de 5 (el suyo incluido), falla con SQLSTATE 54000 (el mismo que
--      el freno del chat de prueba, 20261104090000) y la sentencia entera se
--      deshace: ni envíos ni eventos. La web lo traduce a «demasiados intentos».
--    - Un cerrojo de transacción por integración (pg_advisory_xact_lock, con el
--      uuid de la integración, único entre organizaciones; una colisión del
--      hash de 64 bits solo haría esperar, nunca contar mal): dos envíos a la vez
--      no pasan los dos como el quinto. El segundo espera al commit del primero
--      y cuenta con una instantánea nueva, que ya ve su evento.
--    - Índice parcial de domain_events para esa cuenta.
--
-- Funciones:
-- - limit_secret_submissions, el trigger: invoker, como las guardas (dentro de
--   una security definer, current_user sería su dueño y la comprobación de
--   authenticated no serviría). Toma el cerrojo y llama a la cuenta.
--   (También AFTER ROW, ver arriba.)
-- - recent_key_submissions, la cuenta: security definer porque la app no tiene
--   SELECT en domain_events. Solo lee: una cuenta filtrada por la organización
--   y la integración de la fila (nunca del cliente), y solo para una sesión
--   activa de quien administra esa organización. No escribe en ninguna tabla. search_path
--   vacío. Ejecutable solo por authenticated (private no lo expone la API).
-- Tests en negativo en 61_integration_submission_limit.
--
-- Vuelta atrás: rollbacks/20261124100000_integration_submission_result_limit.down.sql.

-- ---------------------------------------------------------------------------
-- 1. integrations.last_submission_result
-- ---------------------------------------------------------------------------
alter table public.integrations
  add column last_submission_result text check (last_submission_result in ('applied', 'rejected')),
  add constraint integrations_last_submission_result_pair
    check (last_submission_result is null or last_submission_id is not null);

grant select (last_submission_result) on public.integrations to moodly_worker;
grant update (last_submission_result) on public.integrations to moodly_worker;

-- La lista blanca de la app (20261114110000), con la columna nueva.
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
       or new.last_submission_at is not null or new.last_submission_id is not null
       or new.last_submission_result is not null then
      raise exception 'una integración nueva empieza pendiente y sin conexión' using errcode = '42501';
    end if;
    new.connected_by := (select auth.uid());
    return new;
  end if;
  if (new.kind, new.provider) is distinct from (old.kind, old.provider) then
    raise exception 'el tipo y el proveedor de una integración no cambian' using errcode = '42501';
  end if;
  if (new.scopes, new.secret_id, new.server_version, new.last_health_check,
      new.last_submission_at, new.last_submission_id, new.last_submission_result)
     is distinct from (old.scopes, old.secret_id, old.server_version, old.last_health_check,
                       old.last_submission_at, old.last_submission_id, old.last_submission_result) then
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

-- La lista blanca del worker (20261114110000), con la columna nueva.
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
    if (new.last_submission_at, new.last_submission_id, new.last_submission_result)
       is distinct from (old.last_submission_at, old.last_submission_id, old.last_submission_result) then
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
    -- Cada envío procesado deja su resultado, con la marca (20261124100000).
    if new.last_submission_result is null then
      raise exception 'la marca del último envío avanza con su resultado' using errcode = '42501';
    end if;
  elsif new.last_submission_result is distinct from old.last_submission_result then
    raise exception 'el resultado del último envío solo cambia con la marca' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. El freno de envíos
-- ---------------------------------------------------------------------------
create index domain_events_key_submitted_idx
  on public.domain_events (organization_id, ((payload ->> 'integration_id')), created_at)
  where type = 'integration.key_submitted';

-- La cuenta: security definer porque la app no lee domain_events. Solo lee, y
-- solo para una sesión activa de quien administra esa organización (la llama
-- el trigger de abajo, en la misma sentencia que el INSERT).
create function private.recent_key_submissions(p_organization_id uuid, p_integration_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select private.session_is_active()) and private.has_org_role(p_organization_id, array['org_admin'])) then
    raise exception 'solo quien administra la organización' using errcode = '42501';
  end if;
  return (select count(*)::int
            from public.domain_events e
           where e.organization_id = p_organization_id
             and e.type = 'integration.key_submitted'
             and e.payload ->> 'integration_id' = p_integration_id::text
             and e.created_at > now() - interval '15 minutes');
end;
$$;
revoke all on function private.recent_key_submissions(uuid, uuid) from public, anon, service_role, moodly_worker;
grant execute on function private.recent_key_submissions(uuid, uuid) to authenticated;

-- El freno. Invoker (como las guardas): solo actúa con authenticated. AFTER
-- ROW, después de emit_integration_key_submitted (orden alfabético): la cuenta
-- ya incluye el evento de esta fila y los de las filas anteriores de la misma
-- sentencia.
create function private.limit_secret_submissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('integration_secret_submissions:' || new.integration_id::text, 0));
  if private.recent_key_submissions(new.organization_id, new.integration_id) > 5 then
    raise exception 'demasiados envíos de clave para esta integración: espera unos minutos' using errcode = '54000';
  end if;
  return null;
end;
$$;
revoke all on function private.limit_secret_submissions() from public;
create trigger limit_secret_submissions after insert on public.integration_secret_submissions
  for each row execute function private.limit_secret_submissions();
