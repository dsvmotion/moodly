-- PL-T1, paso 3 (20261112061000): private.worker_agent_turn_context(agente) da
-- a moodly_worker el contexto del turno con la organización de la transacción,
-- sin que quien llama pueda elegir otra. Lo mismo que agent_turn_context para su
-- organización; nada para otra o sin organización; nadie más la ejecuta.
begin;
\ir _fixtures/tenants.psql
select plan(9);

-- Agentes con skills (las de serie de su tipo): así se ve que lee el catálogo.
select a.id as agent_a from public.agents a
where a.organization_id = :org_a and exists (select 1 from public.agent_skills g where g.agent_id = a.id)
order by a.id limit 1 \gset
select a.id as agent_b from public.agents a
where a.organization_id = :org_b and exists (select 1 from public.agent_skills g where g.agent_id = a.id)
order by a.id limit 1 \gset
-- Lo que devuelve la función de siempre (con la organización de parámetro).
select public.agent_turn_context(:org_a, :'agent_a') as expected_a \gset
select public.agent_turn_context(:org_b, :'agent_b') as expected_b \gset

select ok((select prosecdef from pg_proc where oid = 'private.worker_agent_turn_context(uuid)'::regprocedure),
  'es security definer (lee el catálogo de la plataforma, que moodly_worker no ve)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role', 'moodly_worker']) as r
   where has_function_privilege(r, 'private.worker_agent_turn_context(uuid)', 'execute')),
  array['moodly_worker'], 'solo moodly_worker la ejecuta');

-- Como moodly_worker (solo para este test: en el proyecto, postgres no puede
-- hacer SET ROLE al rol; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;

select is(private.worker_agent_turn_context(:'agent_a'), null::jsonb,
  'sin organización en la transacción, nada');

select set_config('moodly.organization_id', :org_a, true) as _org \gset
select is(private.worker_agent_turn_context(:'agent_a'), :'expected_a'::jsonb,
  'con A fijada, el contexto de su agente: lo mismo que agent_turn_context(A, agente)');
select ok(jsonb_array_length(private.worker_agent_turn_context(:'agent_a') -> 'skills') > 0
          and private.worker_agent_turn_context(:'agent_a') #>> '{agent,type_key}' is not null,
  'con sus skills y su tipo (el catálogo de la plataforma, que moodly_worker no lee directamente)');
select is(private.worker_agent_turn_context(:'agent_b'), null::jsonb,
  'con A fijada, el agente de B no existe');
select throws_ok('select count(*) from public.agent_types', '42501', null,
  'y el catálogo sigue sin leerse directamente (la función no abre las tablas)');

select set_config('moodly.organization_id', :org_b, true) as _org \gset
select is(private.worker_agent_turn_context(:'agent_b'), :'expected_b'::jsonb,
  'con B fijada, el de B');
reset role;

select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(format($$select private.worker_agent_turn_context(%L)$$, :'agent_a'), '42501', null,
  'la app no la puede llamar, ni un org_admin');
reset role;

select * from finish();
rollback;
