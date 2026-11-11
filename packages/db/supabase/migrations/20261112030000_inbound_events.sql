-- La entrada de los canales y los estados de entrega (ADR 0052 §2 y §4;
-- auditoría de preproducción O-01 y D-03).
--
-- 1. inbound_events: cada evento que llega de un proveedor (un mensaje de
--    WhatsApp, del chat web…), una sola vez. La clave única es (cuenta del
--    canal, id del evento del proveedor): un reintento del webhook no crea
--    nada nuevo. La organización es la de la cuenta del canal (clave externa
--    compuesta a channel_accounts), nunca la de un campo del payload. Lo
--    escribe el proceso de entrada con la clave secreta; lo leen el org_admin
--    de la organización y el equipo interno con soporte vigente. El payload es
--    el mensaje ya normalizado (packages/channels), nunca la petición cruda
--    ni sus cabeceras.
-- 2. Estados de entrega de lo que sale: messages.status ya tiene pending,
--    sent, delivered, read y failed. Ahora:
--    - solo avanza (guard_delivery_status, para cualquier rol): un aviso del
--      proveedor que llega tarde o repetido no hace retroceder el estado, y un
--      failed es definitivo, salvo después de delivered o read, que no cuenta
--      (las mismas reglas que nextDeliveryStatus de packages/channels);
--    - status_changed_at: cuándo cambió por última vez (lo pone la base de
--      datos), y delivery_error: el código del proveedor si falló (sin texto
--      libre: puede llevar datos);
--    - un índice por (organization_id, external_message_id) para aplicar los
--      avisos de estado, que llegan con el id del proveedor.
--
-- Sin funciones security definer: next_delivery_status es pura y los dos
-- triggers se ejecutan como quien escribe.
--
-- Vuelta atrás:
--   drop trigger guard_delivery_status on public.messages; drop function private.guard_delivery_status();
--   drop function private.next_delivery_status(text, text);
--   drop index public.messages_external_message_id_idx;
--   alter table public.messages drop column status_changed_at, drop column delivery_error;
--   drop table public.inbound_events; drop function private.guard_inbound_event();

-- ---------------------------------------------------------------------------
-- 1. inbound_events
-- ---------------------------------------------------------------------------
create table public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel_account_id uuid not null,
  -- El id del evento en el proveedor (con la cuenta, la clave única).
  provider_event_id text not null check (length(provider_event_id) between 1 and 200),
  received_at timestamptz not null default now(),
  -- El mensaje normalizado (NormalizedInbound), no la petición cruda.
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  -- received: guardado, sin procesar; processed: ya tiene su mensaje; ignored:
  -- no era para nadie (cuenta desactivada, tipo que no se atiende); failed: se
  -- intentó y falló (se puede volver a intentar).
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  -- Lo que creó al procesarse. message_id sin clave externa: messages está
  -- particionada y su clave primaria es (id, created_at).
  conversation_id uuid,
  message_id uuid,
  processed_at timestamptz,
  -- El código del error si falló (sin texto libre).
  error_code text check (length(error_code) <= 100),
  constraint inbound_events_account_event_key unique (channel_account_id, provider_event_id),
  constraint inbound_events_account_same_org foreign key (channel_account_id, organization_id)
    references public.channel_accounts (id, organization_id) on delete cascade,
  constraint inbound_events_conversation_same_org foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete set null (conversation_id),
  constraint inbound_events_processed check ((status = 'processed') = (processed_at is not null))
);
create index inbound_events_organization_idx on public.inbound_events (organization_id, received_at desc);
create index inbound_events_channel_account_idx on public.inbound_events (channel_account_id, organization_id);
create index inbound_events_pending_idx on public.inbound_events (received_at) where status in ('received', 'failed');
create index inbound_events_conversation_idx on public.inbound_events (conversation_id, organization_id) where conversation_id is not null;

-- Lo que llegó no cambia (para cualquier rol); solo avanza su estado. Un
-- evento procesado o ignorado ya no vuelve atrás; uno fallido se puede volver
-- a intentar. processed_at lo pone la base de datos.
create function private.guard_inbound_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.organization_id, new.channel_account_id, new.provider_event_id, new.received_at, new.payload)
     is distinct from (old.organization_id, old.channel_account_id, old.provider_event_id, old.received_at, old.payload) then
    raise exception 'lo que llegó de un canal no se cambia' using errcode = '42501';
  end if;
  if old.status in ('processed', 'ignored') and new.status is distinct from old.status then
    raise exception 'un evento % ya no cambia de estado', old.status using errcode = '42501';
  end if;
  if new.status = 'received' and old.status <> 'received' then
    raise exception 'un evento no vuelve a received' using errcode = '42501';
  end if;
  new.processed_at := case when new.status = 'processed' then coalesce(old.processed_at, now()) end;
  return new;
end;
$$;
revoke all on function private.guard_inbound_event() from public;
create trigger guard_inbound_event before update on public.inbound_events
  for each row execute function private.guard_inbound_event();

alter table public.inbound_events enable row level security;
alter table public.inbound_events force row level security;

-- Supabase concede todo a anon, authenticated y service_role en cada tabla
-- nueva. Nadie de la app escribe aquí: si pudiera, un miembro inventaría
-- mensajes de clientes. La service role (el proceso de entrada y el worker)
-- inserta y marca el estado; leen el org_admin y el equipo interno con
-- soporte vigente. No se borra (salvo en cascada con la organización o la
-- cuenta del canal).
revoke all on public.inbound_events from anon, authenticated, service_role;
grant select on public.inbound_events to authenticated, service_role;
grant insert (organization_id, channel_account_id, provider_event_id, payload) on public.inbound_events to service_role;
grant update (status, conversation_id, message_id, error_code) on public.inbound_events to service_role;

create policy inbound_events_select_org_admin on public.inbound_events
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));
create policy inbound_events_select_platform_staff on public.inbound_events
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- ---------------------------------------------------------------------------
-- 2. Estados de entrega
-- ---------------------------------------------------------------------------
alter table public.messages
  add column status_changed_at timestamptz,
  add column delivery_error text check (length(delivery_error) <= 100);

create index messages_external_message_id_idx on public.messages (organization_id, external_message_id)
  where external_message_id is not null;

-- El estado que queda al recibir un aviso (como nextDeliveryStatus en
-- packages/channels/src/delivery.ts).
create function private.next_delivery_status(p_current text, p_incoming text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_current = 'failed' then 'failed'
    when p_incoming = 'failed' then case when p_current in ('delivered', 'read') then p_current else 'failed' end
    when p_current not in ('pending', 'sent', 'delivered', 'read') then p_incoming
    when array_position(array['pending', 'sent', 'delivered', 'read'], p_incoming)
       > array_position(array['pending', 'sent', 'delivered', 'read'], p_current) then p_incoming
    else p_current
  end
$$;
revoke all on function private.next_delivery_status(text, text) from public;
-- La llama guard_delivery_status, que se ejecuta como quien escribe: el worker
-- (service_role) actualiza los estados. Nadie de la app actualiza messages.status.
grant execute on function private.next_delivery_status(text, text) to service_role;

-- Lo que sale solo avanza de estado, lo cambie quien lo cambie.
create function private.guard_delivery_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.direction = 'out' and new.status is distinct from old.status then
    if new.status not in ('pending', 'sent', 'delivered', 'read', 'failed') then
      raise exception 'un mensaje que sale no pasa a %', new.status using errcode = '23514';
    end if;
    new.status := private.next_delivery_status(old.status, new.status);
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    -- Un aviso que no cambia nada no toca la hora ni el error.
    new.status_changed_at := old.status_changed_at;
    new.delivery_error := old.delivery_error;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_delivery_status() from public;
create trigger guard_delivery_status before update on public.messages
  for each row execute function private.guard_delivery_status();
