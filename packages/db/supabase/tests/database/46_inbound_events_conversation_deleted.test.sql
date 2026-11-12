-- Borrar una conversación que tiene eventos de entrada procesados
-- (20261112070000): la clave externa deja el evento sin conversación (set
-- null) y, con la conversación, se borran sus mensajes; el evento se queda
-- también sin message_id, en vez de que el guarda rechace el borrado.
begin;
\ir _fixtures/tenants.psql
select plan(6);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-del-a1', 'customer', 'active') returning id as ca_a \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a') returning id as conv \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a') returning id as conv2 \gset
insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
values (:org_a, :'conv', 'in', 'contact', 'Hola', 'received', 'm-del-1') returning id as msg \gset
insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
values (:org_a, :'conv2', 'in', 'contact', 'Otra', 'received', 'm-del-2') returning id as msg2 \gset
insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
values (:org_a, :'ca_a', 'evt-del-1', '{"text": "Hola"}') returning id as evt \gset
insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
values (:org_a, :'ca_a', 'evt-del-2', '{"text": "Otra"}') returning id as evt2 \gset
update public.inbound_events set status = 'processed', conversation_id = :'conv', message_id = :'msg' where id = :'evt';
update public.inbound_events set status = 'processed', conversation_id = :'conv2', message_id = :'msg2' where id = :'evt2';

select lives_ok(
  format($$delete from public.conversations where id = %L$$, :'conv'),
  'una conversación con un evento de entrada procesado se puede borrar');
select results_eq(
  format($$select conversation_id, message_id, status from public.inbound_events where id = %L$$, :'evt'),
  $$values (null::uuid, null::uuid, 'processed'::text)$$,
  'el evento se queda sin conversación ni mensaje, y sigue procesado (lo que llegó no cambia)');
select results_eq(
  format($$select conversation_id, message_id from public.inbound_events where id = %L$$, :'evt2'),
  format($$values (%L::uuid, %L::uuid)$$, :'conv2', :'msg2'),
  'el evento de otra conversación no se toca');

-- En negativo: quitar la conversación a mano (sin borrarla) no suelta el mensaje
-- de otra conversación ni deja apuntar a un mensaje que no existe.
select throws_ok(
  format($$update public.inbound_events set conversation_id = null, message_id = gen_random_uuid() where id = %L$$, :'evt2'),
  '23503', null, 'un mensaje que no existe sigue sin valer');
select lives_ok(
  format($$update public.inbound_events set conversation_id = null where id = %L$$, :'evt2'),
  'quitar la conversación de un evento cuya conversación sigue existiendo no toca su mensaje');
select results_eq(
  format($$select message_id from public.inbound_events where id = %L$$, :'evt2'),
  format($$values (%L::uuid)$$, :'msg2'),
  'y el mensaje sigue apuntado');

select * from finish();
rollback;
