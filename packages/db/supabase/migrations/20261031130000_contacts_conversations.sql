-- Canales, contactos y conversaciones (paso 4a; MANUAL §4.2 y §8, roadmap A5).
-- Solo modelo de datos: no conecta ningún canal real (WhatsApp llega con sus
-- credenciales; los eventos entrantes, inbound_events, con su webhook).
--
-- - channel_accounts: cada número, cuenta o widget de una organización. El
--   tenant de lo que entra sale de aquí (canal + id externo), nunca del
--   contenido del mensaje (revisión de seguridad §7.1).
-- - contacts y contact_identities: el cliente final y cómo se le reconoce
--   (teléfono, email, Instagram, sesión del chat web), únicos por organización.
-- - conversations: un contacto con un agente por un canal, en un local o en
--   toda la organización.
-- - messages: particionada por mes desde su primera migración (MANUAL §4.2,
--   ADR 0026 §3). Las particiones viven en el esquema partitions, que la API no
--   expone: solo se accede por public.messages, con su RLS.
--
-- Quién ve qué: lo de un local, quien tiene ese local en su alcance; lo de toda
-- la organización (cuenta compartida sin local resuelto), el org_admin. La app
-- solo lee: escribe el worker (y, con A13, la bandeja con su propia política).
--
-- Vuelta atrás: drop de messages (y del esquema partitions), conversations,
-- contact_identities, contacts y channel_accounts, de sus funciones private.*
-- (can_see_scope, validate_conversation, ensure_monthly_partitions y
-- touch_conversation)
-- y de las restricciones locations_id_organization_id_key y
-- agents_id_organization_id_key. No hay datos de clientes todavía.

-- Claves compuestas para que cada fila solo apunte a cosas de su organización.
alter table public.locations add constraint locations_id_organization_id_key unique (id, organization_id);
alter table public.agents add constraint agents_id_organization_id_key unique (id, organization_id);

-- Lo de un local lo ve quien tiene el local en su alcance; lo de toda la
-- organización, el org_admin. Security definer como el resto de helpers; solo lee.
create function private.can_see_scope(p_org uuid, p_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_location is null then private.has_org_role(p_org, array['org_admin'])
    else private.can_access_location(p_org, p_location)
  end;
$$;
revoke all on function private.can_see_scope(uuid, uuid) from public;
grant execute on function private.can_see_scope(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. channel_accounts
-- ---------------------------------------------------------------------------
create table public.channel_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = compartida por toda la organización (la conversación resuelve el local después).
  location_id uuid,
  channel text not null check (channel in ('whatsapp', 'instagram', 'email', 'webchat', 'voice')),
  -- El id del proveedor (phone_number_id, cuenta, buzón o widget).
  external_id text not null check (length(external_id) between 1 and 200),
  -- Qué tipo de agente atiende por defecto (customer en canales escritos, reception en voz).
  default_agent_type text not null check (default_agent_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un número o una cuenta es de una sola organización: de aquí sale el tenant.
  constraint channel_accounts_channel_external_id_key unique (channel, external_id),
  constraint channel_accounts_id_organization_id_key unique (id, organization_id),
  constraint channel_accounts_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
);
create index channel_accounts_organization_id_idx on public.channel_accounts (organization_id);
create index channel_accounts_location_id_idx on public.channel_accounts (location_id, organization_id);

-- ---------------------------------------------------------------------------
-- 2. contacts y contact_identities
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name text check (length(display_name) <= 200),
  -- Consentimientos por finalidad y canal (opt-in de WhatsApp, B18). Sin
  -- consentimiento registrado no se contacta a nadie (ADR 0047).
  consents jsonb not null default '{}'::jsonb check (jsonb_typeof(consents) = 'object'),
  preferred_location_id uuid,
  locale text check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_id_organization_id_key unique (id, organization_id),
  constraint contacts_preferred_location_same_org foreign key (preferred_location_id, organization_id)
    references public.locations (id, organization_id)
);
create index contacts_organization_id_idx on public.contacts (organization_id);
create index contacts_preferred_location_id_idx on public.contacts (preferred_location_id, organization_id);

-- Cómo se reconoce a un contacto. El teléfono es uno solo para WhatsApp y voz
-- (el mismo contacto y la misma memoria, B11). Normalizado: E.164 y email en
-- minúsculas, para que un mismo cliente no acabe en dos contactos.
create table public.contact_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid not null,
  kind text not null check (kind in ('phone', 'email', 'instagram', 'webchat')),
  external_id text not null check (length(external_id) between 1 and 320),
  created_at timestamptz not null default now(),
  constraint contact_identities_contact_same_org foreign key (contact_id, organization_id)
    references public.contacts (id, organization_id) on delete cascade,
  constraint contact_identities_org_kind_external_id_key unique (organization_id, kind, external_id),
  constraint contact_identities_phone_e164 check (kind <> 'phone' or external_id ~ '^\+[1-9][0-9]{6,14}$'),
  constraint contact_identities_email_lower check (
    kind <> 'email' or (external_id = lower(external_id) and external_id ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  )
);
create index contact_identities_contact_id_idx on public.contact_identities (contact_id, organization_id);

-- ---------------------------------------------------------------------------
-- 3. conversations
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid,
  contact_id uuid not null,
  channel_account_id uuid not null,
  agent_id uuid not null,
  mode text not null default 'agent' check (mode in ('agent', 'human', 'closed')),
  assigned_user_id uuid references public.users (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_id_organization_id_key unique (id, organization_id),
  constraint conversations_contact_same_org foreign key (contact_id, organization_id)
    references public.contacts (id, organization_id) on delete cascade,
  constraint conversations_channel_account_same_org foreign key (channel_account_id, organization_id)
    references public.channel_accounts (id, organization_id),
  constraint conversations_agent_same_org foreign key (agent_id, organization_id)
    references public.agents (id, organization_id),
  constraint conversations_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
);
create index conversations_scope_idx on public.conversations (organization_id, location_id, last_message_at desc);
create index conversations_contact_id_idx on public.conversations (contact_id, organization_id);
create index conversations_channel_account_id_idx on public.conversations (channel_account_id, organization_id);
create index conversations_agent_id_idx on public.conversations (agent_id, organization_id);
create index conversations_location_id_idx on public.conversations (location_id, organization_id);
create index conversations_assigned_user_id_idx on public.conversations (assigned_user_id);

-- Una cuenta de un local solo abre conversaciones de ese local; el local de una
-- conversación de cuenta compartida se resuelve una vez y ya no cambia; lo que
-- la identifica tampoco; y quien la atiende es de la organización. Para todos
-- los roles; security definer para leer la cuenta y la membresía reales.
create function private.validate_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_location uuid;
begin
  select a.location_id into v_account_location
  from public.channel_accounts a
  where a.id = new.channel_account_id and a.organization_id = new.organization_id;
  if v_account_location is not null and new.location_id is distinct from v_account_location then
    raise exception 'una cuenta de un local solo abre conversaciones de ese local' using errcode = '23514';
  end if;
  if new.assigned_user_id is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.assigned_user_id and m.organization_id = new.organization_id
  ) then
    raise exception 'quien atiende la conversación no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.contact_id, new.channel_account_id, new.created_at)
       is distinct from (old.organization_id, old.contact_id, old.channel_account_id, old.created_at) then
      raise exception 'la organización, el contacto y el canal de una conversación no cambian' using errcode = '42501';
    end if;
    if old.location_id is not null and new.location_id is distinct from old.location_id then
      raise exception 'el local de una conversación se resuelve una vez y no cambia' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_conversation() from public;
create trigger validate_conversation before insert or update on public.conversations
  for each row execute function private.validate_conversation();

-- ---------------------------------------------------------------------------
-- 4. messages, particionada por mes
-- ---------------------------------------------------------------------------
create schema partitions;
revoke all on schema partitions from public;
comment on schema partitions is
  'Particiones de las tablas que crecen sin límite (ADR 0026 §3). Fuera de la API: se accede por la tabla padre de public, con su RLS.';

create table public.messages (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null,
  conversation_id uuid not null,
  direction text not null check (direction in ('in', 'out')),
  author text not null check (author in ('contact', 'agent', 'user', 'system')),
  -- Solo si lo escribió una persona del equipo (tomando el control).
  author_user_id uuid references public.users (id) on delete set null,
  content text not null check (length(content) <= 10000),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  -- El id del proveedor (wamid…); la deduplicación de lo entrante va en inbound_events.
  external_message_id text check (length(external_message_id) <= 200),
  status text not null default 'received'
    check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed')),
  primary key (id, created_at),
  constraint messages_conversation_same_org foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade,
  -- Lo que entra lo escribe el contacto; lo que sale, el agente, una persona o el sistema.
  constraint messages_direction_author check ((direction = 'in') = (author = 'contact')),
  constraint messages_author_user check (author_user_id is null or author = 'user')
) partition by range (created_at);
create index messages_conversation_idx on public.messages (conversation_id, organization_id, created_at desc);
create index messages_author_user_id_idx on public.messages (author_user_id);

-- Crea las particiones mensuales que falten desde p_from durante p_months
-- meses (idempotente). La llamará un workflow programado del worker antes de
-- cada mes; mientras, la de por defecto recoge lo que llegue sin partición.
-- Security definer porque crea tablas en partitions; solo service_role.
create function private.ensure_monthly_partitions(p_table text, p_from date, p_months int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created int := 0;
  v_start date;
  v_name text;
begin
  if p_table not in ('messages') then
    raise exception 'tabla sin particionado mensual: %', p_table using errcode = '22023';
  end if;
  if p_months not between 1 and 36 then
    raise exception 'entre 1 y 36 meses' using errcode = '22023';
  end if;
  for i in 0 .. p_months - 1 loop
    v_start := (date_trunc('month', p_from) + make_interval(months => i))::date;
    v_name := format('%s_%s', p_table, to_char(v_start, 'YYYY_MM'));
    if to_regclass(format('partitions.%I', v_name)) is null then
      execute format(
        'create table partitions.%I partition of public.%I for values from (%L) to (%L)',
        v_name, p_table, v_start, (v_start + interval '1 month')::date
      );
      v_created := v_created + 1;
    end if;
  end loop;
  return v_created;
end;
$$;
revoke all on function private.ensure_monthly_partitions(text, date, int) from public;
grant execute on function private.ensure_monthly_partitions(text, date, int) to service_role;

create table partitions.messages_default partition of public.messages default;
select private.ensure_monthly_partitions('messages', '2026-10-01', 15);

-- ---------------------------------------------------------------------------
-- 5. Triggers de mantenimiento
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.channel_accounts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();

-- La bandeja ordena por el último mensaje. Invoker: quien escribe el mensaje
-- (hoy, solo el worker) actualiza su conversación.
create function private.touch_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations c
     set last_message_at = new.created_at
   where c.id = new.conversation_id
     and c.organization_id = new.organization_id
     and (c.last_message_at is null or c.last_message_at < new.created_at);
  return null;
end;
$$;
revoke all on function private.touch_conversation() from public;
create trigger touch_conversation after insert on public.messages
  for each row execute function private.touch_conversation();

-- ---------------------------------------------------------------------------
-- 6. RLS: la app solo lee, cada uno lo de su alcance
-- ---------------------------------------------------------------------------
alter table public.channel_accounts enable row level security;
alter table public.channel_accounts force row level security;
alter table public.contacts enable row level security;
alter table public.contacts force row level security;
alter table public.contact_identities enable row level security;
alter table public.contact_identities force row level security;
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;

-- Las cuentas (configuración del canal) las ve el org_admin.
create policy channel_accounts_select on public.channel_accounts
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

create policy conversations_select on public.conversations
  for select to authenticated
  using ((select private.session_is_active()) and private.can_see_scope(organization_id, location_id));

-- Un contacto lo ve el org_admin y quien ve alguna de sus conversaciones o su local preferido.
create policy contacts_select on public.contacts
  for select to authenticated
  using ((select private.session_is_active()) and (
    private.has_org_role(organization_id, array['org_admin'])
    or (preferred_location_id is not null and private.can_access_location(organization_id, preferred_location_id))
    or exists (select 1 from public.conversations c where c.contact_id = contacts.id and c.organization_id = contacts.organization_id)
  ));

-- Las identidades y los mensajes, quien ve su contacto o su conversación (la
-- subconsulta pasa por la RLS de esas tablas).
create policy contact_identities_select on public.contact_identities
  for select to authenticated
  using ((select private.session_is_active()) and exists (
    select 1 from public.contacts c where c.id = contact_identities.contact_id and c.organization_id = contact_identities.organization_id
  ));

create policy messages_select on public.messages
  for select to authenticated
  using ((select private.session_is_active()) and exists (
    select 1 from public.conversations c where c.id = messages.conversation_id and c.organization_id = messages.organization_id
  ));

-- El equipo interno, con acceso de soporte concedido (ADR 0021).
create policy channel_accounts_select_platform_staff on public.channel_accounts
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy contacts_select_platform_staff on public.contacts
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy contact_identities_select_platform_staff on public.contact_identities
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy conversations_select_platform_staff on public.conversations
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy messages_select_platform_staff on public.messages
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));

revoke all on public.channel_accounts, public.contacts, public.contact_identities, public.conversations, public.messages
  from anon, authenticated;
grant select on public.channel_accounts, public.contacts, public.contact_identities, public.conversations, public.messages
  to authenticated;
