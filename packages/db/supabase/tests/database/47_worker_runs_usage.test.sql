-- PL-T1, paso 3c-1 (20261112130000): moodly_worker crea y cierra runs y anota
-- consumo, solo de su organización, solo las columnas que necesita y solo las
-- transiciones de su turno; no borra; las validaciones de siempre actúan
-- también para él; service_role queda igual. guard_worker_agent_run, por
-- estado: en marcha, se cierra; en espera, solo a completed y sin tocar nada
-- más; cerrado, estado y modelo fijos y tokens y coste solo suben.
begin;
\ir _fixtures/tenants.psql
select plan(34);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset

-- Privilegios, exactos.
select is(
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'UPDATE' and table_name = 'agent_runs'),
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

-- Run cerrado: estado y modelo fijos; tokens y coste solo suben.
select throws_ok(
  $$update public.agent_runs set cost_eur = 0.015 where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'cerrado: no baja el coste');
select throws_ok(
  $$update public.agent_runs set tokens_out = 1 where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'cerrado: ni los tokens');
select throws_ok(
  $$update public.agent_runs set model = 'fake/otro' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'cerrado: ni cambia el modelo');
select throws_ok(
  $$update public.agent_runs set status = 'failed' where id = 'a7000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'cerrado: ni pasa a otro estado de cierre');
-- La sentencia de bookSummaryUsage (summary.ts): el total del turno más el del resumen.
select lives_ok(
  $$update public.agent_runs
    set tokens_in = greatest(tokens_in, 130), tokens_out = greatest(tokens_out, 24), cost_eur = greatest(cost_eur, 0.031)
    where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'cerrado: bookSummaryUsage sube los tokens y el coste del resumen');
-- La de finishRun (converse.ts) repetida con el run ya cerrado: no pisa nada ni baja nada.
select lives_ok(
  $$update public.agent_runs
    set status = case when status = 'running' then 'failed' else status end,
        model = case when status = 'running' then 'fake/otro' else model end,
        tokens_in = case when status = 'running' then 10 else greatest(tokens_in, 10) end,
        tokens_out = case when status = 'running' then 2 else greatest(tokens_out, 2) end,
        cost_eur = case when status = 'running' then 0.01 else greatest(cost_eur, 0.01) end
    where id = 'a7000000-0000-4000-8000-000000000001'$$,
  'cerrado: finishRun repetido no falla');
select results_eq(
  $$select status, model, tokens_in, tokens_out, cost_eur from public.agent_runs where id = 'a7000000-0000-4000-8000-000000000001'$$,
  $$values ('completed'::text, 'fake/x'::text, 130::bigint, 24::bigint, 0.031::numeric(12, 6))$$,
  'y el run queda cerrado, con su modelo y con lo que costó el resumen');

-- Run en espera: solo pasa a completed, y ese cambio no toca nada más.
select lives_ok(
  format($$insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, status)
           values ('a7000000-0000-4000-8000-000000000002', %L, %L, %L, 'inbound_message', 'running');
           update public.agent_runs set status = 'awaiting_approval', model = 'fake/x', tokens_in = 5, tokens_out = 1, cost_eur = 0.005
           where id = 'a7000000-0000-4000-8000-000000000002'$$, :org_a, :loc_a1, :'agent_a'),
  'un run en marcha queda esperando una aprobación');
select throws_ok(
  $$update public.agent_runs set status = 'failed' where id = 'a7000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'en espera: no pasa a failed');
select throws_ok(
  $$update public.agent_runs set status = 'handed_off' where id = 'a7000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'en espera: ni a handed_off');
select throws_ok(
  $$update public.agent_runs set status = 'completed', cost_eur = 0.006 where id = 'a7000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'en espera: al completarlo no cambia nada más que el estado');
select throws_ok(
  $$update public.agent_runs set model = 'fake/otro' where id = 'a7000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'en espera: no cambia el modelo');
select lives_ok(
  $$update public.agent_runs set tokens_in = greatest(tokens_in, 9), cost_eur = greatest(cost_eur, 0.009)
    where id = 'a7000000-0000-4000-8000-000000000002'$$,
  'en espera: el coste del resumen sí sube (el resumen va después de que el turno deje el run esperando)');
select lives_ok(
  $$update public.agent_runs set status = 'completed' where id = 'a7000000-0000-4000-8000-000000000002' and status = 'awaiting_approval'$$,
  'en espera: pasa a completed, solo el estado (settleRun, approvals.ts)');
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
