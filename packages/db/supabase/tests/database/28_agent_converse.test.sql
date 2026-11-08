-- El agente contesta en las conversaciones (20261031150000, paso 4d-2): las
-- skills de código de la plataforma, las que trae de serie cada tipo de agente
-- (con su autonomía por defecto) y el evento message.received, que sale de cada
-- mensaje de un cliente con el tenant de las filas y solo ids.
begin;
\ir _fixtures/tenants.psql
select plan(40);

select a.id as reception_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'reception' \gset
select a.id as customer_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'customer' \gset
select a.id as sales_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'sales' \gset
select a.id as reception_b from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_b and t.key = 'reception' \gset
select id as find_slots from public.skills where organization_id is null and key = 'find_slots' \gset

-- ===========================================================================
-- 1. El catálogo de la plataforma
-- ===========================================================================
select set_eq(
  $$select key from public.skills where organization_id is null and kind = 'code' and status = 'published'$$,
  $$values ('find_slots'), ('list_my_appointments'), ('book_appointment'), ('reschedule_appointment'), ('cancel_appointment'), ('reply'),
           ('appointment_reminder')$$,
  'las skills de código de la plataforma: las de Recepción y reply, publicadas (y los recordatorios, 20261108090000)');
select set_eq(
  $$select key, effect_class, default_autonomy from public.skills where organization_id is null and kind = 'code'$$,
  $$values ('find_slots', 'read', 'autonomous'), ('list_my_appointments', 'read', 'autonomous'),
           ('book_appointment', 'internal_write', 'draft'), ('reschedule_appointment', 'internal_write', 'draft'),
           ('cancel_appointment', 'internal_write', 'draft'), ('reply', 'external_message', 'draft'),
           ('appointment_reminder', 'external_outreach', 'execute')$$,
  'leer es autónomo; reservar, mover, cancelar y responder nacen en borrador; los recordatorios salen solos');
select is(
  (select count(*)::int from public.skills where organization_id is null and kind = 'code' and key <> 'reply'
     and restricted_to_agent_types = '{reception}'),
  6, 'las de citas son solo de Recepción');
select is((select restricted_to_agent_types from public.skills where organization_id is null and key = 'reply'), '{}'::text[],
  'responder, de cualquier agente');

-- ===========================================================================
-- 2. Cada agente nace con las suyas
-- ===========================================================================
select set_eq(
  format($$select s.key, g.autonomy_level, g.enabled from public.agent_skills g join public.skills s on s.id = g.skill_id
           where g.agent_id = %L$$, :'reception_a'),
  $$values ('find_slots', 'autonomous', true), ('list_my_appointments', 'autonomous', true),
           ('book_appointment', 'draft', true), ('reschedule_appointment', 'draft', true),
           ('cancel_appointment', 'draft', true), ('reply', 'draft', true), ('appointment_reminder', 'execute', true)$$,
  'Recepción nace con sus siete skills, activas y con su autonomía por defecto');
select set_eq(
  format($$select s.key from public.agent_skills g join public.skills s on s.id = g.skill_id where g.agent_id = %L$$, :'customer_a'),
  $$values ('reply')$$,
  'Atención al cliente, solo con responder');
select is((select count(*)::int from public.agent_skills where agent_id = :'sales_a'), 0,
  'Ventas y Administración, con ninguna todavía');
select is((select count(*)::int from public.agent_skills where agent_id = :'reception_b'), 7,
  'cada organización tiene las suyas');
select is((select count(*)::int from public.agent_skills where agent_id = :'reception_b' and organization_id = :org_b), 7,
  'con la organización de su agente');

insert into public.organizations (id, name) values ('f0000000-0000-4000-8000-000000000000', 'Nueva');
select is(
  (select count(*)::int from public.agent_skills g join public.agents a on a.id = g.agent_id
   join public.agent_types t on t.id = a.agent_type_id
   where a.organization_id = 'f0000000-0000-4000-8000-000000000000' and t.key = 'reception'),
  7, 'una organización nueva nace con su Recepción equipada');

-- Como en el seed y el worker: la plataforma crea la organización por la API.
set local role service_role;
insert into public.organizations (id, name) values ('f1000000-0000-4000-8000-000000000000', 'Por la API');
reset role;
select is(
  (select count(*)::int from public.agent_skills where organization_id = 'f1000000-0000-4000-8000-000000000000'),
  8, 'también cuando la crea la plataforma (service_role): Recepción siete y Atención al cliente una');

delete from public.agent_skills where agent_id = :'reception_a';
select is(private.attach_default_skills_to(:'reception_a'), 7, 'poner al día un agente que ya existía le da sus skills');
select is(private.attach_default_skills_to(:'reception_a'), 0, 'y repetirlo no duplica nada');

-- Una versión nueva en borrador no se da; la publicada más alta, sí; y una skill
-- de la organización con la misma clave no sustituye a la de la plataforma.
insert into public.skills (organization_id, key, version, kind, name, effect_class, default_autonomy, max_autonomy, status)
values (null, 'find_slots', 2, 'code', 'Find free slots', 'read', 'autonomous', 'autonomous', 'draft'),
       (null, 'list_my_appointments', 2, 'code', 'List', 'read', 'autonomous', 'autonomous', 'published');
insert into public.skills (organization_id, key, version, kind, name, definition, effect_class, default_autonomy, max_autonomy, status)
values (:org_a, 'reply', 9, 'composed', 'Our reply', '{}', 'external_message', 'draft', 'autonomous', 'published');
delete from public.agent_skills where agent_id = :'reception_a';
select is(private.attach_default_skills_to(:'reception_a'), 7, 'al equipar de nuevo, otra vez siete');
select set_eq(
  format($$select s.key, s.version, s.organization_id is null from public.agent_skills g join public.skills s on s.id = g.skill_id
           where g.agent_id = %L and s.key in ('find_slots', 'list_my_appointments', 'reply')$$, :'reception_a'),
  $$values ('find_slots', 1, true), ('list_my_appointments', 2, true), ('reply', 1, true)$$,
  'la versión publicada más alta, nunca un borrador, y siempre la de la plataforma');
select is((select count(*)::int from public.agent_skills where agent_id = :'reception_a' and organization_id <> :org_a), 0,
  'todas con la organización del agente');

select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level) values (%L, %L, %L, 'autonomous')$$,
    :'sales_a', :'find_slots', :org_a),
  '23514', null, 'una skill de citas no se le puede dar a otro tipo de agente');

-- ===========================================================================
-- 3. message.received
-- ===========================================================================
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-a1', 'reception', 'active') returning id as ca_a1 \gset
insert into public.channel_accounts (organization_id, channel, external_id, default_agent_type, status)
values (:org_a, 'webchat', 'web-a', 'reception', 'active') returning id as ca_shared \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'webchat', 'web-b1', 'reception', 'active') returning id as ca_b \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as c_bea \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a1', :'reception_a') returning id as conv_a1 \gset
insert into public.conversations (organization_id, contact_id, channel_account_id, agent_id)
values (:org_a, :'c_ana', :'ca_shared', :'reception_a') returning id as conv_shared \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'c_bea', :'ca_b', :'reception_b') returning id as conv_b \gset

delete from public.domain_events;

insert into public.messages (organization_id, conversation_id, direction, author, content)
values (:org_a, :'conv_a1', 'in', 'contact', '¿Tenéis hueco el lunes?') returning id as m_in \gset

select is((select count(*)::int from public.domain_events where type = 'message.received'), 1,
  'un mensaje de un cliente emite un message.received');
select is(
  (select row(organization_id, location_id)::text from public.domain_events where type = 'message.received'),
  row(:org_a::uuid, :loc_a1::uuid)::text,
  'con la organización del mensaje y el local de su conversación');
select is(
  (select payload from public.domain_events where type = 'message.received'),
  jsonb_build_object('conversation_id', :'conv_a1'::uuid, 'message_id', :'m_in'::uuid),
  'y solo ids en el payload: ni el texto del mensaje ni el tenant');
select is((select published_at from public.domain_events where type = 'message.received'), null::timestamptz,
  'pendiente de publicar: lo recoge el outbox');

delete from public.domain_events;
insert into public.messages (organization_id, conversation_id, direction, author, content, status)
values (:org_a, :'conv_a1', 'out', 'agent', 'Sí, a las 9:00.', 'sent');
insert into public.messages (organization_id, conversation_id, direction, author, content, status)
values (:org_a, :'conv_a1', 'out', 'system', 'Conversación asignada.', 'sent');
select is((select count(*)::int from public.domain_events), 0,
  'lo que escribe el agente o el sistema no emite nada (si no, el agente se respondería a sí mismo)');

insert into public.messages (organization_id, conversation_id, direction, author, content)
values (:org_a, :'conv_shared', 'in', 'contact', 'Una pregunta');
select is((select location_id from public.domain_events where type = 'message.received'), null::uuid,
  'en una conversación de toda la organización, el evento no es de ningún local');

delete from public.domain_events;
insert into public.messages (organization_id, conversation_id, direction, author, content)
values (:org_b, :'conv_b', 'in', 'contact', 'Hola desde B');
select is((select organization_id from public.domain_events where type = 'message.received'), :org_b::uuid,
  'el de otra organización es de esa organización');

insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
values (:org_b, :'conv_b', 'out', 'agent', 'Hola, Bea', 'sent', 'run-b:1:0:reply');
select is((select count(*)::int from public.messages where idempotency_key = 'run-b:1:0:reply'), 1,
  'el mensaje del agente guarda la ejecución que lo escribió');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, idempotency_key)
           values (%L, %L, 'in', 'contact', 'x', 'k')$$, :org_b, :'conv_b'),
  '23514', null, 'lo que escribe un cliente no lleva clave de ejecución');

-- ===========================================================================
-- 4. agent_turn_context
-- ===========================================================================
select is(
  (select public.agent_turn_context(:org_a, :'reception_a') -> 'agent' ->> 'type_key'), 'reception',
  'da el agente de su organización, con su tipo');
select is(
  (select jsonb_array_length(public.agent_turn_context(:org_a, :'reception_a') -> 'skills')), 7,
  'y sus skills');
update public.agent_skills g set autonomy_level = 'execute', enabled = false
from public.skills s where s.id = g.skill_id and g.agent_id = :'reception_a' and s.key = 'book_appointment';
select is(
  (select s from jsonb_array_elements(public.agent_turn_context(:org_a, :'reception_a') -> 'skills') s
   where s ->> 'key' = 'book_appointment'),
  '{"key": "book_appointment", "kind": "code", "enabled": false, "version": 1, "effect_class": "internal_write", "autonomy_level": "execute"}'::jsonb,
  'cada una con su versión, su clase y lo que este agente tiene configurado (activa o no, y su autonomía)');
select is(public.agent_turn_context(:org_b, :'reception_a'), null::jsonb,
  'el agente de otra organización no existe para esta');
select ok(not has_function_privilege('authenticated', 'public.agent_turn_context(uuid, uuid)', 'execute'),
  'la app no la ejecuta');
select ok(has_function_privilege('service_role', 'public.agent_turn_context(uuid, uuid)', 'execute'),
  'la plataforma sí');

-- ===========================================================================
-- 5. Nadie llama a las funciones ni lee la tabla de serie
-- ===========================================================================
select ok(not has_function_privilege('authenticated', 'private.emit_message_received()', 'execute'),
  'la app no puede emitir eventos por su cuenta');
select ok(not has_function_privilege('service_role', 'private.emit_message_received()', 'execute'),
  'ni la plataforma fuera del trigger');
select ok(not has_function_privilege('authenticated', 'private.attach_default_skills_to(uuid)', 'execute'),
  'la app no puede equipar agentes');
select ok(not has_function_privilege('service_role', 'private.attach_default_skills_to(uuid)', 'execute'),
  'ni la plataforma fuera del trigger');
select ok(not has_function_privilege('service_role', 'private.attach_default_skills()', 'execute'),
  'ni llamar al trigger como función');
select ok(not has_table_privilege('authenticated', 'private.default_agent_skills', 'select'),
  'ni leer qué trae cada tipo');
select ok(not has_table_privilege('service_role', 'private.default_agent_skills', 'insert'),
  'ni la plataforma cambiarlo fuera de una migración');
select ok(not has_table_privilege('authenticated', 'public.agent_skills', 'insert'),
  'la app sigue sin escribir en agent_skills');

select * from finish();
rollback;
