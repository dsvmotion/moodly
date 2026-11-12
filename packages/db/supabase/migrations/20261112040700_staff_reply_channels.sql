-- M-01 (revisión de V10 sobre #177): el equipo solo escribe al cliente desde la
-- bandeja por un canal que de verdad le hace llegar el mensaje. Hoy, el chat web
-- (el widget lee el mensaje de la conversación) y el chat de pruebas. Por los
-- demás (whatsapp, instagram, email, voice) nadie lo envía todavía (la capa de
-- canales, O-01): el mensaje se quedaba «pendiente» para siempre. La web ya lo
-- impide (canReplyOn en apps/web/src/lib/inbox.ts, #177); ahora también la base
-- de datos, para quien escribe con su sesión (authenticated).
--
-- Solo cambia private.guard_staff_message (20261109230000): rechaza el mensaje
-- si el canal de la conversación no está en la lista, y como todos los que
-- quedan los lee la fila, el mensaje nace sent. Cuando un canal tenga su envío
-- (O-01), se añade a la lista aquí y en REPLY_CHANNELS de la web, y vuelve el
-- estado pending para ese canal hasta que el worker lo envíe.
--
-- No cambia lo que escribe la plataforma (el worker, las funciones de la base
-- de datos): la guarda solo actúa con current_user = 'authenticated'.
--
-- Vuelta atrás: rollbacks/20261112040700_staff_reply_channels.down.sql (la
-- función de 20261109230000).

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
    -- Solo por un canal que hace llegar el mensaje al cliente (M-01).
    if v_channel is null or v_channel not in ('webchat', 'test') then
      raise exception 'por este canal todavía no se puede escribir al cliente desde la bandeja' using errcode = '42501';
    end if;
    new.direction := 'out';
    new.author := 'user';
    new.author_user_id := (select auth.uid());
    new.attachments := '[]'::jsonb;
    new.external_message_id := null;
    new.idempotency_key := null;
    -- El chat web y el de pruebas leen la fila.
    new.status := 'sent';
  end if;
  return new;
end;
$$;
