-- PL-T1, paso 3c-1 (20261112063000): moodly_worker crea y cierra runs y anota
-- consumo, solo de su organización, solo las columnas que necesita y solo las
-- transiciones de su turno; no borra; las validaciones de siempre actúan
-- también para él; service_role queda igual.
begin;
\ir _fixtures/tenants.psql
select plan(20);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset

-- Privilegios, exactos.
select is(
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'UPDATE'),
  'agent_runs.cost_eur, agent_runs.model, agent_runs.status, agent_runs.tokens_in, agent_runs.tokens_out',
  'solo actualiza el estado, el modelo, los tokens y el coste de un run');
select ok(not has_column_privilege('moodly_worker', 'public.agent_runs', 'requested_by', 'INSERT')
          and not has_column_privilege('moodly_worker', 'public.agent_runs', 'config_snapshot_id', 'INSERT')
          and has_column_privilege('moodly_worker', 'public.agent_runs', 'trigger_ref', 'INSERT'),
  'crea runs sin quién los pidió ni snapshot');
select ok(not has_table_privilege('moodly_worker', 'public.agent_runs', 'delete')
          and not has_table_privilege('moodly_worker', 'public.agent_runs', 'truncate')
          and not has_table_privilege('moodly_worker', 'public.usage_records', 'update')
          and not has_table_privilege('moodly_worker', 'public.usage_records', 'delete'),
  'no borra runs ni cambia ni borra consumo');
select ok(not (select prosecdef from pg_proc where oid = 'private.guard_worker_agent_run()'::regprocedure),
  'la guarda es invoker');

-- Como moodly_worker, con A fijada (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok(
  format($$insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, status)
           values ('a7000000-0000-4000-8000-000000000001', %L, %L, %L, 'inbound_message', 'running')$$, :org_a, :loc_a1, :'agent_a'),
  'crea un run en marcha de su organización');
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, status)
           values (%L, %L, 'inbound_message', 'completed')$$, :org_a, :'agent_a'),
  '42501', null, 'no crea un run ya cerrado');
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, status)
           values (%L, %L, 'inbound_message', 'running')$$, :org_b, :'agent_b'),
  '42501', null, 'ni un run de otra organización (RLS, WITH CHECK)');
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, status)
           values (%L, %L, 'inbound_message', 'running')$$, :org_a, :'agent_b'),
  '23514', null, 'ni con el agente de otra organización (validate_agent_run actúa para él)');
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, status, requested_by)
           values (%L, %L, 'staff_instruction', 'running', %L)$$, :org_a, :'agent_a', :a_admin),
  '42501', null, 'ni diciendo quién lo pidió (columna sin privilegio)');

select lives_ok(
  $$update public.agent_runs set status = 'completed', model = 'fake/x', tokens_in = 10, tokens_out = 2, cost_eur = 0.01
    where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'cierra su run y apunta modelo, tokens y coste');
select lives_ok(
  $$update public.agent_runs set tokens_in = 20, cost_eur = 0.02 where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'y puede apuntar el coste del resumen con el run ya cerrado');
select throws_ok(
  $$update public.agent_runs set status = 'running' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'pero no lo reabre');
select throws_ok(
  $$update public.agent_runs set trigger = 'staff_instruction' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni cambia su origen (columna sin privilegio)');
select throws_ok(
  $$delete from public.agent_runs where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni lo borra');

select lives_ok(
  format($$insert into public.usage_records (organization_id, run_id, agent_id, source, metric, quantity, tokens_in, tokens_out,
                                            cost_eur, provider, via, region, model, call_index)
           values (%L, 'a7000000-0000-4000-8000-000000000001', %L, 'agent_turn', 'llm_tokens', 12, 10, 2, 0.01,
                   'anthropic', 'gateway', 'eu', 'fake/x', 0)$$, :org_a, :'agent_a'),
  'anota el consumo de su run');
select throws_ok(
  format($$insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model)
           values (%L, 'agent_turn', 'llm_tokens', 0, 0, 0, 0, 'anthropic', 'gateway', 'eu', 'x')$$, :org_b),
  '42501', null, 'no anota consumo de otra organización');
select throws_ok(
  format($$insert into public.usage_records (organization_id, agent_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model)
           values (%L, %L, 'agent_turn', 'llm_tokens', 0, 0, 0, 0, 'anthropic', 'gateway', 'eu', 'x')$$, :org_a, :'agent_b'),
  '23514', null, 'ni con el agente de otra (validate_usage_record actúa para él)');
select throws_ok(
  $$update public.usage_records set cost_eur = 0 where run_id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni cambia lo anotado');
reset role;

-- service_role, igual que antes: la guarda del worker no actúa para él.
set local role service_role;
select lives_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, status) values (%L, %L, 'staff_instruction', 'completed')$$, :org_a, :'agent_a'),
  'service_role sigue pudiendo crear un run cerrado');
select lives_ok(
  $$update public.agent_runs set status = 'running' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'y reabrirlo');
reset role;

select * from finish();
rollback;
