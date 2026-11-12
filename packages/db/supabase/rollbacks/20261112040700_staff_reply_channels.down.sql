-- Vuelta atrás de 20261112040700_staff_reply_channels.sql: la guarda de los
-- mensajes del equipo vuelve a su versión de 20261109230000 (sin la lista de
-- canales: por los demás, el mensaje queda pending).

create or replace function private.guard_staff_message()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_channel text;
begin
  if current_user = 'authenticated' then
    if length(btrim(new.content)) = 0 then
      raise exception 'el mensaje está vacío' using errcode = '23514';
    end if;
    select c.channel into v_channel
    from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id;
    new.direction := 'out';
    new.author := 'user';
    new.author_user_id := (select auth.uid());
    new.attachments := '[]'::jsonb;
    new.external_message_id := null;
    new.idempotency_key := null;
    -- El chat web y el de pruebas leen la fila; el resto lo envía el worker por su canal.
    new.status := case when v_channel in ('webchat', 'test') then 'sent' else 'pending' end;
  end if;
  return new;
end;
$$;
