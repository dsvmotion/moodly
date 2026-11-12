-- PL-T1, paso 3 (20261112120000): moodly_worker lee el libro de consumo solo
-- de la organización de su transacción, y no escribe en él.
begin;
\ir _fixtures/tenants.psql
select plan(7);

-- Consumo de A y de B (como la plataforma).
insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model, occurred_at)
values
  (:org_a, 'agent_turn', 'llm_tokens', 10, 8, 2, 1.25, 'anthropic', 'gateway', 'eu', 'fake/a', now()),
  (:org_a, 'agent_turn', 'llm_tokens', 10, 8, 2, 0.75, 'anthropic', 'gateway', 'eu', 'fake/a', now() - interval '40 days'),
  (:org_b, 'agent_turn', 'llm_tokens', 10, 8, 2, 9.00, 'anthropic', 'gateway', 'eu', 'fake/b', now());

select is(
  (select cmd || ' | ' || qual from pg_policies
   where schemaname = 'public' and tablename = 'usage_records' and roles = array['moodly_worker']::name[]),
  'SELECT | (organization_id = ( SELECT private.worker_organization_id() AS worker_organization_id))',
  'la política del worker es solo de lectura y por la organización de la transacción');
select ok(has_table_privilege('moodly_worker', 'public.usage_records', 'select')
          and not has_table_privilege('moodly_worker', 'public.usage_records', 'insert')
          and not has_table_privilege('moodly_worker', 'public.usage_records', 'update')
          and not has_table_privilege('moodly_worker', 'public.usage_records', 'delete'),
  'el worker lee el libro de consumo y no lo escribe');

-- Como moodly_worker (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;

select is((select count(*)::int from public.usage_records), 0, 'sin organización en la transacción, no ve nada');

select set_config('moodly.organization_id', :org_a, true) as _org \gset
select is((select array_agg(distinct organization_id) from public.usage_records), array[:org_a::uuid],
  'con A fijada, solo el consumo de A');
select is((select sum(cost_eur) from public.usage_records where occurred_at >= now() - interval '1 day'), 1.25::numeric,
  'y el gasto del día es el de A, sin el de B');
select throws_ok(
  format($$insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model)
           values (%L, 'agent_turn', 'llm_tokens', 0, 0, 0, 0, 'anthropic', 'gateway', 'eu', 'x')$$, :org_a),
  '42501', null, 'no puede anotar consumo');

select set_config('moodly.organization_id', :org_b, true) as _org \gset
select is((select sum(cost_eur) from public.usage_records), 9.00::numeric, 'con B fijada, el de B');
reset role;

select * from finish();
rollback;
