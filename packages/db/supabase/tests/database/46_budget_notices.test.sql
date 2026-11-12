-- Los avisos del tope mensual de IA (20261112090000, PL-ledger): al pasar el 80 %
-- y el 100 % de budget_per_month_eur, un evento usage.budget_threshold por
-- organización, mes y umbral, una sola vez; budget_notification da a quién se
-- avisa (solo los org_admin). Y cost_eur guarda ya las llamadas muy pequeñas.
begin;
\ir _fixtures/tenants.psql
select plan(32);

create function pg_temp.spend(p_org uuid, p_eur numeric) returns void language sql as $$
  insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model)
  values (p_org, 'agent_turn', 'llm_tokens', 2, 1, 1, p_eur, 'anthropic', 'gateway', 'other', 'anthropic/claude-haiku-5.5');
$$;
create function pg_temp.events(p_org uuid) returns jsonb[] language sql as $$
  select coalesce(array_agg(payload order by created_at, payload->>'threshold'), '{}')
  from public.domain_events where organization_id = p_org and type = 'usage.budget_threshold';
$$;
create function pg_temp.check(p_org uuid) returns smallint[] language plpgsql as $$
declare v smallint[];
begin
  set local role service_role;
  v := public.check_budget_thresholds(p_org);
  reset role;
  return v;
end;
$$;
create function pg_temp.recipients(p_org uuid, p_month date, p_threshold smallint) returns text[] language sql as $$
  select array_agg(r->>'email' order by r->>'email')
  from jsonb_array_elements(public.budget_notification(p_org, p_month, p_threshold)->'recipients') as r;
$$;
select date_trunc('month', now() at time zone 'UTC')::date as month \gset

-- ===========================================================================
-- 1. Quién puede llamar a qué
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'public.check_budget_thresholds(uuid)'::regprocedure),
  'check_budget_thresholds es security definer (escribe el aviso y el evento; service_role no tiene INSERT en ninguno)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'public.check_budget_thresholds(uuid)', 'execute')),
  array['service_role'], 'solo la plataforma comprueba los umbrales');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'public.budget_notification(uuid, date, smallint)', 'execute')),
  array['service_role'], 'solo la plataforma lee a quién se avisa');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_table_privilege(r, 'private.budget_notices', 'select') or has_table_privilege(r, 'private.budget_notices', 'insert')),
  null, 'ningún rol de la app toca los avisos directamente');
set local role authenticated;
select throws_ok(format('select public.check_budget_thresholds(%L)', :org_a), '42501', null, 'una persona no puede comprobarlos (ni provocar un aviso)');
reset role;
set local role anon;
select throws_ok(format('select public.budget_notification(%L, %L, 80::smallint)', :org_a, :'month'), '42501', null, 'anon tampoco lee a quién se avisa');
reset role;

-- ===========================================================================
-- 2. cost_eur con 9 decimales
-- ===========================================================================
select is(
  (select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'public.usage_records'::regclass and attname = 'cost_eur'),
  'numeric(16,9)', 'cost_eur tiene 9 decimales');
select pg_temp.spend(:org_b, 0.0000002);
select is((select cost_eur from public.usage_records where organization_id = :org_b and cost_eur < 0.000001), 0.0000002::numeric,
  'una llamada de embeddings muy pequeña ya no se redondea a 0');
delete from public.usage_records where organization_id = :org_b;

-- ===========================================================================
-- 3. El 80 % y el 100 %, una vez cada uno
-- ===========================================================================
insert into public.org_model_settings (organization_id, budget_per_run_eur, budget_per_day_eur, budget_per_month_eur)
values (:org_a, 0.5, 5, 10);

select pg_temp.spend(:org_a, 7.9);
select is(pg_temp.check(:org_a), '{}'::smallint[], 'por debajo del 80 %, nada');
select is(pg_temp.events(:org_a), '{}'::jsonb[], 'ni evento');

select pg_temp.spend(:org_a, 0.1);
select is(pg_temp.check(:org_a), '{80}'::smallint[], 'al llegar al 80 %, avisa del 80');
select is(pg_temp.events(:org_a), array[jsonb_build_object('month', :'month'::date, 'threshold', 80)],
  'un evento usage.budget_threshold con el mes y el umbral, sin importes');
select is(
  (select location_id from public.domain_events where organization_id = :org_a and type = 'usage.budget_threshold'),
  null, 'de la organización, sin local');
select is(pg_temp.check(:org_a), '{}'::smallint[], 'comprobarlo otra vez (un paso que se repite) no vuelve a avisar');
select is(cardinality(pg_temp.events(:org_a)), 1, 'sigue habiendo un solo evento del 80');

select pg_temp.spend(:org_a, 2.5);
select is(pg_temp.check(:org_a), '{100}'::smallint[], 'al pasar el tope, avisa del 100');
select is(cardinality(pg_temp.events(:org_a)), 2, 'dos eventos en el mes: 80 y 100');
select is(pg_temp.check(:org_a), '{}'::smallint[], 'y no más');
select is(
  (select array_agg(threshold::int || ':' || spent_eur::text || '/' || budget_eur::text || ':' || notified order by threshold)
   from private.budget_notices where organization_id = :org_a),
  array['80:8.000000000/10.0000:true', '100:10.500000000/10.0000:true'],
  'cada aviso guarda lo gastado y el tope al pasarlo');

-- ===========================================================================
-- 4. De golpe al 100 %: un solo aviso; sin política, el tope de plataforma
-- ===========================================================================
select pg_temp.spend(:org_b, 2);
select is(pg_temp.check(:org_b), '{}'::smallint[], 'sin política propia, el tope es el de plataforma (300 €): 2 € no avisan');
insert into public.org_model_settings (organization_id, budget_per_run_eur, budget_per_day_eur, budget_per_month_eur)
values (:org_b, 0.5, 1, 1);
select is(pg_temp.check(:org_b), '{100}'::smallint[], 'pasar el 80 y el 100 a la vez avisa solo del 100');
select is(pg_temp.events(:org_b), array[jsonb_build_object('month', :'month'::date, 'threshold', 100)], 'un solo evento, el del 100');
select is(
  (select array_agg(threshold::int || ':' || notified order by threshold) from private.budget_notices where organization_id = :org_b),
  array['80:false', '100:true'], 'el 80 queda anotado sin aviso: no saldrá más tarde');
select is(cardinality(pg_temp.events(:org_a)), 2, 'A sigue con sus dos eventos');

-- Lo del mes pasado no cuenta.
delete from private.budget_notices where organization_id = :org_b;
delete from public.usage_records where organization_id = :org_b;
insert into public.usage_records (organization_id, source, metric, quantity, tokens_in, tokens_out, cost_eur, provider, via, region, model, occurred_at)
values (:org_b, 'agent_turn', 'llm_tokens', 2, 1, 1, 5, 'anthropic', 'gateway', 'other', 'x', date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' - interval '1 hour');
select is(pg_temp.check(:org_b), '{}'::smallint[], 'lo gastado el mes pasado no cuenta para este');

-- Una organización que no está activa no recibe avisos.
select pg_temp.spend(:org_b, 5);
update public.organizations set status = 'suspended' where id = :org_b;
select is(pg_temp.check(:org_b), '{}'::smallint[], 'una organización suspendida no recibe avisos');
update public.organizations set status = 'active' where id = :org_b;

-- ===========================================================================
-- 5. A quién se avisa: solo los org_admin de la organización
-- ===========================================================================
select is(pg_temp.recipients(:org_a, :'month', 80::smallint), array['a_admin@test.local'], 'el aviso de A va a su org_admin y a nadie más');
select is(pg_temp.recipients(:org_a, :'month', 100::smallint), array['a_admin@test.local'], 'también el del 100');
select is(public.budget_notification(:org_b, :'month', 80::smallint), null, 'un aviso que no existe: null');
select is(public.budget_notification(:org_b, :'month', 100::smallint), null, 'el aviso de A pedido con la organización de B: null');
select is(
  (select public.budget_notification(:org_a, :'month', 80::smallint)->'notice'->>'threshold'),
  '80', 'con el umbral, lo gastado y el tope');
update auth.users set email_confirmed_at = null where id = :a_admin;
select is(pg_temp.recipients(:org_a, :'month', 80::smallint), null, 'sin email confirmado, nadie');
update auth.users set email_confirmed_at = now() where id = :a_admin;

select * from finish();
rollback;
