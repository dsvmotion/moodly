-- Alta de la clave de una integración nativa (int-koibox, O-02; ADR 0055
-- aceptado el 2026-11-14, opción A). El org_admin pega la clave del cliente en
-- la web, la web la cifra hacia el worker con la parte pública de la clave de
-- ingreso y la deja en una tabla de solo inserción; el worker la abre, la
-- comprueba, la vuelve a cifrar con SecretVault en integration_secrets y borra
-- el envío. Aquí solo va la base de datos; el código de la web y del worker
-- llega en el PR siguiente.
--
-- 1. integrations:
--    - last_submission_at y last_submission_id: la marca del último envío
--      procesado (aplicado o rechazado). Solo la escribe el worker, y solo
--      hacia delante (guarda del punto 5).
--    - Una nativa activa siempre tiene secreto (integrations_native_active_has_secret).
--    - guard_integration_write (la lista blanca de la app, ADR 0003) admite
--      ahora también las nativas de clave del cliente (solo 'koibox'): crearla
--      pendiente, reconectarla y desconectarla, igual que las de plataforma.
--      Las marcas nuevas tampoco las cambia una persona.
-- 2. integration_secret_submissions: el envío cifrado.
--    - La app solo inserta: política de INSERT para el org_admin con aal2 y
--      privilegios de INSERT por columna; ni SELECT, ni UPDATE, ni DELETE.
--    - guard_secret_submission (solo authenticated): submitted_by y created_at
--      los pone la base de datos, y la integración tiene que ser de la misma
--      organización, nativa, del mismo proveedor y pendiente, activa o en error.
--    - Sin restricción de unicidad por integración (ADR 0055 §2): el worker
--      procesa el más reciente y borra los demás; el límite de envíos lo pone
--      el servidor de la web.
-- 3. Eventos del outbox (ADR 0009), solo con ids; la organización y el local
--    salen de la fila, nunca del cliente:
--    - integration.key_submitted, en la misma transacción que el envío;
--    - integration.disconnected, al desconectar una nativa que tenía secreto,
--      con el secret_id anterior (OLD.secret_id), para que el worker limpie
--      exactamente ese secreto.
-- 4. moodly_worker (ADR 0049), por columna y con su política por organización:
--    - integration_secret_submissions: SELECT de lo que necesita y DELETE;
--    - integration_secrets: INSERT, UPDATE (la clave, al rotar) y DELETE;
--    - integrations: UPDATE de secret_id y de la marca, y SELECT de la marca.
-- 5. Guardas del worker (solo moodly_worker; listas blancas):
--    - guard_worker_integration se amplía a las nativas (ADR 0055 §3);
--    - guard_worker_integration_secret, nueva: solo secretos de integración
--      (nunca los de BYOK), sin cambiar su organización, tipo ni nombre, y con
--      rotated_at = now() al cambiar la clave.
--
-- Funciones security definer (las dos son triggers; nadie las llama directamente):
-- - emit_integration_key_submitted y emit_integration_disconnected escriben
--   una sola fila en domain_events (authenticated no tiene INSERT en la tabla),
--   con la organización y el local de la fila y solo ids, como
--   emit_conversation_handed_off (20261112200000). No escriben en ninguna otra
--   tabla. Tests en negativo en 57_integration_key_submissions.
-- Las guardas son invoker: se ejecutan como quien escribe, y RLS sigue actuando.
--
-- Vuelta atrás: rollbacks/20261114110000_integration_key_submissions.down.sql.

-- ---------------------------------------------------------------------------
-- 1. integrations
-- ---------------------------------------------------------------------------
alter table public.integrations
  add column last_submission_at timestamptz,
  add column last_submission_id uuid,
  add constraint integrations_last_submission_pair check ((last_submission_at is null) = (last_submission_id is null)),
  add constraint integrations_native_active_has_secret check (kind <> 'native' or status <> 'active' or secret_id is not null);

-- La lista blanca de la app (20261112210000), con las nativas de clave del
-- cliente. Las mismas reglas que una de plataforma: una persona crea la
-- integración pendiente y sin conexión, la reconecta (pendiente) o la desconecta.
-- El secreto, el estado activo o en error y la marca del último envío los pone
-- la plataforma (el worker).
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

-- ---------------------------------------------------------------------------
-- 2. integration_secret_submissions
-- ---------------------------------------------------------------------------
create table public.integration_secret_submissions (
  -- Lo genera el servidor de la web antes de cifrar: va en el dato asociado.
  -- Sin valor por defecto; la clave primaria impide reutilizarlo.
  id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  integration_id uuid not null,
  provider text not null check (provider ~ '^[a-z][a-z0-9-]{1,39}$'),
  -- Qué clave de ingreso cifró la clave de datos (ARN de KMS, o «local:<versión>»).
  key_ref text not null check (length(key_ref) between 3 and 300),
  encrypted_data_key text not null check (encrypted_data_key ~ '^[A-Za-z0-9+/]+={0,2}$' and length(encrypted_data_key) <= 2048),
  ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$' and length(ciphertext) <= 8192),
  submitted_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint integration_secret_submissions_integration_same_org foreign key (integration_id, organization_id)
    references public.integrations (id, organization_id) on delete cascade
);
-- El worker busca los envíos de una integración, el más reciente primero (y
-- sirve de índice a la clave externa a integrations).
create index integration_secret_submissions_integration_idx
  on public.integration_secret_submissions (integration_id, organization_id, created_at desc, id desc);
create index integration_secret_submissions_organization_idx on public.integration_secret_submissions (organization_id);
create index integration_secret_submissions_submitted_by_idx on public.integration_secret_submissions (submitted_by);

alter table public.integration_secret_submissions enable row level security;
alter table public.integration_secret_submissions force row level security;

-- La app solo inserta, y solo el org_admin con MFA de esa organización.
create policy integration_secret_submissions_insert on public.integration_secret_submissions
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

-- El worker, solo en la organización fijada en la transacción (ADR 0049).
create policy integration_secret_submissions_worker on public.integration_secret_submissions
  for all to moodly_worker
  using (organization_id = (select private.worker_organization_id()))
  with check (organization_id = (select private.worker_organization_id()));

revoke all on public.integration_secret_submissions from anon, authenticated, service_role;
grant insert (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  on public.integration_secret_submissions to authenticated;

-- Quién envía y cuándo lo pone la base de datos; la integración tiene que
-- poder recibir una clave. Invoker: lee la integración con RLS, como la sesión
-- que inserta (el org_admin la ve). Solo actúa con authenticated.
create function private.guard_secret_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  new.submitted_by := (select auth.uid());
  new.created_at := now();
  if not exists (
    select 1 from public.integrations i
     where i.id = new.integration_id
       and i.organization_id = new.organization_id
       and i.kind = 'native'
       and i.provider = 'koibox'
       and i.provider = new.provider
       and i.status in ('pending', 'active', 'error')
  ) then
    raise exception 'esa integración no admite una clave nueva' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_secret_submission() from public;
create trigger guard_secret_submission before insert on public.integration_secret_submissions
  for each row execute function private.guard_secret_submission();

-- ---------------------------------------------------------------------------
-- 3. Eventos del outbox
-- ---------------------------------------------------------------------------
create function private.emit_integration_key_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_events (organization_id, location_id, type, payload)
  select new.organization_id, i.location_id, 'integration.key_submitted',
         jsonb_build_object('submission_id', new.id, 'integration_id', new.integration_id, 'provider', new.provider)
    from public.integrations i
   where i.id = new.integration_id and i.organization_id = new.organization_id;
  return null;
end;
$$;
revoke all on function private.emit_integration_key_submitted() from public, anon, authenticated, service_role;
create trigger emit_integration_key_submitted after insert on public.integration_secret_submissions
  for each row execute function private.emit_integration_key_submitted();

create function private.emit_integration_disconnected()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_events (organization_id, location_id, type, payload)
  values (new.organization_id, new.location_id, 'integration.disconnected',
          jsonb_build_object('integration_id', new.id, 'provider', new.provider, 'secret_id', old.secret_id));
  return null;
end;
$$;
revoke all on function private.emit_integration_disconnected() from public, anon, authenticated, service_role;
create trigger emit_integration_disconnected after update of status on public.integrations
  for each row
  when (old.kind = 'native' and old.status <> 'disconnected' and new.status = 'disconnected' and old.secret_id is not null)
  execute function private.emit_integration_disconnected();

-- ---------------------------------------------------------------------------
-- 4. Privilegios de moodly_worker
-- ---------------------------------------------------------------------------
grant select (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext, created_at)
  on public.integration_secret_submissions to moodly_worker;
grant delete on public.integration_secret_submissions to moodly_worker;

grant insert (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
  on public.integration_secrets to moodly_worker;
grant update (key_ref, encrypted_data_key, ciphertext, rotated_at) on public.integration_secrets to moodly_worker;
grant delete on public.integration_secrets to moodly_worker;

grant select (last_submission_at, last_submission_id) on public.integrations to moodly_worker;
grant update (secret_id, last_submission_at, last_submission_id) on public.integrations to moodly_worker;

-- ---------------------------------------------------------------------------
-- 5. Guardas del worker
-- ---------------------------------------------------------------------------
-- La lista blanca del worker sobre integrations (20261112210000), ampliada a
-- las nativas. Invoker; solo actúa con moodly_worker.
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

-- El worker solo toca secretos de integración (nunca las claves de modelo de
-- BYOK, ADR 0034), no los mueve de organización ni los renombra, y al cambiar
-- la clave queda la hora de la rotación. Invoker; solo actúa con moodly_worker.
create function private.guard_worker_integration_secret()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'moodly_worker' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.kind <> 'integration' then
      raise exception 'el worker solo borra secretos de integración' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.kind <> 'integration' then
    raise exception 'el worker solo escribe secretos de integración' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if old.kind <> 'integration' then
      raise exception 'el worker solo escribe secretos de integración' using errcode = '42501';
    end if;
    if (new.organization_id, new.kind, new.name) is distinct from (old.organization_id, old.kind, old.name) then
      raise exception 'la organización, el tipo y el nombre de un secreto no cambian' using errcode = '42501';
    end if;
    new.rotated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_integration_secret() from public;
create trigger guard_worker_integration_secret before insert or update or delete on public.integration_secrets
  for each row execute function private.guard_worker_integration_secret();
