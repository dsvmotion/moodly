-- El chat de pruebas (20261104090000, paso 4d-3e): send_test_message escribe,
-- como el contacto de prueba de quien llama y en el canal 'test', solo dentro
-- de lo que esa persona ya ve; close_test_conversation cierra solo su propia
-- conversación de prueba. Son security definer y escriben en tablas de tenants:
-- aquí van sus pruebas en negativo.
begin;
\ir _fixtures/tenants.psql
select plan(40);

select a.id as reception_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'reception' \gset
select a.id as customer_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'customer' \gset
select a.id as reception_b from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_b and t.key = 'reception' \gset

-- Solo cuentan las organizaciones del fixture: la base local puede tener el seed.
create temp view fixture_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b);

-- ===========================================================================
-- 1. Quién puede llamarlas
-- ===========================================================================
select ok(
  (select prosecdef from pg_proc where oid = 'public.send_test_message(uuid, uuid, text)'::regprocedure),
  'send_test_message es security definer (la app no escribe mensajes)');
select ok(
  (select prosecdef from pg_proc where oid = 'public.close_test_conversation(uuid)'::regprocedure),
  'close_test_conversation es security definer');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'service_role', 'public']) as r
   where r <> 'public' and has_function_privilege(r, 'public.send_test_message(uuid, uuid, text)', 'execute')),
  null, 'ni anon ni service_role pueden enviar mensajes de prueba');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'service_role']) as r
   where has_function_privilege(r, 'public.close_test_conversation(uuid)', 'execute')),
  null, 'ni anon ni service_role pueden cerrar conversaciones de prueba');
select ok(has_function_privilege('authenticated', 'public.send_test_message(uuid, uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'public.close_test_conversation(uuid)', 'execute'),
  'authenticated, sí (con las comprobaciones de dentro)');
select ok(not has_table_privilege('authenticated', 'public.messages', 'insert')
          and not has_table_privilege('authenticated', 'public.conversations', 'insert')
          and not has_table_privilege('authenticated', 'public.contacts', 'insert'),
  'la app sigue sin escribir directamente en mensajes, conversaciones ni contactos');

-- ===========================================================================
-- 2. El equipo de un local prueba un agente en su local
-- ===========================================================================
select pg_temp.login(:a_staff1) as staff1_session \gset
select public.send_test_message(:'reception_a', :loc_a1, '  Hola, ¿tenéis hueco?  ') as conv1 \gset
select is(
  (select count(*)::int from public.messages where conversation_id = :'conv1'), 1,
  'quien lo envía ve su mensaje con su propia sesión (RLS)');
reset role;

select is(
  (select row(c.organization_id, c.location_id, c.agent_id, c.mode, a.channel, a.location_id)::text
   from public.conversations c join public.channel_accounts a on a.id = c.channel_account_id where c.id = :'conv1'),
  row(:org_a::uuid, :loc_a1::uuid, :'reception_a'::uuid, 'agent'::text, 'test'::text, :loc_a1::uuid)::text,
  'una conversación con el agente, en su local y en el canal de prueba');
select is(
  (select row(i.kind, i.external_id, k.display_name)::text
   from public.conversations c
   join public.contacts k on k.id = c.contact_id
   join public.contact_identities i on i.contact_id = k.id
   where c.id = :'conv1'),
  row('test'::text, :a_staff1::text, 'a_staff1@test.local (prueba)'::text)::text,
  'el contacto es el de prueba de quien escribe: su id y su nombre');
select is(
  (select row(direction, author, content, author_user_id)::text from public.messages where conversation_id = :'conv1'),
  row('in'::text, 'contact'::text, 'Hola, ¿tenéis hueco?'::text, null::uuid)::text,
  'un mensaje de entrada del contacto, sin espacios sobrantes');
select is(
  (select count(*)::int from fixture_events e
   where e.type = 'message.received' and e.organization_id = :org_a and e.location_id = :loc_a1
     and e.payload ->> 'conversation_id' = :'conv1'),
  1, 'emite message.received con la organización y el local de la conversación');

select pg_temp.act_as(:a_staff1, :'staff1_session');
select public.send_test_message(:'reception_a', :loc_a1, 'Otra pregunta') as conv1_again \gset
reset role;
select is(:'conv1_again'::uuid, :'conv1'::uuid, 'el segundo mensaje va a la misma conversación');
select is(
  (select row(
     (select count(*) from public.channel_accounts where organization_id = :org_a and channel = 'test'),
     (select count(*) from public.contact_identities where organization_id = :org_a and kind = 'test'),
     (select count(*) from public.messages where conversation_id = :'conv1'))::text),
  row(1::bigint, 1::bigint, 2::bigint)::text,
  'sin cuentas ni contactos duplicados');

-- Otro agente: otra conversación, con el mismo contacto y la misma cuenta.
select pg_temp.act_as(:a_staff1, :'staff1_session');
select public.send_test_message(:'customer_a', :loc_a1, 'Hola') as conv_customer \gset
reset role;
select isnt(:'conv_customer'::uuid, :'conv1'::uuid, 'cada agente, su conversación');

-- Si una prueba la pasó a una persona, el siguiente mensaje la devuelve al agente.
update public.conversations set mode = 'human' where id = :'conv1';
select pg_temp.act_as(:a_staff1, :'staff1_session');
select public.send_test_message(:'reception_a', :loc_a1, '¿Sigues ahí?') as conv1_reopened \gset
reset role;
select is((select mode from public.conversations where id = :'conv1'), 'agent', 'vuelve al agente');
select is(:'conv1_reopened'::uuid, :'conv1'::uuid, 'en la misma conversación');

-- Otra persona del equipo, en su local: su propio contacto de prueba.
select pg_temp.login(:a_staff2) as staff2_session \gset
select public.send_test_message(:'reception_a', :loc_a2, 'Hola desde A2') as conv2 \gset
select is((select count(*)::int from public.messages where conversation_id = :'conv1'), 0,
  'el equipo de A2 no ve la conversación de prueba de A1 (RLS)');
reset role;
select isnt(
  (select contact_id from public.conversations where id = :'conv2'),
  (select contact_id from public.conversations where id = :'conv1'),
  'cada persona, su contacto de prueba');

-- ===========================================================================
-- 3. Lo que no puede
-- ===========================================================================
select pg_temp.act_as(:a_staff2, :'staff2_session');
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, :'reception_a', :loc_a1),
  '42501', 'fuera de tu alcance', 'el equipo de A2 no prueba en A1');
select pg_temp.act_as(:a_staff1, :'staff1_session');
select throws_ok(format($$select public.send_test_message(%L, null, 'hola')$$, :'reception_a'),
  '42501', 'fuera de tu alcance', 'sin local, solo un org_admin');
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, :'reception_a', :loc_b1),
  'P0002', 'agente no encontrado', 'un local de otra organización: como si no existiera');
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, :'reception_b', :loc_b1),
  'P0002', 'agente no encontrado', 'un agente de otra organización: como si no existiera');
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, gen_random_uuid(), :loc_a1),
  'P0002', 'agente no encontrado', 'un agente que no existe');
select throws_ok(format($$select public.send_test_message(%L, %L, '   ')$$, :'reception_a', :loc_a1),
  '22023', null, 'un mensaje vacío, no');
select throws_ok(format($$select public.send_test_message(%L, %L, %L)$$, :'reception_a', :loc_a1, repeat('a', 2001)),
  '22023', null, 'uno de más de 2000 caracteres, tampoco');
reset role;

select pg_temp.login(:outsider) as outsider_session \gset
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, :'reception_a', :loc_a1),
  'P0002', 'agente no encontrado', 'alguien sin membership no prueba nada');
reset role;

-- Un org_admin, con el segundo factor.
select pg_temp.login(:a_admin) as admin_aal1 \gset
select throws_ok(format($$select public.send_test_message(%L, null, 'hola')$$, :'reception_a'),
  '42501', 'hace falta el segundo factor', 'un org_admin sin aal2, no');
reset role;
select pg_temp.login_mfa(:a_admin);
select lives_ok(format($$select public.send_test_message(%L, null, 'hola')$$, :'reception_a'),
  'un org_admin con aal2 prueba en toda la organización');
reset role;
select is(
  (select count(*)::int from public.conversations c join public.channel_accounts a on a.id = c.channel_account_id
   where c.organization_id = :org_a and a.channel = 'test' and c.location_id is null and a.location_id is null),
  1, 'en la cuenta de prueba de toda la organización');

-- Un agente en pausa no se prueba; uno en draft, sí (todos nacen en draft).
update public.agents set status = 'paused' where id = :'reception_a';
select pg_temp.act_as(:a_staff1, :'staff1_session');
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, :'reception_a', :loc_a1),
  '55000', 'el agente está en pausa', 'un agente en pausa, no');
reset role;
update public.agents set status = 'draft' where id = :'reception_a';

-- Sesión cerrada: el JWT sigue, la sesión no.
delete from auth.sessions where id = :'staff2_session';
select pg_temp.act_as(:a_staff2, :'staff2_session');
select throws_ok(format($$select public.send_test_message(%L, %L, 'hola')$$, :'reception_a', :loc_a2),
  '42501', 'sin sesión', 'con la sesión cerrada, no');
reset role;

-- ===========================================================================
-- 4. Empezar de nuevo
-- ===========================================================================
-- Una conversación de un cliente de verdad en A1.
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-a1', 'reception', 'active') returning id as ca_web \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_web', :'reception_a') returning id as conv_real \gset

-- Y su contacto de prueba en una conversación que no es del canal de prueba.
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
select :org_a, :loc_a1, contact_id, :'ca_web', :'reception_a' from public.conversations where id = :'conv1'
returning id as conv_mixed \gset

select pg_temp.act_as(:a_staff1, :'staff1_session');
select throws_ok(format($$select public.close_test_conversation(%L)$$, :'conv_real'),
  'P0002', null, 'no cierra la conversación de un cliente');
select throws_ok(format($$select public.close_test_conversation(%L)$$, :'conv_mixed'),
  'P0002', null, 'ni una de su contacto de prueba fuera del canal de prueba');
select throws_ok(format($$select public.close_test_conversation(%L)$$, :'conv2'),
  'P0002', null, 'ni la de prueba de otra persona');
select lives_ok(format($$select public.close_test_conversation(%L)$$, :'conv1'), 'cierra la suya');
select lives_ok(format($$select public.close_test_conversation(%L)$$, :'conv1'), 'cerrarla otra vez no hace nada');
select public.send_test_message(:'reception_a', :loc_a1, 'Empiezo de nuevo') as conv1_new \gset
reset role;
select is(
  (select row((select mode from public.conversations where id = :'conv1'),
              (select mode from public.conversations where id = :'conv_real'),
              (select mode from public.conversations where id = :'conv2'))::text),
  row('closed'::text, 'agent'::text, 'agent'::text)::text,
  'solo se cerró la suya');
select isnt(:'conv1_new'::uuid, :'conv1'::uuid, 'el siguiente mensaje abre otra conversación, sin el historial');

-- ===========================================================================
-- 5. Freno de coste: 30 mensajes por hora y persona
-- ===========================================================================
-- a_staff1 lleva 5 en la última hora: se completan hasta 30 como plataforma.
insert into public.messages (organization_id, conversation_id, direction, author, content)
select :org_a, :'conv1_new', 'in', 'contact', 'relleno ' || g from generate_series(1, 25) g;
select is(
  (select count(*)::int from public.messages m
   join public.conversations c on c.id = m.conversation_id
   join public.contact_identities i on i.contact_id = c.contact_id
   where i.kind = 'test' and i.external_id = :a_staff1::text and m.author = 'contact'),
  30, 'a_staff1 lleva 30 mensajes de prueba en la última hora');
select pg_temp.act_as(:a_staff1, :'staff1_session');
select throws_ok(format($$select public.send_test_message(%L, %L, 'uno más')$$, :'reception_a', :loc_a1),
  '54000', null, 'el 31.º en la misma hora, no');
reset role;

select * from finish();
rollback;
