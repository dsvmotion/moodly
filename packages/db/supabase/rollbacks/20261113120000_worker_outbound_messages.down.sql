-- Vuelta atrás de 20261113120000_worker_outbound_messages.sql: el worker deja de
-- enviar lo que sale. Antes, desplegar un worker sin esa migración.
-- Los mensajes en «unknown» pasan a failed con su código (no se sabe si llegaron:
-- quien los mire en la bandeja lo ve como fallido), para que quepan en el check.

revoke update (external_message_id) on public.messages from moodly_worker;

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
  end if;
  return new;
end;
$$;

drop trigger emit_message_outbound on public.messages;
drop function private.emit_message_outbound();

update public.messages set status = 'failed', delivery_error = coalesce(delivery_error, 'outcome_unknown') where status = 'unknown';

create or replace function private.guard_delivery_status()
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
    new.status_changed_at := old.status_changed_at;
    new.delivery_error := old.delivery_error;
  end if;
  return new;
end;
$$;

create or replace function private.next_delivery_status(p_current text, p_incoming text)
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

alter table public.messages drop constraint messages_status_check;
alter table public.messages add constraint messages_status_check
  check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed'));
