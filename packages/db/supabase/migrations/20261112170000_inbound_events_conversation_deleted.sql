-- Borrar una conversación con eventos de entrada procesados (ADR 0052 §2).
--
-- inbound_events.conversation_id tiene on delete set null; los mensajes de la
-- conversación se borran en cascada con ella. guard_inbound_event comprobaba
-- entonces que message_id siguiera siendo un mensaje de la organización, el
-- mensaje ya no existía y el borrado entero fallaba (23503): una conversación
-- con mensajes que entraron por un canal no se podía borrar (ni con la clave
-- secreta, ni en el borrado de un contacto o en una supresión).
--
-- Ahora, si la conversación se quita porque ya no existe (la cascada), el
-- evento suelta también su message_id: era un mensaje de esa conversación. Si
-- se quita a mano y la conversación sigue existiendo, no cambia nada respecto a
-- antes. Lo que llegó (payload, ids, estado) sigue sin cambiar.
--
-- Sin security definer (se ejecuta como quien escribe, como antes).
--
-- Vuelta atrás: rollbacks/20261112170000_inbound_events_conversation_deleted.down.sql
-- (la función de 20261112030000_inbound_events.sql).

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
    -- La conversación se borró (on delete set null): su mensaje se fue con ella.
    if old.conversation_id is not null and new.conversation_id is null
       and new.message_id is not distinct from old.message_id
       and not exists (select 1 from public.conversations c where c.id = old.conversation_id) then
      new.message_id := null;
    end if;
  end if;
  -- Sin clave externa a messages (está particionada): el mensaje tiene que ser
  -- de la misma organización y, si se sabe la conversación, de esa. Se mira
  -- siempre que haya mensaje, al insertar y al cambiar cualquiera de los dos.
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
