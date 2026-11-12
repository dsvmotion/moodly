-- El libro de consumo (20261112041000, PL-ledger): una fila por llamada a un
-- modelo, particionada por mes, que solo anota la plataforma y nunca cambia;
-- la ve el org_admin de su organización (y el equipo interno con permiso), con
-- su resumen por día; usage_spend suma el gasto del día y del mes para el
-- enrutador; y el tope del mes lo gestiona el org_admin con aal2.
begin;
\ir _fixtures/tenants.psql
select plan(39);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('f5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message'),
       ('f5000000-0000-4000-8000-000000000002', :org_b, :loc_b1, :'agent_b', 'inbound_message');

-- ===========================================================================
-- 1. La tabla: particionada por mes, con las particiones fuera de la API
-- ===========================================================================
select is((select relkind::text from pg_class where oid = 'public.usage_records'::regclass), 'p', 'usage_records está particionada');
select is(
  (select count(*)::int from pg_inherits i join pg_class c on c.oid = i.inhrelid
   where i.inhparent = 'public.usage_records'::regclass and c.relnamespace <> 'private'::regnamespace),
  0, 'todas sus particiones viven en private');
select ok(
  (select count(*) >= 14 from pg_inherits where inhparent = 'public.usage_records'::regclass),
  'hay una partición por mes de 2026-11 a 2027-12 (y la por defecto)');
select is(
  (select array_agg(distinct r order by r) from pg_inherits i, unnest(array['anon', 'authenticated', 'service_role']) as r
   where i.inhparent = 'public.usage_records'::regclass and has_table_privilege(r, i.inhrelid, 'select')),
  null, 'ningún rol de la app toca una partición directamente');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.usage_records'::regclass), 'con RLS forzada');
select is(
  (select array_agg(p order by p) from unnest(array['select', 'insert', 'update', 'delete']) as p
   where has_table_privilege('service_role', 'public.usage_records', p)),
  array['insert', 'select'], 'la plataforma anota y lee; nunca cambia ni borra');
select is(
  (select array_agg(p order by p) from unnest(array['select', 'insert', 'update', 'delete']) as p
   where has_table_privilege('authenticated', 'public.usage_records', p)),
  array['select'], 'la app solo lee (con RLS)');
select ok(not has_table_privilege('anon', 'public.usage_records', 'select'), 'anon, nada');

-- ===========================================================================
-- 2. Anotar (como el worker, con service_role)
-- ===========================================================================
set local role service_role;
select lives_ok(format($$
  insert into public.usage_records (organization_id, location_id, run_id, agent_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model, model_key, call_index, occurred_at)
  values (%L, %L, 'f5000000-0000-4000-8000-000000000001', %L, 'agent_turn', 'llm_tokens', 1500, 1200, 300, 0.012, 'anthropic', 'gateway', 'other', 'anthropic/claude-opus-5.5', 'smart', 0, now()),
         (%L, %L, 'f5000000-0000-4000-8000-000000000001', %L, 'agent_turn', 'llm_tokens', 600, 500, 100, 0.004, 'anthropic', 'gateway', 'other', 'anthropic/claude-opus-5.5', 'smart', 1, now()),
         (%L, null, null, null, 'embedding', 'embedding_tokens', 800, 800, 0, 0.000016, 'openai', 'gateway', 'other', 'openai/text-embedding-3-small', 'embedding', null, now())$$,
  :org_a, :loc_a1, :'agent_a', :org_a, :loc_a1, :'agent_a', :org_a),
  'la plataforma anota las llamadas de un turno y una indexación');
select lives_ok(format($$
  insert into public.usage_records (organization_id, location_id, run_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model, call_index, occurred_at)
  values (%L, %L, 'f5000000-0000-4000-8000-000000000002', 'agent_turn', 'llm_tokens', 10, 5, 5, 0.5, 'anthropic', 'gateway', 'other', 'anthropic/claude-haiku-5.5', 0, now())$$,
  :org_b, :loc_b1),
  'y una de B');
-- Una del mes pasado: cuenta en el resumen, no en el gasto del mes.
select lives_ok(format($$
  insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model, occurred_at)
  values (%L, 'agent_turn', 'llm_tokens', 2, 1, 1, 7, 'anthropic', 'gateway', 'other', 'anthropic/claude-haiku-5.5', date_trunc('month', now()) - interval '1 day')$$, :org_a),
  'y una del mes pasado');
select throws_ok(format($$
  insert into public.usage_records (organization_id, run_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model, call_index, occurred_at)
  values (%L, 'f5000000-0000-4000-8000-000000000001', 'agent_turn', 'llm_tokens', 1500, 1200, 300, 0.012, 'anthropic', 'gateway', 'other', 'x', 0,
          (select occurred_at from public.usage_records where run_id = 'f5000000-0000-4000-8000-000000000001' and call_index = 0))$$, :org_a),
  '23505', null, 'la misma llamada del mismo run no se anota dos veces');
select throws_ok(format($$
  insert into public.usage_records (organization_id, location_id, source, metric, quantity, cost_eur, provider, via, region, model)
  values (%L, %L, 'agent_turn', 'llm_tokens', 0, 0, 'anthropic', 'gateway', 'other', 'x')$$, :org_a, :loc_b1),
  '23514', null, 'un local de otra organización no entra');
select throws_ok(format($$
  insert into public.usage_records (organization_id, run_id, source, metric, quantity, cost_eur, provider, via, region, model)
  values (%L, 'f5000000-0000-4000-8000-000000000002', 'agent_turn', 'llm_tokens', 0, 0, 'anthropic', 'gateway', 'other', 'x')$$, :org_a),
  '23514', null, 'ni un run de otra organización');
select throws_ok(format($$
  insert into public.usage_records (organization_id, agent_id, source, metric, quantity, cost_eur, provider, via, region, model)
  values (%L, %L, 'agent_turn', 'llm_tokens', 0, 0, 'anthropic', 'gateway', 'other', 'x')$$, :org_a, :'agent_b'),
  '23514', null, 'ni un agente de otra organización');
select throws_ok(format($$
  insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model)
  values (%L, 'agent_turn', 'llm_tokens', 99, 1, 1, 0, 'anthropic', 'gateway', 'other', 'x')$$, :org_a),
  '23514', null, 'la cantidad es la suma de los tokens');
select throws_ok(format($$update public.usage_records set cost_eur = 0 where organization_id = %L$$, :org_a),
  '42501', null, 'lo anotado no se cambia');
select throws_ok(format($$delete from public.usage_records where organization_id = %L$$, :org_a),
  '42501', null, 'ni se borra');
select is(
  public.usage_spend(:org_a, date_trunc('day', now()), date_trunc('month', now())),
  jsonb_build_object('day_eur', 0.016016, 'month_eur', 0.016016),
  'usage_spend: el gasto del día y del mes de A (ni lo de B ni lo del mes pasado, que tampoco es de hoy)');
reset role;

select is(
  (select c.relname::text from public.usage_records r join pg_class c on c.oid = r.tableoid where r.call_index = 0 and r.organization_id = :org_a),
  'usage_records_' || to_char(now(), 'YYYYMM'), 'cada fila cae en la partición de su mes');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'public.usage_spend(uuid, timestamptz, timestamptz)', 'execute')),
  array['service_role'], 'usage_spend: solo la plataforma');

-- ===========================================================================
-- 3. Quién lo ve
-- ===========================================================================
select pg_temp.login(:a_admin) as s \gset
select is((select count(*)::int from public.usage_records), 4, 'el org_admin de A ve todo el consumo de A');
select is((select count(*)::int from public.usage_records where organization_id <> :org_a), 0, 'y nada de B');
select is(
  (select sum(cost_eur) from public.usage_summary where day = (now() at time zone 'UTC')::date and source = 'agent_turn'),
  0.016000::numeric, 'usage_summary: lo de hoy, sumado');
select throws_ok(format($$
  insert into public.usage_records (organization_id, source, metric, quantity, cost_eur, provider, via, region, model)
  values (%L, 'agent_turn', 'llm_tokens', 0, 0, 'anthropic', 'gateway', 'other', 'x')$$, :org_a),
  '42501', null, 'una persona no anota consumo');
reset role;
select pg_temp.login(:a_loc1_mgr) as s \gset
select is((select count(*)::int from public.usage_records), 0, 'quien dirige un local no lo ve (es de la organización)');
select is((select count(*)::int from public.usage_summary), 0, 'tampoco el resumen');
reset role;
select pg_temp.login(:a_staff1) as s \gset
select is((select count(*)::int from public.usage_records), 0, 'el staff tampoco');
reset role;
select pg_temp.login(:b_admin) as s \gset
select is((select array_agg(distinct organization_id::text) from public.usage_records), array[:org_b::text], 'el org_admin de B solo lo de B');
reset role;
select pg_temp.login(:outsider) as s \gset
select is((select count(*)::int from public.usage_records), 0, 'alguien sin organización, nada');
reset role;

-- ===========================================================================
-- 4. El tope del mes
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select lives_ok(
  format($$insert into public.org_model_settings (organization_id, budget_per_month_eur) values (%L, 150)$$, :org_a),
  'el org_admin con aal2 pone el tope del mes');
select throws_ok(
  format($$update public.org_model_settings set budget_per_month_eur = 10 where organization_id = %L$$, :org_a),
  '23514', null, 'el tope del mes no puede ser menor que el del día');
select lives_ok(
  format($$update public.org_model_settings set budget_per_month_eur = 400 where organization_id = %L$$, :org_a),
  'y lo cambia');
reset role;
select is(
  (select metadata -> 'changed' from public.audit_logs where action = 'model_settings.update' and organization_id = :org_a order by at desc, id desc limit 1),
  '{"budget_per_month_eur": 400.0000}'::jsonb, 'el cambio queda en audit_logs');

-- ===========================================================================
-- 5. La migración con organizaciones que ya tenían un tope del día alto
-- ===========================================================================
select is(private.default_month_budget(5), 300::numeric, 'con un tope del día bajo, el del mes es 300 €');
select is(private.default_month_budget(500), 15500::numeric, 'con 500 €/día, 31 días: 15.500 €');
-- Como estaba antes de la migración: una política de B con 500 €/día (y el
-- tope del mes recién añadido con su valor por defecto, sin la comprobación).
alter table public.org_model_settings drop constraint org_model_settings_budget_month_order;
insert into public.org_model_settings (organization_id, budget_per_run_eur, budget_per_day_eur, budget_per_month_eur)
values (:org_b, 1, 500, 300);
select lives_ok($$
  update public.org_model_settings
    set budget_per_month_eur = private.default_month_budget(budget_per_day_eur)
    where budget_per_month_eur < private.default_month_budget(budget_per_day_eur);
  alter table public.org_model_settings
    add constraint org_model_settings_budget_month_order check (budget_per_day_eur <= budget_per_month_eur);
$$, 'los pasos de la migración no fallan con una organización de 500 €/día');
select is((select budget_per_month_eur from public.org_model_settings where organization_id = :org_b), 15500.0000::numeric,
  'y su tope del mes pasa a 31 días del de su día');
select is(
  (select metadata -> 'changed' from public.audit_logs where action = 'model_settings.update' and organization_id = :org_b and actor_type = 'system' order by at desc, id desc limit 1),
  '{"budget_per_month_eur": 15500.0000}'::jsonb, 'el cambio de la plataforma queda en audit_logs');

select * from finish();
rollback;
