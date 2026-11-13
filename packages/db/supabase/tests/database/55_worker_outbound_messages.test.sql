-- O-01 (20261113120000): el estado «unknown» (un envío que salió sin saber si
-- llegó), message.outbound para lo que sale pending por WhatsApp, y el wamid
-- que el worker guarda una sola vez.
begin;
\ir _fixtures/tenants.psql
select plan(27);

-- 1. La matriz de «unknown», la misma literal que delivery.test.ts (UNKNOWN_MATRIX).
select results_eq(
  $$select private.next_delivery_status(c, i) from (values
    ('received', 'unknown'), ('pending', 'unknown'), ('sent', 'unknown'), ('delivered', 'unknown'), ('read', 'unknown'),
    ('failed', 'unknown'), ('unknown', 'unknown'), ('unknown', 'pending'), ('unknown', 'sent'), ('unknown', 'delivered'),
    ('unknown', 'read'), ('unknown', 'failed')) as m(c, i)$$,
  $$values ('unknown'), ('unknown'), ('sent'), ('delivered'), ('read'),
    ('failed'), ('unknown'), ('unknown'), ('sent'), ('delivered'),
    ('read'), ('failed')$$,
  'la matriz de «unknown» es la de nextDeliveryStatus');
select is(private.next_delivery_status('pending', 'sent'), 'sent', 'lo de antes sigue igual (pending → sent)');
select is(private.next_delivery_status('read', 'failed'), 'read', 'lo de antes sigue igual (un fallo después de leído no cuenta)');

-- Datos: una conversación de WhatsApp y una del chat web en A, y una de WhatsApp en B.
select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_a \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Berta') returning id as c_b \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', '550000000000001', 'customer', 'active') returning id as ca_wa \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'w55-a1', 'customer', 'active') returning id as ca_web \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'whatsapp', '550000000000002', 'customer', 'active') returning id as ca_b \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_a', :'ca_wa', :'agent_a', 'agent') returning id as conv_wa \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_a', :'ca_web', :'agent_a', 'agent') returning id as conv_web \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_b, :loc_b1, :'c_b', :'ca_b', :'agent_b', 'agent') returning id as conv_b \gset

-- 2. message.outbound
create function pg_temp.outbound_events(p_message uuid) returns bigint language sql as $$
  select count(*) from public.domain_events where type = 'message.outbound' and payload->>'message_id' = p_message::text;
$$;
insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
values (:org_a, :'conv_wa', 'out', 'agent', 'Hola', 'pending', 'k55-wa') returning id as m_wa \gset
select results_eq(
  format($$select organization_id, location_id, payload from public.domain_events where type = 'message.outbound' and payload->>'message_id' = %L$$, :'m_wa'),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('conversation_id', %L, 'message_id', %L))$$, :org_a, :loc_a1, :'conv_wa', :'m_wa'),
  'lo que sale pending por WhatsApp emite message.outbound, con la organización y el local de la fila');
insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
values (:org_a, :'conv_web', 'out', 'agent', 'Hola', 'pending', 'k55-web') returning id as m_web \gset
select is(pg_temp.outbound_events(:'m_web'), 0::bigint, 'por el chat web, no (lo lee el widget de la conversación)');
insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
values (:org_a, :'conv_wa', 'out', 'agent', 'Hola', 'sent', 'k55-sent') returning id as m_sent \gset
select is(pg_temp.outbound_events(:'m_sent'), 0::bigint, 'un mensaje que ya nace enviado, no');
insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
values (:org_a, :'conv_wa', 'in', 'contact', 'Buenas', 'received', 'wamid.55-in') returning id as m_in \gset
select is(pg_temp.outbound_events(:'m_in'), 0::bigint, 'lo que entra, no (eso es message.received)');
update public.messages set status = 'pending' where id = :'m_sent';
select is(pg_temp.outbound_events(:'m_sent'), 0::bigint, 'solo al insertar: un update no emite');

select ok((select prosecdef from pg_proc where oid = 'private.emit_message_outbound()'::regprocedure),
  'emit_message_outbound es security definer (escribe el evento, como emit_message_received)');
select ok(not has_function_privilege('authenticated', 'private.emit_message_outbound()', 'execute')
          and not has_function_privilege('service_role', 'private.emit_message_outbound()', 'execute')
          and not has_function_privilege('moodly_worker', 'private.emit_message_outbound()', 'execute')
          and not has_function_privilege('anon', 'private.emit_message_outbound()', 'execute'),
  'nadie la puede llamar: solo el trigger');
select throws_ok('select private.emit_message_outbound()', '0A000', null,
  'ni siquiera quien la creó la llama como función (es de trigger)');

-- Una persona del equipo sigue sin poder escribir por WhatsApp (M-01): no emite nada.
select pg_temp.login_mfa(:a_admin) as _s \gset
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Hola')$$, :org_a, :'conv_wa'),
  '42501', null, 'el equipo no escribe por WhatsApp desde la bandeja (sigue M-01)');
reset role;
select is((select count(*) from public.domain_events where type = 'message.outbound' and organization_id = :org_a), 1::bigint,
  'en A solo hay el evento del mensaje del agente');

-- 3. moodly_worker: el envío.
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
           values (%L, %L, 'out', 'agent', 'Te esperamos', 'pending', 'k55-worker')$$, :org_a, :'conv_wa'),
  'el worker guarda la respuesta del agente pending');
select lives_ok(format($$update public.messages set status = 'unknown' where id = %L$$, :'m_wa'),
  'reclama el envío: pending → unknown');
select is((select status from public.messages where id = :'m_wa'), 'unknown', 'y queda «no se sabe»');
select lives_ok(format($$update public.messages set status = 'sent', external_message_id = 'wamid.55-out' where id = %L$$, :'m_wa'),
  'Meta lo aceptó: sent con su wamid');
select results_eq(format($$select status, external_message_id from public.messages where id = %L$$, :'m_wa'),
  $$values ('sent'::text, 'wamid.55-out'::text)$$, 'y queda enviado con el wamid');
select throws_ok(format($$update public.messages set external_message_id = 'wamid.otro' where id = %L$$, :'m_wa'), '42501', null,
  'el wamid no se cambia');
select throws_ok(format($$update public.messages set external_message_id = null where id = %L$$, :'m_wa'), '42501', null,
  'ni se borra');
select lives_ok(format($$update public.messages set status = 'unknown' where id = %L$$, :'m_wa'),
  'un «unknown» tardío no falla…');
select is((select status from public.messages where id = :'m_wa'), 'sent', '…ni hace retroceder lo enviado');
select throws_ok(format($$update public.messages set external_message_id = 'wamid.x' where id = %L$$, :'m_in'), '42501', null,
  'no pone el id del proveedor a lo que entra');
select throws_ok(format($$update public.messages set content = 'otro' where id = %L$$, :'m_wa'), '42501', null,
  'ni cambia el contenido (columna sin privilegio)');
-- RLS: el de B no lo ve.
select set_config('moodly.organization_id', :org_b, true) as _org_b \gset
select is((select count(*) from public.messages where id = :'m_wa'), 0::bigint, 'con B fijada, no ve los mensajes de A');
reset role;

-- «unknown» desde el chat web: el check lo admite.
select lives_ok(format($$update public.messages set status = 'unknown' where id = %L$$, :'m_web'),
  'el check de messages.status admite «unknown»');
select throws_ok(format($$update public.messages set status = 'perdido' where id = %L$$, :'m_web'), '23514', null,
  'pero no un estado que no existe');

select * from finish();
rollback;
