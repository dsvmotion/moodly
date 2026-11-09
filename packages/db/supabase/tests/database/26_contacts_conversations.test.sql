-- Canales, contactos y conversaciones (20261031130000, paso 4a). Cada uno ve lo
-- de su alcance (un local, o toda la organización si es org_admin); la app solo
-- lee; todo apunta a cosas de su misma organización; messages está
-- particionada por mes y sus particiones quedan fuera de la API.
begin;
\ir _fixtures/tenants.psql
select plan(39);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset

-- ===========================================================================
-- Datos (la plataforma, como el worker)
-- ===========================================================================
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', 'wa-a1', 'customer', 'active') returning id as ca_loc1 \gset
insert into public.channel_accounts (organization_id, channel, external_id, default_agent_type, status)
values (:org_a, 'webchat', 'web-a', 'customer', 'active') returning id as ca_shared \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type)
values (:org_b, :loc_b1, 'whatsapp', 'wa-b1', 'customer') returning id as ca_b \gset

insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name, preferred_location_id) values (:org_a, 'Luis', :loc_a2) returning id as c_luis \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Marta') returning id as c_marta \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as c_bea \gset
insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (:org_a, :'c_ana', 'phone', '+34600000001');
insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (:org_a, :'c_marta', 'email', 'marta@example.com');

insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_loc1', :'agent_a') returning id as conv_loc1 \gset
insert into public.conversations (organization_id, contact_id, channel_account_id, agent_id)
values (:org_a, :'c_marta', :'ca_shared', :'agent_a') returning id as conv_shared \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'c_bea', :'ca_b', :'agent_b') returning id as conv_b \gset

insert into public.messages (organization_id, conversation_id, direction, author, content, created_at)
values (:org_a, :'conv_loc1', 'in', 'contact', 'Hola, ¿tenéis hueco mañana?', '2026-11-15 10:00+00');
insert into public.messages (organization_id, conversation_id, direction, author, content, created_at, status)
values (:org_a, :'conv_loc1', 'out', 'agent', 'Sí, a las 11:00.', '2026-11-15 10:01+00', 'sent');
insert into public.messages (organization_id, conversation_id, direction, author, content, created_at)
values (:org_a, :'conv_shared', 'in', 'contact', 'Una pregunta', '2031-01-01 09:00+00');
insert into public.messages (organization_id, conversation_id, direction, author, content, created_at)
values (:org_b, :'conv_b', 'in', 'contact', 'Hola desde B', '2026-11-20 12:00+00');

-- ===========================================================================
-- 1. Particionado (ADR 0026 §3)
-- ===========================================================================
select is((select relkind::text from pg_class where oid = 'public.messages'::regclass), 'p',
  'messages está particionada');
select is(
  (select tableoid::regclass::text from public.messages where content = 'Sí, a las 11:00.'),
  'partitions.messages_2026_11', 'cada mensaje cae en la partición de su mes');
select is(
  (select tableoid::regclass::text from public.messages where content = 'Una pregunta'),
  'partitions.messages_default', 'y lo que llega sin partición, en la de por defecto (no se pierde)');
select is(private.ensure_monthly_partitions('messages', '2026-10-01', 3), 0,
  'crear las particiones es idempotente');
select is(private.ensure_monthly_partitions('messages', '2028-01-01', 2), 2,
  'y crea las que faltan');
select is(
  (select last_message_at from public.conversations where id = :'conv_loc1'), '2026-11-15 10:01+00'::timestamptz,
  'cada mensaje nuevo actualiza el último mensaje de su conversación');

-- ===========================================================================
-- 2. Quién ve qué
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select set_eq($$select id from public.conversations$$, format($$values (%L::uuid), (%L::uuid)$$, :'conv_loc1', :'conv_shared'),
  'el org_admin ve las conversaciones de su organización, también las de toda ella');
select is((select count(*)::int from public.channel_accounts), 2, 'y sus cuentas de canal');
select is((select count(*)::int from public.messages), 3, 'y sus mensajes');
reset role;

select pg_temp.login(:a_loc1_mgr) as s \gset
select set_eq($$select id from public.conversations$$, format($$values (%L::uuid)$$, :'conv_loc1'),
  'un location_manager ve las de su local, no las de toda la organización');
select is((select count(*)::int from public.messages), 2, 'y solo sus mensajes');
select set_eq($$select id from public.contacts$$, format($$values (%L::uuid)$$, :'c_ana'),
  've a los contactos de sus conversaciones, no a los demás');
select is((select external_id from public.contact_identities), '+34600000001', 'y cómo se les reconoce');
select is((select count(*)::int from public.channel_accounts), 0, 'pero no la configuración de los canales');
reset role;

select pg_temp.login(:a_staff1) as s \gset
select is((select count(*)::int from public.conversations), 1, 'el staff de un local ve las de su local');
reset role;
select pg_temp.login(:a_staff2) as s \gset
select is((select count(*)::int from public.conversations), 0, 'y el de otro local, ninguna');
select set_eq($$select id from public.contacts$$, format($$values (%L::uuid)$$, :'c_luis'),
  'pero sí al contacto que tiene su local como preferido');
reset role;

select pg_temp.login(:a_region_mgr) as s \gset
select is((select count(*)::int from public.conversations), 1, 'un region_manager ve las de los locales de su región');
reset role;

select pg_temp.login_mfa(:b_admin) as s \gset
select set_eq($$select id from public.conversations$$, format($$values (%L::uuid)$$, :'conv_b'),
  'el org_admin de otra organización solo ve las suyas');
select is((select count(*)::int from public.contacts), 1, 'y sus contactos');
reset role;

select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content) values (%L, %L, 'out', 'user', 'x')$$, :org_a, :'conv_loc1'),
  '42501', null, 'la app no escribe mensajes (los envía el worker)');
select throws_ok(
  format($$update public.conversations set mode = 'closed' where id = %L$$, :'conv_loc1'),
  '42501', null, 'ni cierra conversaciones (tomar y devolver el control, en 37_inbox_takeover)');
reset role;
-- Y no por casualidad (por ejemplo, porque un trigger falle después): sin privilegio.
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'insert')
  and not has_table_privilege('authenticated', 'public.messages', 'update')
  and not has_table_privilege('authenticated', 'public.messages', 'delete'),
  'authenticated no tiene privilegios de escritura sobre messages');
select ok(
  not exists (
    select 1 from unnest(array['channel_accounts', 'contacts', 'contact_identities', 'conversations']) t
    where has_table_privilege('authenticated', 'public.' || t, 'insert')
       or has_table_privilege('authenticated', 'public.' || t, 'update')
       or has_table_privilege('authenticated', 'public.' || t, 'delete')
  ),
  'ni sobre canales, contactos, identidades ni conversaciones');
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok($$select * from partitions.messages_2026_11$$, '42501', null, 'ni lee las particiones por fuera de su RLS');
select throws_ok($$select private.ensure_monthly_partitions('messages', '2029-01-01', 1)$$, '42501', null,
  'ni crea particiones');
reset role;

-- ===========================================================================
-- 3. Integridad
-- ===========================================================================
select throws_ok(
  format($$insert into public.channel_accounts (organization_id, channel, external_id, default_agent_type) values (%L, 'whatsapp', 'wa-a1', 'customer')$$, :org_b),
  '23505', null, 'un número es de una sola organización (de ahí sale el tenant)');
select throws_ok(
  format($$insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type) values (%L, %L, 'whatsapp', 'wa-x', 'customer')$$, :org_a, :loc_b1),
  '23503', null, 'una cuenta no es de un local de otra organización');
select throws_ok(
  format($$insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (%L, %L, 'phone', '600 000 001')$$, :org_a, :'c_luis'),
  '23514', null, 'el teléfono va normalizado en E.164');
select throws_ok(
  format($$insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (%L, %L, 'email', 'Luis@Example.com')$$, :org_a, :'c_luis'),
  '23514', null, 'y el email en minúsculas');
select throws_ok(
  format($$insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (%L, %L, 'phone', '+34600000001')$$, :org_a, :'c_luis'),
  '23505', null, 'una identidad es de un solo contacto en cada organización');
select throws_ok(
  format($$insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id) values (%L, %L, %L, %L, %L)$$,
         :org_a, :loc_a1, :'c_bea', :'ca_loc1', :'agent_a'),
  '23503', null, 'una conversación no es con un contacto de otra organización');
select throws_ok(
  format($$insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id) values (%L, %L, %L, %L, %L)$$,
         :org_a, :loc_a1, :'c_ana', :'ca_loc1', :'agent_b'),
  '23503', null, 'ni con un agente de otra organización');
select throws_ok(
  format($$insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id) values (%L, %L, %L, %L, %L)$$,
         :org_a, :loc_a2, :'c_ana', :'ca_loc1', :'agent_a'),
  '23514', null, 'la cuenta de un local solo abre conversaciones de ese local');
select throws_ok(
  format($$update public.conversations set contact_id = %L where id = %L$$, :'c_luis', :'conv_loc1'),
  '42501', null, 'el contacto de una conversación no cambia');
update public.conversations set location_id = :loc_a3 where id = :'conv_shared';
select throws_ok(
  format($$update public.conversations set location_id = %L where id = %L$$, :loc_a2, :'conv_shared'),
  '42501', null, 'el local de una conversación de cuenta compartida se resuelve una vez y no cambia');
select throws_ok(
  format($$update public.conversations set assigned_user_id = %L where id = %L$$, :b_admin, :'conv_loc1'),
  '23514', null, 'quien atiende es de la organización');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content) values (%L, %L, 'in', 'agent', 'x')$$, :org_a, :'conv_loc1'),
  '23514', null, 'lo que entra lo escribe el contacto');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content) values (%L, %L, 'in', 'contact', 'x')$$, :org_a, :'conv_b'),
  '23503', null, 'un mensaje no va a la conversación de otra organización');

select * from finish();
rollback;
