-- M-10 (20261112010000): la bandeja por Realtime (Broadcast privado). Cada alta
-- o cambio de un mensaje o una conversación avisa al tema de su bandeja
-- (inbox:<org>:<local|org>) solo con identificadores, y solo escucha un tema
-- quien puede leer sus conversaciones, con la sesión activa. La política se
-- prueba como la comprueba Realtime al unirse a un canal privado: con el rol, el
-- JWT del suscriptor y realtime.topic.
begin;
\ir _fixtures/tenants.psql
select plan(19);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
select private.inbox_topic(:org_a, :loc_a1) as topic_a1 \gset
select private.inbox_topic(:org_a, :loc_a2) as topic_a2 \gset
select private.inbox_topic(:org_a, null) as topic_a_org \gset
select private.inbox_topic(:org_b, :loc_b1) as topic_b1 \gset

-- ===========================================================================
-- 1. Cada alta o cambio avisa a su bandeja, sin contenido
-- ===========================================================================
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', 'rt-a1', 'customer', 'active') returning id as ca_a1 \gset
insert into public.channel_accounts (organization_id, channel, external_id, default_agent_type, status)
values (:org_a, 'webchat', 'rt-a', 'customer', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'whatsapp', 'rt-b1', 'customer', 'active') returning id as ca_b1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as c_bea \gset

insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a1', :'agent_a') returning id as conv_a1 \gset
select results_eq(
  format($$select topic, event, private, payload ->> 'op', payload ->> 'conversation_id' from realtime.messages
           where payload ->> 'conversation_id' = %L order by inserted_at$$, :'conv_a1'),
  format($$values (%L, 'conversation', true, 'INSERT', %L)$$, :'topic_a1', :'conv_a1'),
  'una conversación nueva de A1 avisa, en privado, a la bandeja de A1');

insert into public.messages (organization_id, conversation_id, direction, author, content, created_at)
values (:org_a, :'conv_a1', 'in', 'contact', 'Hola, ¿tenéis hueco mañana?', '2026-11-15 10:00+00')
returning id as msg_a1 \gset
select results_eq(
  format($$select topic, event, private, payload ->> 'op' from realtime.messages
           where payload ->> 'message_id' = %L$$, :'msg_a1'),
  format($$values (%L, 'message', true, 'INSERT')$$, :'topic_a1'),
  'un mensaje nuevo (en su partición) avisa a la bandeja del local de su conversación');
select is(
  (select array_agg(k order by k) from realtime.messages, jsonb_object_keys(payload) k where payload ->> 'message_id' = :'msg_a1'),
  array['conversation_id', 'id', 'message_id', 'op'],
  'el aviso solo lleva identificadores (id es el del mensaje de Realtime): ni el contenido ni datos del contacto');

update public.messages set status = 'read' where id = :'msg_a1';
select is(
  (select count(*)::int from realtime.messages where payload ->> 'message_id' = :'msg_a1' and payload ->> 'op' = 'UPDATE'),
  1, 'un cambio de estado de un mensaje también avisa');

insert into public.conversations (organization_id, contact_id, channel_account_id, agent_id)
values (:org_a, :'c_ana', :'ca_a', :'agent_a') returning id as conv_a_org \gset
select is(
  (select topic from realtime.messages where payload ->> 'conversation_id' = :'conv_a_org' and payload ->> 'op' = 'INSERT'),
  :'topic_a_org', 'una conversación sin local avisa a la bandeja de toda la organización');

create temp table rt_before as
select topic, count(*)::int as n from realtime.messages
where payload ->> 'conversation_id' = :'conv_a_org' and event = 'conversation' group by topic;
update public.conversations set location_id = :loc_a1 where id = :'conv_a_org';
select results_eq(
  format($$select m.topic, count(*)::int - coalesce(max(b.n), 0) from realtime.messages m
           left join rt_before b on b.topic = m.topic
           where m.payload ->> 'conversation_id' = %L and m.event = 'conversation'
           group by m.topic order by m.topic$$, :'conv_a_org'),
  format($$select * from (values (%L, 1), (%L, 1)) v(t, n) order by t$$, :'topic_a1', :'topic_a_org'),
  'si una conversación pasa a un local, se enteran la bandeja de antes y la de ahora');

insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'c_bea', :'ca_b1', :'agent_b') returning id as conv_b1 \gset

-- ===========================================================================
-- 2. Quién escucha un tema (como Realtime al unirse a un canal privado)
-- ===========================================================================
-- Cuenta lo que ve del tema p_topic una persona con su sesión (o con una que ya
-- no existe), con el rol y los claims con los que Realtime comprueba el acceso.
create function pg_temp.can_listen(p_user uuid, p_session uuid, p_topic text) returns boolean language plpgsql as $$
declare
  v_seen int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_session, 'aal', 'aal1')::text, true);
  perform set_config('realtime.topic', p_topic, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_seen from realtime.messages where topic = p_topic and extension = 'broadcast';
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
  return v_seen > 0;
end;
$$;

select pg_temp.login(:a_admin) as s_admin \gset
reset role;
select pg_temp.login(:a_region_mgr) as s_region \gset
reset role;
select pg_temp.login(:a_staff1) as s_staff1 \gset
reset role;
select pg_temp.login(:a_staff2) as s_staff2 \gset
reset role;
select pg_temp.login(:b_admin) as s_b_admin \gset
reset role;
select pg_temp.login(:outsider) as s_outsider \gset
reset role;

select ok(pg_temp.can_listen(:a_staff1, :'s_staff1', :'topic_a1'), 'el staff de A1 escucha la bandeja de A1');
select ok(pg_temp.can_listen(:a_region_mgr, :'s_region', :'topic_a1'), 'el region_manager de A-Norte, también');
select ok(pg_temp.can_listen(:a_admin, :'s_admin', :'topic_a_org'), 'el org_admin escucha la bandeja de toda la organización');
select ok(not pg_temp.can_listen(:a_staff2, :'s_staff2', :'topic_a1'), 'el staff de A2 no escucha la bandeja de A1');
select ok(not pg_temp.can_listen(:a_staff1, :'s_staff1', :'topic_a_org'), 'ni el staff la de toda la organización');
select ok(not pg_temp.can_listen(:b_admin, :'s_b_admin', :'topic_a1'), 'el org_admin de otra organización no escucha la de A');
select ok(not pg_temp.can_listen(:outsider, :'s_outsider', :'topic_a1'), 'alguien sin organización, tampoco');
select ok(not pg_temp.can_listen(:a_staff1, gen_random_uuid(), :'topic_a1'),
  'ni un JWT todavía válido de una sesión que ya no existe (session_is_active)');
select ok(pg_temp.can_listen(:b_admin, :'s_b_admin', :'topic_b1'), 'el org_admin de B sí escucha la suya');

-- Un tema que no es de una bandeja no lo escucha nadie (ni el org_admin).
insert into realtime.messages (topic, extension, payload, event, private)
values ('inbox:no-es-un-uuid:org', 'broadcast', '{}', 'message', true),
       ('otro-tema', 'broadcast', '{}', 'message', true);
select ok(not pg_temp.can_listen(:a_admin, :'s_admin', 'inbox:no-es-un-uuid:org'), 'un tema mal formado no lo escucha nadie');
select ok(not pg_temp.can_listen(:a_admin, :'s_admin', 'otro-tema'), 'ni uno que no es de la bandeja');

-- Al cerrar la sesión deja de escuchar enseguida.
delete from auth.sessions where id = :'s_staff1';
select ok(not pg_temp.can_listen(:a_staff1, :'s_staff1', :'topic_a1'), 'al cerrar su sesión, el staff de A1 deja de escuchar');

-- Nadie de la app emite en la bandeja: no hay política de insert.
select pg_temp.login(:a_admin) as s_admin2 \gset
select throws_ok(
  format($$insert into realtime.messages (topic, extension, payload, event, private) values (%L, 'broadcast', '{}', 'message', true)$$, :'topic_a1'),
  '42501', null, 'una persona no puede emitir en el tema de una bandeja');
reset role;

select * from finish();
rollback;
