-- Solicitudes de conocimiento (20261110100000, paso B20-4a): las escribe la
-- plataforma; las ve quien ve su alcance; las contesta o descarta, una vez,
-- quien tiene el rol que piden en su local (el org_admin con aal2). Contestar
-- guarda la respuesta como conocimiento human_answer de ese alcance, la manda
-- al cliente en su conversación y deja la auditoría.
begin;
\ir _fixtures/tenants.psql
select plan(48);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_a2 from public.agents where organization_id = :org_a order by id offset 1 limit 1 \gset

-- Datos (la plataforma, como el worker).
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'kr-web-a1', 'customer', 'active') returning id as ca_web \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', 'kr-wa-a1', 'customer', 'active') returning id as ca_wa \gset
insert into public.channel_accounts (organization_id, channel, external_id, default_agent_type, status)
values (:org_a, 'webchat', 'kr-web-a', 'customer', 'active') returning id as ca_org \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_web', :'agent_a') returning id as conv_web \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_wa', :'agent_a') returning id as conv_wa \gset
insert into public.conversations (organization_id, contact_id, channel_account_id, agent_id)
values (:org_a, :'c_ana', :'ca_org', :'agent_a') returning id as conv_org \gset
insert into public.agent_runs (organization_id, location_id, agent_id, trigger)
values (:org_a, :loc_a1, :'agent_a', 'inbound_message') returning id as run_a1 \gset

create temp view source_events as
  select * from public.domain_events where organization_id = :org_a and type = 'knowledge_source.pending';

-- ===========================================================================
-- 1. Funciones
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'private.answer_knowledge_request()'::regprocedure),
  'answer_knowledge_request es security definer (escribe la fuente, el mensaje y la auditoría)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.answer_knowledge_request()', 'execute')),
  null, 'nadie de la app puede ejecutarla');
select ok(not (select prosecdef from pg_proc where oid = 'private.guard_knowledge_request()'::regprocedure),
  'la guarda es invoker');

-- ===========================================================================
-- 2. La plataforma las crea, coherentes con su run y su conversación
-- ===========================================================================
set local role service_role;
insert into public.knowledge_requests (organization_id, location_id, agent_id, run_id, conversation_id, question, assigned_role, idempotency_key)
values (:org_a, :loc_a1, :'agent_a', :'run_a1', :'conv_web', '  ¿Tenéis aparcamiento?  ', 'staff', 'run-a1:0:0:ask_team')
returning id as r_web \gset
insert into public.knowledge_requests (organization_id, location_id, agent_id, conversation_id, question, assigned_role)
values (:org_a, :loc_a1, :'agent_a', :'conv_wa', '¿Hacéis tatuajes?', 'location_manager') returning id as r_wa \gset
insert into public.knowledge_requests (organization_id, location_id, agent_id, conversation_id, question, assigned_role)
values (:org_a, :loc_a1, :'agent_a', :'conv_web', '¿Abrís en agosto?', 'staff') returning id as r_dismiss \gset
insert into public.knowledge_requests (organization_id, agent_id, conversation_id, question, assigned_role)
values (:org_a, :'agent_a', :'conv_org', '¿Tenéis tarjeta regalo?', 'org_admin') returning id as r_org \gset
reset role;
select results_eq(
  format($$select status, question, answer, answered_by from public.knowledge_requests where id = %L$$, :'r_web'),
  $$values ('open'::text, '¿Tenéis aparcamiento?'::text, null::text, null::uuid)$$,
  'nace abierta, sin respuesta y con la pregunta sin espacios en los extremos');

set local role service_role;
select throws_ok(
  format($$insert into public.knowledge_requests (organization_id, location_id, agent_id, conversation_id, question, assigned_role)
           values (%L, %L, %L, %L, 'x', 'staff')$$, :org_a, :loc_a2, :'agent_a', :'conv_web'),
  '23514', null, 'la conversación es de su local');
select throws_ok(
  format($$insert into public.knowledge_requests (organization_id, location_id, agent_id, run_id, question, assigned_role)
           values (%L, %L, %L, %L, 'x', 'staff')$$, :org_a, :loc_a1, :'agent_a2', :'run_a1'),
  '23514', null, 'y el run, de su agente');
select throws_ok(
  format($$insert into public.knowledge_requests (organization_id, location_id, agent_id, question, assigned_role, status, answer)
           values (%L, %L, %L, 'x', 'staff', 'answered', 'y')$$, :org_a, :loc_a1, :'agent_a'),
  '23514', null, 'no nace contestada');
select throws_ok(
  format($$insert into public.knowledge_requests (organization_id, agent_id, question, assigned_role)
           values (%L, %L, 'x', 'staff')$$, :org_a, :'agent_a'),
  '23514', null, 'una de toda la organización va al org_admin');
select throws_ok(
  format($$insert into public.knowledge_requests (organization_id, location_id, agent_id, question, assigned_role, idempotency_key)
           values (%L, %L, %L, 'otra vez', 'staff', 'run-a1:0:0:ask_team')$$, :org_a, :loc_a1, :'agent_a'),
  '23505', null, 'una por ejecución: si el paso se repite, no se duplica');
select throws_ok(
  format($$update public.knowledge_requests set idempotency_key = 'otra' where id = %L$$, :'r_web'),
  '42501', null, 'la clave no cambia');
select throws_ok(
  format($$update public.knowledge_requests set question = 'otra' where id = %L$$, :'r_web'),
  '42501', null, 'la pregunta no cambia, ni para la plataforma');
select throws_ok(
  format($$update public.knowledge_requests set status = 'answered', answer = 'sí' where id = %L$$, :'r_web'),
  '42501', null, 'la plataforma no contesta: contesta una persona');
reset role;

-- ===========================================================================
-- 3. Quién las ve
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
select results_eq('select id from public.knowledge_requests order by question',
  format($$values (%L::uuid), (%L::uuid), (%L::uuid)$$, :'r_dismiss', :'r_wa', :'r_web'),
  'el equipo de A1 ve las de su local, no las de toda la organización');
reset role;
select pg_temp.login(:a_staff2) as s \gset
select is((select count(*)::int from public.knowledge_requests), 0, 'el equipo de A2, ninguna');
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
select is((select count(*)::int from public.knowledge_requests), 0, 'otra organización, ninguna');
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
select is((select count(*)::int from public.knowledge_requests), 4, 'el org_admin, todas');
reset role;

-- ===========================================================================
-- 4. Quién no las contesta
-- ===========================================================================
select pg_temp.login(:a_staff2) as s \gset
with u as (update public.knowledge_requests set status = 'answered', answer = 'Sí' where id = :'r_web' returning 1)
select is(count(*)::int, 0, 'el equipo de otro local no la contesta') from u;
reset role;
select pg_temp.login(:a_staff1) as s \gset
with u as (update public.knowledge_requests set status = 'answered', answer = 'No' where id = :'r_wa' returning 1)
select is(count(*)::int, 0, 'el equipo no contesta la que va a quien lleva el local') from u;
with u as (update public.knowledge_requests set status = 'answered', answer = 'Sí' where id = :'r_org' returning 1)
select is(count(*)::int, 0, 'ni la de toda la organización') from u;
reset role;
select pg_temp.login(:a_admin) as s \gset
with u as (update public.knowledge_requests set status = 'answered', answer = 'Sí' where id = :'r_org' returning 1)
select is(count(*)::int, 0, 'el org_admin sin aal2, tampoco') from u;
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.knowledge_requests set status = 'answered', answer = 'Sí' where id = :'r_web' returning 1)
select is(count(*)::int, 0, 'ni el org_admin de otra organización') from u;
reset role;

-- ===========================================================================
-- 5. Contestar: conocimiento, mensaje al cliente y auditoría
-- ===========================================================================
select count(*)::int as msgs_before from public.messages where conversation_id = :'conv_web' \gset
select pg_temp.login(:a_staff1) as s \gset
select throws_ok(
  format($$update public.knowledge_requests set status = 'answered' where id = %L$$, :'r_web'),
  '23514', null, 'contestar pide una respuesta');
select throws_ok(
  format($$update public.knowledge_requests set answered_by = %L where id = %L$$, :a_admin, :'r_web'),
  '42501', null, 'quién contesta no lo elige la app');
select throws_ok(
  format($$update public.knowledge_requests set status = 'answered', answer = 'Sí', resulting_source_id = %L where id = %L$$,
         gen_random_uuid(), :'r_web'),
  '42501', null, 'ni la fuente que resulta');
update public.knowledge_requests set status = 'answered', answer = '  Sí, gratis para clientes en el sótano.  '
where id = :'r_web' returning status || '/' || answered_by || '/' || answer as answered \gset
reset role;
select is(:'answered'::text, 'answered/' || :a_staff1 || '/Sí, gratis para clientes en el sótano.',
  'el equipo de A1 la contesta: la base de datos pone quién y la respuesta sin espacios en los extremos');

select resulting_source_id as src from public.knowledge_requests where id = :'r_web' \gset
select results_eq(
  format($$select organization_id, location_id, type, title, body, status, created_by from public.knowledge_sources where id = %L$$, :'src'),
  format($$values (%L::uuid, %L::uuid, 'human_answer'::text, '¿Tenéis aparcamiento?'::text,
                   'Sí, gratis para clientes en el sótano.'::text, 'pending'::text, %L::uuid)$$, :org_a, :loc_a1, :a_staff1),
  'la respuesta queda como conocimiento human_answer de su local, por indexar, con la pregunta como título');
select is((select count(*)::int from source_events where payload->>'source_id' = :'src'), 1,
  'y emite knowledge_source.pending: el worker la indexa');
select results_eq(
  format($$select direction, author, author_user_id, content, status from public.messages
           where conversation_id = %L order by created_at desc limit 1$$, :'conv_web'),
  format($$values ('out'::text, 'user'::text, %L::uuid, 'Sí, gratis para clientes en el sótano.'::text, 'sent'::text)$$, :a_staff1),
  'el cliente recibe la respuesta en su conversación, de la persona que contestó (chat web: enviada)');
select is((select count(*)::int from public.messages where conversation_id = :'conv_web'), :msgs_before + 1, 'un solo mensaje');
select results_eq(
  format($$select actor_type, actor_id, target->>'knowledge_source_id' from public.audit_logs
           where action = 'knowledge_request.answered' and target->>'knowledge_request_id' = %L$$, :'r_web'),
  format($$values ('user'::text, %L::uuid, %L::text)$$, :a_staff1, :'src'),
  'y queda en la auditoría');
select results_eq(
  format($$select metadata->'message_sent', metadata->>'channel' from public.audit_logs
           where action = 'knowledge_request.answered' and target->>'knowledge_request_id' = %L$$, :'r_web'),
  $$values ('true'::jsonb, 'webchat'::text)$$,
  'la auditoría dice que se mandó, por el chat web');

select pg_temp.login(:a_staff1) as s \gset
with u as (update public.knowledge_requests set answer = 'Otra' where id = :'r_web' returning 1)
select is(count(*)::int, 0, 'contestada, ya no cambia') from u;
reset role;
select throws_ok(
  format($$update public.knowledge_requests set status = 'dismissed', answer = null where id = %L$$, :'r_web'),
  '42501', null, 'ni para la plataforma');

-- Por WhatsApp (un canal que todavía no envía, M-01): se guarda el
-- conocimiento, pero no se inserta un mensaje que se quedaría pendiente para
-- siempre (20261112040800).
select count(*)::int as wa_msgs_before from public.messages where conversation_id = :'conv_wa' \gset
select pg_temp.login(:a_loc1_mgr) as s \gset
update public.knowledge_requests set status = 'answered', answer = 'No hacemos tatuajes.' where id = :'r_wa';
reset role;
select is((select count(*)::int from public.messages where conversation_id = :'conv_wa'), :wa_msgs_before,
  'quien lleva el local contesta la suya; por WhatsApp no se crea un mensaje que no saldría (ni pending ni sent)');
select results_eq(
  format($$select r.status, s.type, s.body from public.knowledge_requests r
           join public.knowledge_sources s on s.id = r.resulting_source_id where r.id = %L$$, :'r_wa'),
  $$values ('answered'::text, 'human_answer'::text, 'No hacemos tatuajes.'::text)$$,
  'la pregunta queda contestada y la respuesta, como conocimiento');
select results_eq(
  format($$select metadata->'message_sent', metadata->>'channel' from public.audit_logs
           where action = 'knowledge_request.answered' and target->>'knowledge_request_id' = %L$$, :'r_wa'),
  $$values ('false'::jsonb, 'whatsapp'::text)$$,
  'y la auditoría dice que no se mandó al cliente, y por qué canal');

-- La de toda la organización: el org_admin con aal2; el conocimiento, de toda la organización.
select pg_temp.login_mfa(:a_admin) as s \gset
update public.knowledge_requests set status = 'answered', answer = 'Sí, de 50 y 100 €.' where id = :'r_org';
reset role;
select results_eq(
  format($$select s.location_id, s.type from public.knowledge_requests r
           join public.knowledge_sources s on s.id = r.resulting_source_id where r.id = %L$$, :'r_org'),
  $$values (null::uuid, 'human_answer'::text)$$,
  'el org_admin con aal2 contesta la de toda la organización, y el conocimiento es de toda la organización');

-- ===========================================================================
-- 6. Descartar
-- ===========================================================================
select count(*)::int as sources_before from public.knowledge_sources where organization_id = :org_a \gset
select count(*)::int as msgs_before2 from public.messages where conversation_id = :'conv_web' \gset
select pg_temp.login(:a_staff1) as s \gset
select throws_ok(
  format($$update public.knowledge_requests set status = 'dismissed', answer = 'x' where id = %L$$, :'r_dismiss'),
  '23514', null, 'descartar no lleva respuesta');
update public.knowledge_requests set status = 'dismissed' where id = :'r_dismiss' returning answered_by as dismissed_by \gset
reset role;
select is(:'dismissed_by'::uuid, :a_staff1::uuid, 'el equipo la descarta y queda quién');
select is((select count(*)::int from public.knowledge_sources where organization_id = :org_a), :sources_before,
  'descartar no crea conocimiento');
select is((select count(*)::int from public.messages where conversation_id = :'conv_web'), :msgs_before2,
  'ni manda nada al cliente');
select pg_temp.login(:a_staff1) as s \gset
with u as (update public.knowledge_requests set status = 'answered', answer = 'Sí' where id = :'r_dismiss' returning 1)
select is(count(*)::int, 0, 'descartada, ya no se contesta') from u;
reset role;
select throws_ok(
  format($$update public.knowledge_requests set status = 'open' where id = %L$$, :'r_dismiss'),
  '42501', null, 'ni se reabre, ni por la plataforma');

-- ===========================================================================
-- 7. Borrar lo que cuelga de ella
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select lives_ok(format($$delete from public.knowledge_sources where id = %L$$, :'src'),
  'el org_admin puede borrar el conocimiento que salió de una respuesta');
reset role;
select results_eq(
  format($$select status, resulting_source_id, answer from public.knowledge_requests where id = %L$$, :'r_web'),
  $$values ('answered'::text, null::uuid, 'Sí, gratis para clientes en el sótano.'::text)$$,
  'la pregunta sigue contestada, sin fuente');
select lives_ok(format($$delete from public.conversations where id = %L$$, :'conv_wa'),
  'borrar la conversación no choca con la guarda');
select is((select conversation_id from public.knowledge_requests where id = :'r_wa'), null::uuid,
  'la pregunta se queda sin conversación');

-- Privilegios: la app solo escribe el estado y la respuesta.
select ok(has_column_privilege('authenticated', 'public.knowledge_requests', 'answer', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.knowledge_requests', 'answered_by', 'UPDATE')
          and not has_table_privilege('authenticated', 'public.knowledge_requests', 'INSERT')
          and not has_table_privilege('authenticated', 'public.knowledge_requests', 'DELETE'),
  'la app solo escribe el estado y la respuesta; no crea ni borra preguntas');

select * from finish();
rollback;
