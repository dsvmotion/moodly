-- PL-T1, paso 3c-3 (20261112150000): moodly_worker guarda el resumen continuo
-- de las conversaciones de su organización, solo las columnas que necesita; no
-- lo borra ni lo cambia de conversación u organización; nunca cuelga de una
-- conversación de otra organización; service_role queda igual. (El paso a una
-- persona, conversations.mode, está en 48_worker_executions_messages.)
begin;
\ir _fixtures/tenants.psql
select plan(17);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as c_bea \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'w49-a1', 'customer', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'webchat', 'w49-b1', 'customer', 'active') returning id as ca_b \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a') returning id as conv_a \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a') returning id as conv_a2 \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'c_bea', :'ca_b', :'agent_b') returning id as conv_b \gset
insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until, model)
values (:'conv_b', :org_b, 'Resumen de B', now(), 'fake/fast');

-- Privilegios, exactos.
select is(
  (select string_agg(privilege_type || ' ' || column_name, ', ' order by privilege_type, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'conversation_summaries' and privilege_type in ('INSERT', 'UPDATE')),
  'INSERT conversation_id, INSERT covered_until, INSERT model, INSERT organization_id, INSERT summary, '
    || 'UPDATE covered_until, UPDATE model, UPDATE summary',
  'crea un resumen y pone al día su texto, hasta dónde cubre y el modelo; nada más');
select ok(not has_table_privilege('moodly_worker', 'public.conversation_summaries', 'delete')
          and not has_table_privilege('moodly_worker', 'public.conversation_summaries', 'truncate'),
  'no borra resúmenes');

-- Como moodly_worker, con A fijada (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok(
  format($$insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until, model)
           values (%L, %L, 'Ana quiere láser', now(), 'fake/fast')$$, :'conv_a', :org_a),
  'guarda el resumen de una conversación de su organización');
select lives_ok(
  format($$insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until, model)
           values (%L, %L, 'Otro', now(), 'fake/fast') on conflict do nothing$$, :'conv_a', :org_a),
  'si ya lo había (otro turno), on conflict no hace nada');
select lives_ok(
  format($$update public.conversation_summaries set summary = 'Ana quiere láser el lunes', covered_until = now(), model = 'fake/fast2'
           where conversation_id = %L$$, :'conv_a'),
  'y lo pone al día');
select results_eq(
  format($$select summary, model from public.conversation_summaries where conversation_id = %L$$, :'conv_a'),
  $$values ('Ana quiere láser el lunes'::text, 'fake/fast2'::text)$$,
  'con el texto y el modelo nuevos');
-- La sentencia de saveSummary (summary.ts) con un resumen que cubre hasta antes
-- (un turno viejo que termina tarde): no pisa al nuevo.
select lives_ok(
  format($$update public.conversation_summaries set summary = 'Viejo', covered_until = now() - interval '1 hour', model = 'fake/viejo'
           where conversation_id = %L and covered_until <= now() - interval '1 hour'$$, :'conv_a'),
  'un resumen viejo que llega tarde no falla');
select results_eq(
  format($$select summary, model from public.conversation_summaries where conversation_id = %L$$, :'conv_a'),
  $$values ('Ana quiere láser el lunes'::text, 'fake/fast2'::text)$$,
  'pero no pisa al nuevo');
select throws_ok(
  format($$insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until)
           values (%L, %L, 'x', now())$$, :'conv_b', :org_b),
  '42501', null, 'no guarda el resumen de una conversación de otra organización (RLS, WITH CHECK)');
select throws_ok(
  format($$insert into public.conversation_summaries (conversation_id, organization_id, summary, covered_until)
           values (%L, %L, 'x', now())$$, :'conv_b', :org_a),
  '23503', null, 'ni lo cuelga, con su organización, de una conversación de otra (clave ajena compuesta)');
select is(
  (select count(*)::int from public.conversation_summaries where conversation_id = :'conv_b'),
  0, 'y el de B no lo ve');
select lives_ok(
  format($$update public.conversation_summaries set summary = 'pisado' where conversation_id = %L$$, :'conv_b'),
  'cambiar el de B no falla, pero no toca nada (RLS: para él no existe; se comprueba abajo)');
select throws_ok(
  format($$update public.conversation_summaries set conversation_id = %L where conversation_id = %L$$, :'conv_a2', :'conv_a'),
  '42501', null, 'no cambia un resumen de conversación (columna sin privilegio)');
select throws_ok(
  format($$update public.conversation_summaries set organization_id = %L where conversation_id = %L$$, :org_b, :'conv_a'),
  '42501', null, 'ni de organización');
select throws_ok(
  format($$delete from public.conversation_summaries where conversation_id = %L$$, :'conv_a'),
  '42501', null, 'ni lo borra');
reset role;
select is((select summary from public.conversation_summaries where conversation_id = :'conv_b'), 'Resumen de B',
  'el resumen de B sigue igual');

-- service_role, igual que antes.
set local role service_role;
select lives_ok(
  format($$update public.conversation_summaries set summary = 'De la plataforma' where conversation_id = %L$$, :'conv_b'),
  'service_role sigue guardando resúmenes de cualquier organización');
reset role;

select * from finish();
rollback;
