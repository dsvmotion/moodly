-- Vuelta atrás de 20261112070000_inbound_events_conversation_deleted.sql:
-- guard_inbound_event vuelve a ser la de 20261112030000_inbound_events.sql (sin
-- soltar message_id cuando se borra la conversación). Con ella, borrar una
-- conversación con eventos de entrada procesados vuelve a fallar (23503).

create or replace function private.guard_inbound_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
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
  end if;
  -- Sin clave externa a messages (está particionada): el mensaje tiene que ser
  -- de la misma organización y, si se sabe la conversación, de esa. Se mira
  -- siempre que haya mensaje, al insertar y al cambiar cualquiera de los dos.
  -- (La conversación ya es de la misma organización por su clave externa.)
  if new.message_id is not null
     and (tg_op = 'INSERT'
          or new.message_id is distinct from old.message_id
          or new.conversation_id is distinct from old.conversation_id)
     and not exists (
       select 1 from public.messages m
       where m.id = new.message_id and m.organization_id = new.organization_id
         and (new.conversation_id is null or m.conversation_id = new.conversation_id)
     ) then
    raise exception 'el mensaje no es de la organización (o de la conversación) del evento' using errcode = '23503';
  end if;
  new.processed_at := case
    when new.status <> 'processed' then null
    when tg_op = 'UPDATE' then coalesce(old.processed_at, now())
    else now()
  end;
  return new;
end;
$$;
revoke all on function private.guard_inbound_event() from public;
