-- O-01 (20261113110000): moodly_worker aplica los avisos de estado de un canal a
-- los mensajes que salen, solo de su organización, solo el estado y el error, y
-- con las reglas de siempre (el estado solo avanza, tampoco a pending); nunca
-- toca lo que entra.
begin;
\ir _fixtures/tenants.psql
select plan(15);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_a \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Berta') returning id as c_b \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', '530000000000001', 'customer', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'whatsapp', '530000000000002', 'customer', 'active') returning id as ca_b \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_a', :'ca_a', :'agent_a', 'agent') returning id as conv_a \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_b, :loc_b1, :'c_b', :'ca_b', :'agent_b', 'agent') returning id as conv_b \gset

-- Lo que salió (con su wamid) y lo que entró, en A; y lo que salió en B.
insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
values (:org_a, :'conv_a', 'out', 'agent', 'Hola', 'sent', 'wamid.53-out'),
       (:org_a, :'conv_a', 'out', 'agent', 'Otro', 'sent', 'wamid.53-out2'),
       (:org_a, :'conv_a', 'in', 'contact', 'Buenas', 'received', 'wamid.53-in'),
       (:org_b, :'conv_b', 'out', 'agent', 'De B', 'sent', 'wamid.53-b');

select ok(not (select prosecdef from pg_proc where oid = 'private.guard_worker_message_status()'::regprocedure),
  'la guarda es invoker');
select ok(has_function_privilege('moodly_worker', 'private.next_delivery_status(text, text)', 'execute'),
  'puede ejecutar la regla del estado (la llama guard_delivery_status como quien escribe)');

grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok($$update public.messages set status = 'delivered' where external_message_id = 'wamid.53-out'$$,
  'aplica «entregado» a lo que salió');
select is((select status from public.messages where external_message_id = 'wamid.53-out'), 'delivered', 'y queda entregado');
select lives_ok($$update public.messages set status = 'sent' where external_message_id = 'wamid.53-out'$$,
  'un «enviado» que llega tarde no falla…');
select is((select status from public.messages where external_message_id = 'wamid.53-out'), 'delivered',
  '…ni hace retroceder el estado (guard_delivery_status actúa para él)');
select lives_ok($$update public.messages set status = 'failed', delivery_error = 'whatsapp:131047' where external_message_id = 'wamid.53-out2'$$,
  'apunta un fallo con su código');
select results_eq($$select status, delivery_error from public.messages where external_message_id = 'wamid.53-out2'$$,
  $$values ('failed'::text, 'whatsapp:131047'::text)$$, 'y queda fallido con el código');
update public.messages set status = 'pending' where external_message_id = 'wamid.53-out';
select is((select status from public.messages where external_message_id = 'wamid.53-out'), 'delivered',
  'tampoco lo devuelve a pending (guard_delivery_status)');
select throws_ok($$update public.messages set status = 'read' where external_message_id = 'wamid.53-in'$$, '42501', null,
  'no aplica estados a lo que entra');
select throws_ok($$update public.messages set content = 'otro' where external_message_id = 'wamid.53-out'$$, '42501', null,
  'no cambia el contenido (columna sin privilegio)');
select throws_ok($$update public.messages set external_message_id = 'wamid.otro' where external_message_id = 'wamid.53-out'$$, '42501', null,
  'ni el id del proveedor');
-- RLS: el de B no lo ve, así que el update no toca nada.
update public.messages set status = 'read' where external_message_id = 'wamid.53-b';
reset role;
select is((select status from public.messages where external_message_id = 'wamid.53-b'), 'sent',
  'no cambia los mensajes de otra organización (RLS)');
select is((select status from public.messages where external_message_id = 'wamid.53-in'), 'received', 'lo que entró sigue igual');

-- service_role queda igual: puede seguir cambiando el estado.
set local role service_role;
select lives_ok($$update public.messages set status = 'read' where external_message_id = 'wamid.53-b'$$, 'service_role, como antes');
reset role;

select * from finish();
rollback;
