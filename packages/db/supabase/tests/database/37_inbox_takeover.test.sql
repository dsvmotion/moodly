-- La bandeja y «tomar el control» (20261109230000): el canal de cada
-- conversación para quien la ve; tomar y devolver el control entre el agente y
-- una persona; y los mensajes del equipo, solo con la conversación en manos de
-- una persona. Quien no la ve, nada; el org_admin, con aal2.
begin;
\ir _fixtures/tenants.psql
select plan(33);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset

-- Datos (la plataforma, como el worker).
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', 'wa-a1', 'customer', 'active') returning id as ca_wa \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-a1', 'customer', 'active') returning id as ca_web \gset
insert into public.channel_accounts (organization_id, channel, external_id, default_agent_type, status)
values (:org_a, 'webchat', 'web-a', 'customer', 'active') returning id as ca_shared \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Marta') returning id as c_marta \gset

-- Aunque quien inserta diga otro canal, vale el de su cuenta.
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, channel)
values (:org_a, :loc_a1, :'c_ana', :'ca_web', :'agent_a', 'test') returning id as conv_web \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_wa', :'agent_a') returning id as conv_wa \gset
insert into public.conversations (organization_id, contact_id, channel_account_id, agent_id)
values (:org_a, :'c_marta', :'ca_shared', :'agent_a') returning id as conv_shared \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_marta', :'ca_web', :'agent_a', 'closed') returning id as conv_closed \gset

-- ===========================================================================
-- 1. El canal de la conversación
-- ===========================================================================
select results_eq(
  format($$select channel from public.conversations where id in (%L, %L) order by channel$$, :'conv_web', :'conv_wa'),
  $$values ('webchat'::text), ('whatsapp'::text)$$,
  'cada conversación lleva el canal de su cuenta, diga lo que diga quien la crea');
select throws_ok(
  format($$update public.conversations set channel = 'whatsapp' where id = %L$$, :'conv_web'),
  '42501', null, 'y no cambia, ni para la plataforma');
select pg_temp.login(:a_staff1) as s \gset
select results_eq(
  format($$select channel from public.conversations where id = %L$$, :'conv_wa'),
  $$values ('whatsapp'::text)$$,
  'el equipo del local ve el canal de sus conversaciones (sin ver la configuración de las cuentas)');
select is((select count(*)::int from public.channel_accounts), 0, 'la configuración de las cuentas sigue siendo del org_admin');
reset role;

-- ===========================================================================
-- 2. Tomar y devolver el control
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
update public.conversations set mode = 'human' where id = :'conv_wa' returning mode || '/' || assigned_user_id as taken \gset
reset role;
select is(:'taken', 'human/' || :a_staff1,
  'el equipo del local toma el control: pasa a una persona, y la atiende quien la tomó');
select is((select assigned_user_id from public.conversations where id = :'conv_wa'), :a_staff1::uuid, 'queda guardado');

select pg_temp.login(:a_loc1_mgr) as s \gset
update public.conversations set mode = 'human' where id = :'conv_wa';
reset role;
select is((select assigned_user_id from public.conversations where id = :'conv_wa'), :a_loc1_mgr::uuid,
  'otra persona del local puede quedársela');

select pg_temp.login(:a_staff1) as s \gset
update public.conversations set mode = 'agent' where id = :'conv_wa';
reset role;
select results_eq(
  format($$select mode, assigned_user_id from public.conversations where id = %L$$, :'conv_wa'),
  $$values ('agent'::text, null::uuid)$$,
  'devolverla al agente la deja sin persona');

select pg_temp.login(:a_staff1) as s \gset
select throws_ok(
  format($$update public.conversations set mode = 'closed' where id = %L$$, :'conv_wa'),
  '42501', null, 'cerrarla no, todavía');
select throws_ok(
  format($$update public.conversations set mode = 'agent' where id = %L$$, :'conv_closed'),
  '42501', null, 'ni reabrir una cerrada');
select throws_ok(
  format($$update public.conversations set assigned_user_id = %L where id = %L$$, :a_staff2, :'conv_wa'),
  '42501', null, 'quien la atiende no lo elige la app');
select throws_ok(
  format($$update public.conversations set last_message_at = now() where id = %L$$, :'conv_wa'),
  '42501', null, 'ni el resto de columnas');
with u as (update public.conversations set mode = 'human' where id = :'conv_shared' returning 1)
select is(count(*)::int, 0, 'una de toda la organización, el equipo de un local no la ve ni la toma') from u;
reset role;

select pg_temp.login(:a_staff2) as s \gset
with u as (update public.conversations set mode = 'human' where id = :'conv_wa' returning 1)
select is(count(*)::int, 0, 'el equipo de otro local no la toma') from u;
reset role;

select pg_temp.login(:a_admin) as s \gset
with u as (update public.conversations set mode = 'human' where id = :'conv_shared' returning 1)
select is(count(*)::int, 0, 'el org_admin sin aal2 tampoco') from u;
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
update public.conversations set mode = 'human' where id = :'conv_shared' returning assigned_user_id as admin_took \gset
reset role;
select is(:'admin_took'::uuid, :a_admin::uuid, 'con aal2, el org_admin toma también las de toda la organización');
select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.conversations set mode = 'agent' where id = :'conv_shared' returning 1)
select is(count(*)::int, 0, 'ni el org_admin de otra organización') from u;
reset role;
select is((select mode from public.conversations where id = :'conv_shared'), 'human', 'la conversación sigue en manos del org_admin de A');

-- ===========================================================================
-- 3. Mensajes del equipo
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Hola, soy Laura')$$, :org_a, :'conv_web'),
  '42501', null, 'con la conversación en manos del agente, el equipo no escribe');
update public.conversations set mode = 'human' where id = :'conv_web';
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Hola, soy Laura del equipo')$$, :org_a, :'conv_web'),
  'tomada la conversación, escribe');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, '   ')$$, :org_a, :'conv_web'),
  '23514', null, 'un mensaje vacío no vale');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content) values (%L, %L, 'in', 'contact', 'Suplanto al cliente')$$, :org_a, :'conv_web'),
  '42501', null, 'y no elige quién lo escribe ni en qué sentido');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content, status) values (%L, %L, 'x', 'delivered')$$, :org_a, :'conv_web'),
  '42501', null, 'ni su estado');
reset role;
select results_eq(
  format($$select direction, author, author_user_id, status from public.messages where conversation_id = %L$$, :'conv_web'),
  format($$values ('out'::text, 'user'::text, %L::uuid, 'sent'::text)$$, :a_staff1),
  'sale como mensaje de una persona del equipo, con quién lo escribió; en el chat web, enviado');
select isnt((select last_message_at from public.conversations where id = :'conv_web'), null,
  'y la conversación sube en la bandeja');
select is((select count(*)::int from public.domain_events where type = 'message.received' and payload->>'conversation_id' = :'conv_web'), 0,
  'no emite message.received: no es del cliente, el agente no lo contesta');

-- Por WhatsApp queda pendiente: lo envía el worker por su canal.
select pg_temp.login(:a_staff1) as s \gset
update public.conversations set mode = 'human' where id = :'conv_wa';
insert into public.messages (organization_id, conversation_id, content) values (:org_a, :'conv_wa', 'Te escribo por WhatsApp');
reset role;
select is((select status from public.messages where conversation_id = :'conv_wa'), 'pending', 'por WhatsApp, pendiente de enviar');

select pg_temp.login(:a_staff2) as s \gset
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Desde otro local')$$, :org_a, :'conv_wa'),
  '42501', null, 'el equipo de otro local no escribe en ella');
reset role;
select pg_temp.login(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Sin MFA')$$, :org_a, :'conv_shared'),
  '42501', null, 'el org_admin sin aal2 tampoco');
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Desde B')$$, :org_a, :'conv_wa'),
  '42501', null, 'ni otra organización');
reset role;

-- ===========================================================================
-- 4. Funciones y privilegios
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'private.touch_conversation()'::regprocedure),
  'touch_conversation es security definer (el equipo no puede tocar last_message_at)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.touch_conversation()', 'execute')),
  null, 'y nadie de la app la puede llamar');
select ok(
  has_column_privilege('authenticated', 'public.conversations', 'mode', 'update')
  and not has_column_privilege('authenticated', 'public.conversations', 'assigned_user_id', 'update')
  and not has_column_privilege('authenticated', 'public.messages', 'author', 'insert')
  and not has_column_privilege('authenticated', 'public.messages', 'direction', 'insert'),
  'la app solo escribe mode de una conversación y el texto de un mensaje');

select * from finish();
rollback;
