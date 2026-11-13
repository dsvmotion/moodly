-- O-01, segunda parte: el worker envía por WhatsApp lo que sale (la respuesta
-- del agente) y, si no sabe si llegó, no lo repite (ADR 0052 §3 y §4).
--
-- 1. Un estado nuevo, «unknown»: el envío salió y no se sabe si el proveedor lo
--    recibió (un corte de red, un timeout, un 5xx). Meta no acepta claves de
--    idempotencia, así que repetirlo podría duplicarlo al cliente: no se
--    reintenta. No es definitivo: el primer aviso del proveedor que llegue
--    (sent, delivered, read o failed) gana, y nunca vuelve a pending. Solo un
--    mensaje pending pasa a unknown (next_delivery_status, como
--    nextDeliveryStatus de packages/channels; la matriz en 55).
-- 2. message.outbound: un evento por cada mensaje que sale pending por un canal
--    que envía el worker (hoy, whatsapp), en la misma transacción que el
--    mensaje. Lo consume channels.send. El tenant y el local, de la fila
--    (control 3.7), como message.received.
--    emit_message_outbound es SECURITY DEFINER y escribe en domain_events (una
--    tabla de tenants), igual que emit_message_received (20261031150000): es un
--    trigger, nadie la puede llamar (EXECUTE revocado a todos), solo escribe el
--    evento del mensaje que se acaba de insertar, con su organización, y solo si
--    la conversación es de esa misma organización. Tests en negativo en 55.
-- 3. moodly_worker: UPDATE además de external_message_id (el wamid que devuelve
--    Meta). guard_worker_message_status (20261113110000) pasa a exigir que el id
--    del proveedor solo se ponga una vez: de null a un valor, nunca cambiarlo
--    ni borrarlo.
--
-- service_role queda igual.
-- Tests en 55_worker_outbound_messages (y el privilegio exacto en 48).
-- Vuelta atrás: rollbacks/20261113120000_worker_outbound_messages.down.sql.

-- ---------------------------------------------------------------------------
-- 1. «unknown»
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint messages_status_check;
alter table public.messages add constraint messages_status_check
  check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed', 'unknown'));

create or replace function private.next_delivery_status(p_current text, p_incoming text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_current = 'failed' then 'failed'
    -- Solo un envío que aún no había salido pasa a «no se sabe».
    when p_incoming = 'unknown' then case when p_current in ('pending', 'received') then 'unknown' else p_current end
    -- Desde «no se sabe», cualquier aviso del proveedor gana (no vuelve a pending).
    when p_current = 'unknown' then case when p_incoming = 'pending' then 'unknown' else p_incoming end
    when p_incoming = 'failed' then case when p_current in ('delivered', 'read') then p_current else 'failed' end
    when p_current not in ('pending', 'sent', 'delivered', 'read') then p_incoming
    when array_position(array['pending', 'sent', 'delivered', 'read'], p_incoming)
       > array_position(array['pending', 'sent', 'delivered', 'read'], p_current) then p_incoming
    else p_current
  end
$$;

create or replace function private.guard_delivery_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.direction = 'out' and new.status is distinct from old.status then
    if new.status not in ('pending', 'sent', 'delivered', 'read', 'failed', 'unknown') then
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

-- ---------------------------------------------------------------------------
-- 2. message.outbound
-- ---------------------------------------------------------------------------
create function private.emit_message_outbound()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction <> 'out' or new.status <> 'pending' then
    return null;
  end if;
  -- Solo por los canales que envía el worker, y con la organización y el local
  -- de la fila (control 3.7).
  insert into public.domain_events (organization_id, location_id, type, payload)
  select new.organization_id, c.location_id, 'message.outbound',
         jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
  from public.conversations c
  where c.id = new.conversation_id and c.organization_id = new.organization_id
    and c.channel in ('whatsapp');
  return null;
end;
$$;
revoke all on function private.emit_message_outbound() from public, anon, authenticated, service_role;
create trigger emit_message_outbound
  after insert on public.messages
  for each row execute function private.emit_message_outbound();

-- ---------------------------------------------------------------------------
-- 3. moodly_worker: el wamid, una sola vez
-- ---------------------------------------------------------------------------
create or replace function private.guard_worker_message_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' then
    if old.direction is distinct from 'out' then
      raise exception 'el worker solo aplica estados de entrega a lo que sale' using errcode = '42501';
    end if;
    if new.external_message_id is distinct from old.external_message_id and old.external_message_id is not null then
      raise exception 'el id del proveedor de un mensaje no se cambia' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

grant update (external_message_id) on public.messages to moodly_worker;
