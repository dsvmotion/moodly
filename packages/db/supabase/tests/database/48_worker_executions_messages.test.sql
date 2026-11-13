-- PL-T1, paso 3c-2 (20261112140000): moodly_worker guarda las ejecuciones del
-- turno y escribe la respuesta del agente, solo de su organización y solo lo que
-- necesita; no aprueba ni rechaza; solo escribe como el agente; las guardas de
-- siempre actúan también para él; service_role queda igual.
begin;
\ir _fixtures/tenants.psql
select plan(23);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('e8000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message');
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'w48-a1', 'customer', 'active') returning id as ca_web \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_ana', :'ca_web', :'agent_a', 'agent') returning id as conv_agent \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_ana', :'ca_web', :'agent_a', 'human') returning id as conv_human \gset

select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.agent_runs (id, organization_id, agent_id, trigger)
values ('e8000000-0000-4000-8000-0000000000b1', :org_b, :'agent_b', 'inbound_message');

create function pg_temp.new_execution(p_status text, p_key text, p_run uuid default 'e8000000-0000-4000-8000-000000000001') returns void language sql as $$
  insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                                 autonomy_applied, input, target, input_hash, status, idempotency_key)
  select r.id, r.organization_id, r.location_id, 'reply', 1, 'external_message',
         case when p_status = 'executed' then 'autonomous' else 'draft' end,
         '{}', '{"kind":"none"}', repeat('a', 64), p_status, p_key
  from public.agent_runs r where r.id = p_run;
$$;
create function pg_temp.new_message(p_conv uuid, p_author text, p_direction text, p_key text, p_org uuid default null) returns void language sql as $$
  insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
  select coalesce(p_org, c.organization_id), c.id, p_direction, p_author, 'Hola', case when p_direction = 'out' then 'sent' else 'received' end, p_key
  from public.conversations c where c.id = p_conv;
$$;

-- Privilegios, exactos.
select is(
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'UPDATE' and table_name in ('conversations', 'executions', 'messages')),
  'conversations.mode, executions.output, executions.status, messages.delivery_error, messages.status',
  'de una ejecución solo cambia el estado y la salida; de una conversación, el modo; de un mensaje, su estado de entrega (20261113110000)');
select ok(not has_table_privilege('moodly_worker', 'public.executions', 'delete')
          and not has_table_privilege('moodly_worker', 'public.messages', 'delete')
          and not has_table_privilege('moodly_worker', 'public.executions', 'truncate')
          and not has_table_privilege('moodly_worker', 'public.messages', 'truncate'),
  'no borra ejecuciones ni mensajes');
select ok(not (select prosecdef from pg_proc where oid = 'private.guard_worker_execution()'::regprocedure)
          and not (select prosecdef from pg_proc where oid = 'private.guard_worker_message()'::regprocedure),
  'las guardas del worker son invoker');

-- Como moodly_worker, con A fijada (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok($$select pg_temp.new_execution('executed', 'x48-1')$$, 'guarda una ejecución ejecutada de su run');
select lives_ok($$select pg_temp.new_execution('needs_approval', 'x48-2')$$, 'y una que espera a una persona');
-- Con valores explícitos: para él, el run de B no existe (pg_temp.new_execution lo
-- buscaría y no insertaría nada).
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, skill_key, skill_version, effect_class, autonomy_applied,
                                          input, target, input_hash, status, idempotency_key)
           values ('e8000000-0000-4000-8000-0000000000b1', %L, 'reply', 1, 'external_message', 'autonomous',
                   '{}', '{"kind":"none"}', repeat('a', 64), 'executed', 'x48-3')$$, :org_b),
  '42501', null, 'no guarda ejecuciones de otra organización, aunque sean de un run de ella (RLS, WITH CHECK)');
select throws_ok($$update public.executions set status = 'rejected' where idempotency_key = 'x48-2'$$, '42501', null,
  'no rechaza lo que espera a una persona (lo decide una persona; guard_worker_execution)');
select lives_ok($$update public.executions set status = 'failed', output = '{"held":"not_agent_mode"}' where idempotency_key = 'x48-2'$$,
  'pero lo retiene (falla sin enviarse) si la conversación ya la lleva una persona');
select throws_ok($$update public.executions set status = 'needs_approval' where idempotency_key = 'x48-2'$$, '42501', null,
  'una ejecución terminada no cambia (guard_execution_status actúa para él)');
select throws_ok($$update public.executions set skill_key = 'otra' where idempotency_key = 'x48-1'$$, '42501', null,
  'ni cambia la skill (columna sin privilegio)');
select throws_ok($$delete from public.executions where idempotency_key = 'x48-1'$$, '42501', null, 'ni la borra');

select lives_ok(format($$select pg_temp.new_message(%L, 'agent', 'out', 'm48-1')$$, :'conv_agent'),
  'escribe la respuesta del agente en una conversación que lleva el agente');
select throws_ok(format($$select pg_temp.new_message(%L, 'user', 'out', 'm48-2')$$, :'conv_agent'), '42501', null,
  'no escribe como una persona del equipo (guard_worker_message)');
select throws_ok(format($$select pg_temp.new_message(%L, 'contact', 'in', null)$$, :'conv_agent'), '42501', null,
  'ni como el cliente');
select throws_ok(format($$select pg_temp.new_message(%L, 'agent', 'out', 'm48-3')$$, :'conv_human'), '55000', null,
  'ni en una conversación que lleva una persona (guard_agent_message_mode actúa para él)');
-- Con la organización de B, lo para antes guard_agent_message_mode (trigger
-- BEFORE, antes que RLS): para él no existe esa conversación en B. La forma de
-- la política (WITH CHECK por la organización) la comprueba 00_rls_enabled.
select throws_ok(format($$select pg_temp.new_message(%L, 'agent', 'out', 'm48-4', %L)$$, :'conv_agent', :org_b), '55000', null,
  'ni con la organización de otra (para él, esa conversación no existe)');
select throws_ok($$update public.messages set content = 'otro' where idempotency_key = 'm48-1'$$, '42501', null,
  'no cambia un mensaje');

select throws_ok(format($$update public.conversations set mode = 'agent' where id = %L$$, :'conv_human'), '42501', null,
  'no devuelve al agente una conversación que lleva una persona (guard_worker_conversation)');
select lives_ok(format($$update public.conversations set mode = 'human' where id = %L$$, :'conv_agent'),
  'pasa a una persona una conversación que lleva el agente');
select throws_ok(format($$update public.conversations set mode = 'closed' where id = %L$$, :'conv_human'), '42501', null,
  'ni la cierra');
reset role;

-- service_role, igual que antes.
set local role service_role;
select lives_ok($$select pg_temp.new_execution('needs_approval', 'x48-9')$$, 'service_role guarda una ejecución');
select lives_ok($$update public.executions set status = 'rejected' where idempotency_key = 'x48-9'$$,
  'y la puede rechazar (la guarda del worker no actúa para él)');
select lives_ok(format($$update public.conversations set mode = 'agent' where id = %L$$, :'conv_human'),
  'y devolver una conversación al agente');
reset role;

select * from finish();
rollback;
