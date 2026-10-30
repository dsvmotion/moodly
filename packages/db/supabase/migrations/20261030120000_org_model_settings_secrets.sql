-- Política de modelos por organización y secretos cifrados (paso 3b; ADR 0034
-- y 0035, sobre el 0019 y el 0033). Solo modelo de datos: no activa proveedores
-- ni guarda ninguna clave real.
--
-- - org_model_settings: residencia del procesamiento («Solo UE» o cualquiera
--   con DPA), proveedores permitidos, modelo por tarea (claves lógicas de
--   @repo/config) y topes de gasto. La lee el enrutador; la gestiona el
--   org_admin con aal2. El modo de conexión (managed, byok, customer_cloud) lo
--   pone solo la plataforma, cuando guarda las claves del cliente: la app no
--   puede cambiarlo. Cada cambio queda en audit_logs.
-- - integration_secrets: secretos con cifrado de sobre (SecretVault del
--   worker). La app no los lee ni los escribe: ni una política, ni un
--   privilegio para anon o authenticated.
--
-- Vuelta atrás: drop de integration_secrets y org_model_settings, y de las
-- funciones private.validate_org_model_settings, private.guard_org_model_settings
-- y private.audit_org_model_settings. No hay datos de clientes todavía.

-- ---------------------------------------------------------------------------
-- 1. org_model_settings
-- ---------------------------------------------------------------------------
create table public.org_model_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  residency text not null default 'any' check (residency in ('any', 'eu')),
  allowed_providers text[] not null default '{}',
  -- Solo las tareas que cambian respecto al valor por defecto de plataforma.
  model_by_task jsonb not null default '{}'::jsonb check (jsonb_typeof(model_by_task) = 'object'),
  connection text not null default 'managed' check (connection in ('managed', 'byok', 'customer_cloud')),
  budget_per_run_eur numeric(10, 4) not null default 0.5 check (budget_per_run_eur > 0 and budget_per_run_eur <= 100),
  budget_per_day_eur numeric(12, 4) not null default 20 check (budget_per_day_eur > 0 and budget_per_day_eur <= 100000),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint org_model_settings_budget_order check (budget_per_run_eur <= budget_per_day_eur)
);
create index org_model_settings_updated_by_idx on public.org_model_settings (updated_by);

-- Proveedores y modelo por tarea con formato cerrado (las claves de
-- @repo/config: un test de agent-core comprueba que coinciden).
create function private.validate_org_model_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_task text;
  v_key text;
begin
  if exists (select 1 from unnest(new.allowed_providers) p where p !~ '^[a-z][a-z0-9-]{1,39}$')
     or cardinality(new.allowed_providers) > 20
     or cardinality(new.allowed_providers) <> (select count(distinct p) from unnest(new.allowed_providers) p) then
    raise exception 'allowed_providers: nombres en minúsculas, sin repetir, como mucho 20' using errcode = '23514';
  end if;
  for v_task, v_key in select key, value #>> '{}' from jsonb_each(new.model_by_task) loop
    if v_task not in ('classify', 'extract', 'converse', 'reason', 'embed')
       or jsonb_typeof(new.model_by_task -> v_task) <> 'string'
       or v_key not in ('fast', 'smart', 'embedding') then
      raise exception 'model_by_task: tarea o clave de modelo desconocida (%)', v_task using errcode = '23514';
    end if;
  end loop;
  -- Los embeddings solo con la clave de embeddings, y la conversación nunca con ella.
  if (new.model_by_task ? 'embed' and new.model_by_task ->> 'embed' <> 'embedding')
     or exists (select 1 from jsonb_each_text(new.model_by_task) t where t.key <> 'embed' and t.value = 'embedding') then
    raise exception 'model_by_task: embed usa siempre la clave embedding, y solo embed' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_org_model_settings() from public;
create trigger validate_org_model_settings before insert or update on public.org_model_settings
  for each row execute function private.validate_org_model_settings();

-- Qué cambia el org_admin (lista blanca, ADR 0003): residencia, proveedores,
-- modelo por tarea y topes. El modo de conexión y la organización, nunca; la
-- base de datos pone quién y cuándo.
create function private.guard_org_model_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' and new.connection <> 'managed' then
      raise exception 'el modo de conexión lo pone la plataforma al guardar las claves' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.organization_id, new.connection) is distinct from (old.organization_id, old.connection) then
      raise exception 'el modo de conexión lo pone la plataforma al guardar las claves' using errcode = '42501';
    end if;
    new.updated_by := (select auth.uid());
  else
    -- Un cambio de la plataforma (service role, migraciones): sin persona.
    new.updated_by := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_org_model_settings() from public;
create trigger guard_org_model_settings before insert or update on public.org_model_settings
  for each row execute function private.guard_org_model_settings();

-- Auditoría de cada cambio (también los de la plataforma). Security definer:
-- quien cambia la política no puede escribir en audit_logs. Escribe solo esa
-- fila, con la organización de la fila y lo que cambió; sin datos personales.
create function private.audit_org_model_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed jsonb := '{}'::jsonb;
  -- Quién cambió lo decide la guarda (que ve el rol real); aquí, como security
  -- definer, current_user es el dueño de la función y no sirve para eso.
  v_actor uuid := new.updated_by;
begin
  if tg_op = 'INSERT' then
    v_changed := jsonb_build_object('residency', new.residency, 'allowed_providers', new.allowed_providers,
      'model_by_task', new.model_by_task, 'connection', new.connection,
      'budget_per_run_eur', new.budget_per_run_eur, 'budget_per_day_eur', new.budget_per_day_eur);
  else
    if new.residency is distinct from old.residency then v_changed := v_changed || jsonb_build_object('residency', new.residency); end if;
    if new.allowed_providers is distinct from old.allowed_providers then v_changed := v_changed || jsonb_build_object('allowed_providers', new.allowed_providers); end if;
    if new.model_by_task is distinct from old.model_by_task then v_changed := v_changed || jsonb_build_object('model_by_task', new.model_by_task); end if;
    if new.connection is distinct from old.connection then v_changed := v_changed || jsonb_build_object('connection', new.connection); end if;
    if new.budget_per_run_eur is distinct from old.budget_per_run_eur then v_changed := v_changed || jsonb_build_object('budget_per_run_eur', new.budget_per_run_eur); end if;
    if new.budget_per_day_eur is distinct from old.budget_per_day_eur then v_changed := v_changed || jsonb_build_object('budget_per_day_eur', new.budget_per_day_eur); end if;
    if v_changed = '{}'::jsonb then return null; end if;
  end if;
  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target, metadata)
  values (new.organization_id,
          case when v_actor is null then 'system' else 'user' end,
          v_actor,
          'model_settings.' || lower(tg_op),
          jsonb_build_object('organization_id', new.organization_id),
          jsonb_build_object('changed', v_changed));
  return null;
end;
$$;
revoke all on function private.audit_org_model_settings() from public;
create trigger audit_org_model_settings after insert or update on public.org_model_settings
  for each row execute function private.audit_org_model_settings();

alter table public.org_model_settings enable row level security;
alter table public.org_model_settings force row level security;

-- La ve y la gestiona el org_admin (con aal2 para cambiarla, como todo lo que
-- administra). El resto del equipo no la necesita.
create policy org_model_settings_select on public.org_model_settings
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

create policy org_model_settings_select_platform_staff on public.org_model_settings
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

create policy org_model_settings_insert on public.org_model_settings
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy org_model_settings_update on public.org_model_settings
  for update to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

revoke all on public.org_model_settings from anon, authenticated;
grant select on public.org_model_settings to authenticated;
grant insert (organization_id, residency, allowed_providers, model_by_task, budget_per_run_eur, budget_per_day_eur)
  on public.org_model_settings to authenticated;
grant update (residency, allowed_providers, model_by_task, budget_per_run_eur, budget_per_day_eur)
  on public.org_model_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. integration_secrets
-- ---------------------------------------------------------------------------
-- Cifrado de sobre (ADR 0034): una clave de datos por secreto cifra el valor
-- con AES-256-GCM y la organización como dato asociado; la clave maestra (AWS
-- KMS en eu-central-1; en local, una clave de desarrollo) cifra la clave de
-- datos, también ligada a la organización. Aquí solo hay texto cifrado.
create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('model_provider', 'integration')),
  name text not null check (name ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  -- Qué clave maestra cifró la clave de datos (alias o ARN de KMS, o «local:<versión>»).
  key_ref text not null check (length(key_ref) between 3 and 300),
  encrypted_data_key text not null check (encrypted_data_key ~ '^[A-Za-z0-9+/]+={0,2}$'),
  ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'),
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique (organization_id, kind, name)
);

alter table public.integration_secrets enable row level security;
alter table public.integration_secrets force row level security;
-- Ni la app ni el equipo interno los ven: una política explícita que no deja
-- pasar a nadie (y sin privilegios para anon ni authenticated). Solo el worker,
-- con forOrganization(org) (MANUAL §4.4), y los descifra al usarlos.
create policy integration_secrets_none on public.integration_secrets
  for select to authenticated
  using ((select private.session_is_active()) and false);
revoke all on public.integration_secrets from anon, authenticated;
