-- Vuelta atrás de 20261112040800_knowledge_answer_channels.sql:
-- answer_knowledge_request vuelve a su versión de 20261110100000 (con un canal
-- que no envía, inserta el mensaje 'pending').

create or replace function private.answer_knowledge_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
begin
  insert into public.knowledge_sources (organization_id, location_id, type, title, body, status, created_by)
  values (new.organization_id, new.location_id, 'human_answer', left(new.question, 200), new.answer, 'pending', new.answered_by)
  returning id into new.resulting_source_id;

  if new.conversation_id is not null then
    select c.channel into v_channel
    from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id;
    insert into public.messages (organization_id, conversation_id, direction, author, author_user_id, content, status)
    values (new.organization_id, new.conversation_id, 'out', 'user', new.answered_by, new.answer,
            case when v_channel in ('webchat', 'test') then 'sent' else 'pending' end);
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target, metadata)
  values (new.organization_id, 'user', new.answered_by, 'knowledge_request.answered',
          jsonb_build_object('knowledge_request_id', new.id, 'knowledge_source_id', new.resulting_source_id),
          jsonb_build_object('location_id', new.location_id, 'assigned_role', new.assigned_role,
                             'message_sent', new.conversation_id is not null));
  return new;
end;
$$;
revoke all on function private.answer_knowledge_request() from public, anon, authenticated, service_role;
