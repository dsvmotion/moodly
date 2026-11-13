-- Integraciones de plataforma (O-02, ADR 0053 §2): la conexión vive en la
-- plataforma de conectores (Nango) y la fila de integrations guarda su id. Es
-- la misma tabla que las mcp y native: una sola fila por integración.
--
-- 1. integrations.kind admite 'platform', con external_connection_id (el id de
--    la conexión en Nango), único en toda la tabla: dos organizaciones nunca
--    apuntan a la misma conexión. Una de plataforma no tiene versión de
--    servidor ni secreto propio (el token vive en Nango, ADR 0053), y activa
--    siempre tiene su id.
-- 2. El org_admin, con MFA (aal2), crea la fila «pendiente» al empezar a
--    conectar y la pasa a «pendiente» (reconectar) o a «desconectada». Nada
--    más: la guarda guard_integration_write (lista blanca, solo para
--    authenticated) impide que una persona la ponga activa, le dé un id de
--    conexión o cambie otra columna. Activa, error y el id los pone el worker
--    cuando llega el webhook firmado de Nango.
-- 3. El worker (moodly_worker, ADR 0049): lee integrations y cambia solo
--    status, external_connection_id y last_health_check, de la organización
--    fijada en la transacción (la política integrations_worker ya existe,
--    20261112040500).
--
-- Sin funciones security definer nuevas: la guarda se ejecuta como quien escribe.
--
-- Vuelta atrás (no hay datos de clientes; antes, borrar las filas 'platform'):
--   revoke select, update on public.integrations from moodly_worker;
--   drop trigger guard_integration_write on public.integrations; drop function private.guard_integration_write();
--   drop policy integrations_insert on public.integrations; drop policy integrations_update on public.integrations;
--   revoke insert, update on public.integrations from authenticated;
--   delete from public.integrations where kind = 'platform';
--   alter table public.integrations drop constraint integrations_platform_shape,
--     drop constraint integrations_platform_active_has_connection,
--     drop constraint integrations_external_connection_id_key, drop column external_connection_id,
--     drop constraint integrations_kind_check,
--     add constraint integrations_kind_check check (kind in ('mcp', 'native'));

-- ---------------------------------------------------------------------------
-- 1. kind 'platform' y el id de la conexión externa
-- ---------------------------------------------------------------------------
alter table public.integrations
  drop constraint integrations_kind_check,
  add constraint integrations_kind_check check (kind in ('mcp', 'native', 'platform')),
  -- El id de la conexión en la plataforma (Nango: un UUID; se admite cualquier
  -- id razonable, sin espacios ni barras).
  add column external_connection_id text check (external_connection_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@-]{0,254}$'),
  add constraint integrations_external_connection_id_key unique (external_connection_id),
  add constraint integrations_platform_shape check (
    kind <> 'platform' or (server_version is null and secret_id is null)
  ),
  add constraint integrations_platform_active_has_connection check (
    kind <> 'platform' or status <> 'active' or external_connection_id is not null
  ),
  -- Solo las de plataforma tienen id externo.
  add constraint integrations_external_connection_only_platform check (
    kind = 'platform' or external_connection_id is null
  );

-- ---------------------------------------------------------------------------
-- 2. El org_admin conecta y desconecta (con MFA)
-- ---------------------------------------------------------------------------
create policy integrations_insert on public.integrations
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy integrations_update on public.integrations
  for update to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

grant insert (organization_id, location_id, provider, kind, status, connected_by) on public.integrations to authenticated;
grant update (status, connected_by, external_connection_id) on public.integrations to authenticated;

-- Lista blanca de lo que una persona puede hacer con una integración (ADR 0003):
-- - crear una de plataforma, pendiente, sin id externo, conectada por ella;
-- - pasarla a pendiente (reconectar: queda a su nombre) o a desconectada (y el
--   id externo, si cambia, solo a null);
-- - nada más. Activa, error y el id externo los pone la plataforma (el worker,
--   tras verificar el webhook firmado de Nango). Solo actúa con authenticated.
create function private.guard_integration_write()
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
revoke all on function private.guard_integration_write() from public;
create trigger guard_integration_write before insert or update on public.integrations
  for each row execute function private.guard_integration_write();

-- ---------------------------------------------------------------------------
-- 3. El worker
-- ---------------------------------------------------------------------------
grant select on public.integrations to moodly_worker;
grant update (status, external_connection_id, last_health_check) on public.integrations to moodly_worker;
