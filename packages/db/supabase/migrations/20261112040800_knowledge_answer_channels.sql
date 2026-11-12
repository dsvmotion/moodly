-- M-01 (seguimiento de 20261112040700_staff_reply_channels): contestar una
-- solicitud de conocimiento solo manda la respuesta al cliente por un canal que
-- de verdad envía (el chat web y el de pruebas).
--
-- Antes, answer_knowledge_request (security definer, 20261110100000) insertaba
-- en el resto de canales (WhatsApp, Instagram, email, voz) un mensaje
-- 'pending' que nadie envía todavía: se quedaba pendiente para siempre y la
-- bandeja lo enseñaba como si fuera a salir. guard_staff_message ya lo impide a
-- quien escribe desde la app, pero dentro de una función security definer no
-- actúan las guardas (current_user es su dueño, no authenticated), así que el
-- hueco seguía abierto por aquí. No se llega a él en producción hasta que haya
-- algo que cree knowledge_requests (#159, ask_team); se cierra antes.
--
-- Ahora, al contestar:
--   - la fuente de conocimiento human_answer se guarda igual (el agente lo sabe
--     la próxima vez, sea cual sea el canal);
--   - el mensaje solo se inserta si la conversación es del chat web o de
--     pruebas, y entonces sale 'sent' (nunca 'pending');
--   - la auditoría dice en message_sent si se mandó de verdad, y en channel por
--     qué canal; con otro canal, la persona tiene que contestar al cliente por
--     ese canal cuando lo haya.
--
-- Sigue escribiendo, como antes, solo filas de la organización de la pregunta y
-- derivadas de ella (la fuente, como mucho un mensaje en su conversación y la
-- auditoría); ahora escribe menos. Tests en negativo en 39_knowledge_requests.
--
-- Vuelta atrás: rollbacks/20261112040800_knowledge_answer_channels.down.sql
-- (la versión de 20261110100000).

create or replace function private.answer_knowledge_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
  v_sent boolean := false;
begin
  insert into public.knowledge_sources (organization_id, location_id, type, title, body, status, created_by)
  values (new.organization_id, new.location_id, 'human_answer', left(new.question, 200), new.answer, 'pending', new.answered_by)
  returning id into new.resulting_source_id;

  if new.conversation_id is not null then
    select c.channel into v_channel
    from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id;
    -- Solo por un canal que envía: en el resto, un mensaje 'pending' no saldría nunca.
    if v_channel in ('webchat', 'test') then
      insert into public.messages (organization_id, conversation_id, direction, author, author_user_id, content, status)
      values (new.organization_id, new.conversation_id, 'out', 'user', new.answered_by, new.answer, 'sent');
      v_sent := true;
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target, metadata)
  values (new.organization_id, 'user', new.answered_by, 'knowledge_request.answered',
          jsonb_build_object('knowledge_request_id', new.id, 'knowledge_source_id', new.resulting_source_id),
          jsonb_build_object('location_id', new.location_id, 'assigned_role', new.assigned_role,
                             'message_sent', v_sent, 'channel', v_channel));
  return new;
end;
$$;
revoke all on function private.answer_knowledge_request() from public, anon, authenticated, service_role;
