-- Un mensaje del contacto de prueba en la conversación de staging-agent.sql
-- (workflow «Staging · agente»). El workflow sustituye __MESSAGE__ por uno de
-- sus mensajes fijos: nunca texto libre. Si una prueba anterior pasó la
-- conversación a una persona, la devuelve al agente. El mensaje dispara
-- message.received (private.emit_message_received) y lo contesta el worker.
-- Postgres ejecuta siempre el UPDATE del WITH, aunque el INSERT no lo lea.
with reopened as (
  update public.conversations
  set mode = 'agent', updated_at = now()
  where id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e41' and mode = 'human'
  returning id
)
insert into public.messages (organization_id, conversation_id, direction, author, content)
select 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01', 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e41', 'in', 'contact', '__MESSAGE__'
returning id as message_id;
