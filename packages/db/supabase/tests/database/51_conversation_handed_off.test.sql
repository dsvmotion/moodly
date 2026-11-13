-- El paso a una persona, con aviso (20261112200000, CU3): cuando la plataforma
-- (el worker) pasa una conversación del agente a una persona, sea cual sea la
-- causa, queda un conversation.handed_off en el outbox en la misma transacción
-- y la bandeja de su local recibe un Broadcast privado «handoff»; y
-- handoff_notification dice a quién avisar (quien puede llevar la conversación:
-- la regla de can_see_scope), de una sola organización y solo para service_role.
-- Que una persona tome el control no avisa a nadie.
begin;
\ir _fixtures/tenants.psql
select plan(30);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Berta') returning id as c_berta \gset

insert into public.channel_accounts (id, organization_id, location_id, channel, external_id, default_agent_type, status)
values ('f3000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'whatsapp', 'ho-a1', 'customer', 'active'),
       ('f3000000-0000-4000-8000-000000000002', :org_a, null, 'webchat', 'ho-a-org', 'customer', 'active'),
       ('f3000000-0000-4000-8000-000000000003', :org_b, :loc_b1, 'whatsapp', 'ho-b1', 'customer', 'active');

-- Una conversación de A1, una de toda la organización A y una de B1, todas con el agente.
insert into public.conversations (id, organization_id, location_id, contact_id, channel_account_id, agent_id)
values ('f4000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'c_ana', 'f3000000-0000-4000-8000-000000000001', :'agent_a'),
       ('f4000000-0000-4000-8000-000000000002', :org_a, null, :'c_ana', 'f3000000-0000-4000-8000-000000000002', :'agent_a'),
       ('f4000000-0000-4000-8000-000000000003', :org_b, :loc_b1, :'c_berta', 'f3000000-0000-4000-8000-000000000003', :'agent_b'),
       ('f4000000-0000-4000-8000-000000000004', :org_a, :loc_a1, :'c_ana', 'f3000000-0000-4000-8000-000000000001', :'agent_a'),
       ('f4000000-0000-4000-8000-000000000005', :org_a, :loc_a1, :'c_ana', 'f3000000-0000-4000-8000-000000000001', :'agent_a');
\set conv_a1  '''f4000000-0000-4000-8000-000000000001'''
\set conv_org '''f4000000-0000-4000-8000-000000000002'''
\set conv_b1  '''f4000000-0000-4000-8000-000000000003'''
\set conv_a1b '''f4000000-0000-4000-8000-000000000004'''
\set conv_w   '''f4000000-0000-4000-8000-000000000005'''

create temp view handoff_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b) and type = 'conversation.handed_off';
grant select on handoff_events to authenticated, service_role;

-- ===========================================================================
-- 1. Las funciones: quién puede llamarlas
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'private.emit_conversation_handed_off()'::regprocedure),
  'emit_conversation_handed_off es security definer (escribe el evento; service_role no tiene INSERT en domain_events)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.emit_conversation_handed_off()', 'execute')),
  null, 'nadie de la app puede ejecutar emit_conversation_handed_off');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'public.handoff_notification(uuid, uuid)', 'execute')),
  array['service_role'], 'handoff_notification: solo service_role (el worker)');
select ok((select provolatile = 's' from pg_proc where oid = 'public.handoff_notification(uuid, uuid)'::regprocedure),
  'handoff_notification es stable: solo lee');

-- ===========================================================================
-- 2. Una persona que toma el control no avisa a nadie
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
update public.conversations set mode = 'human' where id = :conv_a1b;
reset role;
select is((select mode from public.conversations where id = :conv_a1b), 'human', 'el staff de A1 ha tomado el control');
select is((select count(*)::int from handoff_events), 0, 'y eso no deja ningún conversation.handed_off');
select is(
  (select count(*)::int from realtime.messages where event = 'handoff' and payload ->> 'conversation_id' = :conv_a1b),
  0, 'ni un aviso handoff en la bandeja');

-- ===========================================================================
-- 3. La plataforma pasa la conversación a una persona: un evento, en la misma transacción
-- ===========================================================================
set local role service_role;
update public.conversations set mode = 'human' where id = :conv_a1 and mode = 'agent';
reset role;
select is((select count(*)::int from handoff_events), 1, 'el paso de la plataforma deja un conversation.handed_off');
select results_eq(
  format($$select organization_id, location_id, payload from handoff_events where payload ->> 'conversation_id' = %L$$, :conv_a1),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('conversation_id', %L, 'agent_id', %L))$$, :org_a, :loc_a1, :conv_a1, :'agent_a'),
  'con la organización y el local de la fila, y solo ids');
select results_eq(
  format($$select topic, private, payload - 'id' from realtime.messages where event = 'handoff' and payload ->> 'conversation_id' = %L$$, :conv_a1),
  format($$values (%L::text, true, jsonb_build_object('conversation_id', %L))$$, 'inbox:' || :org_a || ':' || :loc_a1, :conv_a1),
  'y la bandeja de A1 recibe un handoff privado, solo con el id');

-- Repetir el paso no cambia nada (solo de agent a human): ningún aviso más.
set local role service_role;
update public.conversations set mode = 'human' where id = :conv_a1 and mode = 'agent';
update public.conversations set mode = 'human' where id = :conv_a1;
update public.conversations set last_message_at = now() where id = :conv_a1;
reset role;
select is((select count(*)::int from handoff_events), 1, 'repetir el paso o tocar otra columna no deja un segundo evento');
select is(
  (select count(*)::int from realtime.messages where event = 'handoff' and payload ->> 'conversation_id' = :conv_a1),
  1, 'ni un segundo handoff');

-- Devuelta al agente y vuelta a pasar: es otro paso, otro aviso.
set local role service_role;
update public.conversations set mode = 'agent' where id = :conv_a1;
update public.conversations set mode = 'human' where id = :conv_a1 and mode = 'agent';
reset role;
select is((select count(*)::int from handoff_events where payload ->> 'conversation_id' = :conv_a1), 2,
  'devuelta al agente y pasada otra vez: un segundo aviso');

-- Cerrarla no es pasarla a una persona.
set local role service_role;
update public.conversations set mode = 'closed' where id = :conv_org;
reset role;
select is((select count(*)::int from handoff_events where payload ->> 'conversation_id' = :conv_org), 0,
  'cerrar una conversación no avisa');
set local role service_role;
update public.conversations set mode = 'agent' where id = :conv_org;
update public.conversations set mode = 'human' where id = :conv_org;
update public.conversations set mode = 'human' where id = :conv_b1;
reset role;
select results_eq(
  format($$select organization_id, location_id from handoff_events where payload ->> 'conversation_id' in (%L, %L) order by organization_id$$,
         :conv_org, :conv_b1),
  format($$values (%L::uuid, null::uuid), (%L::uuid, %L::uuid)$$, :org_a, :org_b, :loc_b1),
  'la de toda la organización y la de B, cada una con su organización y su local');
select is(
  (select topic from realtime.messages where event = 'handoff' and payload ->> 'conversation_id' = :conv_org),
  'inbox:' || :org_a || ':org', 'la de toda la organización avisa al tema de la organización');

-- ===========================================================================
-- 3b. Como moodly_worker (PL-T1, ADR 0049): el worker cambia mode con su
--     privilegio de columna y guard_worker_conversation; no tiene INSERT en
--     domain_events, y el evento lo escribe la función del trigger.
-- ===========================================================================
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
select ok(not has_table_privilege('moodly_worker', 'public.domain_events', 'insert'),
  'moodly_worker no tiene INSERT en domain_events: no puede fabricar un aviso');

-- Con la organización de B fijada, la conversación de A no existe para él: ni cambia ni avisa.
set local role moodly_worker;
select set_config('moodly.organization_id', :org_b, true) as _org \gset
update public.conversations set mode = 'human' where id = :conv_w and mode = 'agent';
reset role;
select is((select count(*)::int from handoff_events where payload ->> 'conversation_id' = :conv_w), 0,
  'el worker de otra organización no pasa la conversación ni deja un aviso');

set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select lives_ok(format($$update public.conversations set mode = 'human' where id = %L and mode = 'agent'$$, :conv_w),
  'el worker de A pasa su conversación a una persona');
reset role;
select results_eq(
  format($$select organization_id, location_id, payload from handoff_events where payload ->> 'conversation_id' = %L$$, :conv_w),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('conversation_id', %L, 'agent_id', %L))$$, :org_a, :loc_a1, :conv_w, :'agent_a'),
  'y queda su conversation.handed_off, con la organización y el local de la fila');

-- ===========================================================================
-- 4. handoff_notification: de una sola organización
-- ===========================================================================
set local role service_role;
select is(public.handoff_notification(:org_a, :conv_b1), null, 'una conversación de B no existe para A');
select is(public.handoff_notification(:org_b, :conv_a1), null, 'ni una de A para B');
select is(public.handoff_notification(:org_a, gen_random_uuid()), null, 'una que no existe, tampoco');

select results_eq(
  format($$select n -> 'conversation' ->> 'id', n -> 'conversation' ->> 'mode', n -> 'conversation' ->> 'channel',
                  n -> 'conversation' ->> 'location_id', n -> 'contact' ->> 'display_name', n -> 'agent' ->> 'type_key',
                  n -> 'location' ->> 'name', n -> 'organization' ->> 'default_locale'
           from (select public.handoff_notification(%L, %L) as n) x$$, :org_a, :conv_a1),
  format($$values (%L, 'human', 'whatsapp', %L, 'Ana', (select t.key from public.agents a join public.agent_types t on t.id = a.agent_type_id where a.id = %L),
                   'Local A1', (select default_locale from public.organizations where id = %L))$$, :conv_a1, :loc_a1, :'agent_a', :org_a),
  'la conversación, su cliente, su agente y su local');

-- ===========================================================================
-- 5. A quién se avisa: quien puede llevarla (can_see_scope)
-- ===========================================================================
select is(
  (select array_agg((r ->> 'user_id')::uuid order by (r ->> 'user_id')::uuid)
   from jsonb_array_elements(public.handoff_notification(:org_a, :conv_a1) -> 'recipients') r),
  array[:a_admin, :a_region_mgr, :a_loc1_mgr, :a_staff1]::uuid[],
  'de A1: el org_admin, la región de A1 (A-Norte), quien dirige A1 y su staff; no el staff de A2');
select is(
  (select array_agg((r ->> 'user_id')::uuid)
   from jsonb_array_elements(public.handoff_notification(:org_a, :conv_org) -> 'recipients') r),
  array[:a_admin]::uuid[], 'la de toda la organización, solo el org_admin');
select is(
  (select array_agg((r ->> 'user_id')::uuid order by (r ->> 'user_id')::uuid)
   from jsonb_array_elements(public.handoff_notification(:org_b, :conv_b1) -> 'recipients') r),
  array[:b_admin, :b_loc_mgr]::uuid[], 'la de B1, solo personas de B');
select is(
  (select r ->> 'email' from jsonb_array_elements(public.handoff_notification(:org_a, :conv_a1) -> 'recipients') r
   where (r ->> 'user_id')::uuid = :a_staff1),
  'a_staff1@test.local', 'cada una con su email');
reset role;

-- Una cuenta baneada, borrada o sin email confirmado no recibe nada.
update auth.users set banned_until = now() + interval '1 day' where id = :a_staff1;
update auth.users set email_confirmed_at = null where id = :a_loc1_mgr;
set local role service_role;
select is(
  (select array_agg((r ->> 'user_id')::uuid order by (r ->> 'user_id')::uuid)
   from jsonb_array_elements(public.handoff_notification(:org_a, :conv_a1) -> 'recipients') r),
  array[:a_admin, :a_region_mgr]::uuid[], 'sin la cuenta baneada ni la que no ha confirmado su email');
reset role;

-- En una organización que no está activa, nadie.
update public.organizations set status = 'suspended' where id = :org_a;
set local role service_role;
select is(public.handoff_notification(:org_a, :conv_a1) -> 'recipients', '[]'::jsonb,
  'en una organización que no está activa, a nadie');
reset role;

select * from finish();
rollback;
