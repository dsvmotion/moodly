-- D-02, seguimiento (20261112040600): una ejecución no nace con más autonomía
-- que el techo de su clase de efecto (MANUAL §5.6): lo financiero y lo
-- destructivo, como mucho draft (nunca executed sin aprobación); el contacto
-- fuera de conversación, como mucho execute. Para todos los roles.
begin;
\ir _fixtures/tenants.psql
select plan(10);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('e7000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message');

create function pg_temp.new_execution(p_class text, p_autonomy text, p_status text, p_key text) returns void language sql as $$
  insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                                 autonomy_applied, input, target, input_hash, status, idempotency_key)
  select 'e7000000-0000-4000-8000-000000000001', l.organization_id, l.id, 'some_skill', 1, p_class,
         p_autonomy, '{}', '{"kind":"none"}', repeat('a', 64), p_status, p_key
  from public.locations l where l.id = (select location_id from public.agent_runs where id = 'e7000000-0000-4000-8000-000000000001');
$$;

set local role service_role;
-- Lo financiero y lo destructivo: como mucho draft.
select throws_ok($$select pg_temp.new_execution('financial', 'execute', 'executed', 'c1')$$, '42501', null,
  'la service role no registra un cobro ejecutado sin aprobación (autonomía execute)');
select throws_ok($$select pg_temp.new_execution('financial', 'autonomous', 'failed', 'c2')$$, '42501', null,
  'ni fallido con autonomía autonomous');
select throws_ok($$select pg_temp.new_execution('financial', 'execute', 'needs_approval', 'c3')$$, '42501', null,
  'ni siquiera esperando aprobación si dice una autonomía por encima de draft');
select throws_ok($$select pg_temp.new_execution('destructive', 'autonomous', 'executed', 'c4')$$, '42501', null,
  'ni algo destructivo ejecutado sin aprobación');
select lives_ok($$select pg_temp.new_execution('financial', 'draft', 'drafted', 'c5')$$,
  'un cobro nace en borrador, esperando a una persona');
select lives_ok($$select pg_temp.new_execution('destructive', 'suggest', 'suggested', 'c6')$$,
  'y algo destructivo, como sugerencia');
-- El contacto fuera de conversación: como mucho execute.
select throws_ok($$select pg_temp.new_execution('external_outreach', 'autonomous', 'executed', 'c7')$$, '42501', null,
  'un contacto fuera de conversación no nace con autonomía autonomous');
select lives_ok($$select pg_temp.new_execution('external_outreach', 'execute', 'executed', 'c8')$$,
  'con execute, sí (respetando consentimientos, como hoy)');
-- El resto, sin cambios.
select lives_ok($$select pg_temp.new_execution('external_message', 'autonomous', 'executed', 'c9')$$,
  'responder en la conversación sigue pudiendo ser autónomo');
reset role;

-- El dueño de las tablas tampoco se lo salta.
select throws_ok($$select pg_temp.new_execution('destructive', 'execute', 'executed', 'c10')$$, '42501', null,
  'el dueño de las tablas tampoco registra algo destructivo ejecutado sin aprobación');

select * from finish();
rollback;
