-- PL-T1, paso 3c-4 (20261112160000): moodly_worker pide las aprobaciones de su
-- organización (solo pendientes, solo las columnas que necesita) y nunca las
-- decide, caduca ni cambia; a una ejecución solo le pone «rejected» copiando el
-- rechazo de una persona, y nunca «approved»; service_role queda igual.
begin;
\ir _fixtures/tenants.psql
select plan(17);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, status)
values ('e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message', 'awaiting_approval'),
       ('e5000000-0000-4000-8000-0000000000b1', :org_b, :loc_b1, :'agent_b', 'inbound_message', 'awaiting_approval');
-- Tres ejecuciones de A esperando a una persona (1: la rechazará; 2: la aprobará; 3: sin decidir) y una de B.
insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, idempotency_key)
select ('e5100000-0000-4000-8000-00000000000' || n)::uuid, 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
       'external_message', 'draft', '{}', '{"kind":"none"}', repeat(n::text, 64), 'drafted', 'x50-' || n
from generate_series(1, 3) n;
insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, idempotency_key)
values ('e5100000-0000-4000-8000-0000000000b1', 'e5000000-0000-4000-8000-0000000000b1', :org_b, :loc_b1, 'reply', 1,
        'external_message', 'draft', '{}', '{"kind":"none"}', repeat('b', 64), 'drafted', 'x50-b');

create function pg_temp.request(p_execution uuid, p_org uuid, p_location uuid, p_hash text) returns void language sql as $$
  insert into public.approvals (organization_id, execution_id, location_id, effect_class, input_hash, required_role, reason, expires_at)
  values (p_org, p_execution, p_location, 'external_message', p_hash, 'staff', 'Responder', now() + interval '1 day')
  on conflict do nothing;
$$;

-- Privilegios, exactos.
select is(
  (select string_agg(column_name, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'approvals' and privilege_type = 'INSERT'),
  'effect_class, execution_id, expires_at, input_hash, location_id, organization_id, reason, required_role',
  'crea una aprobación sin estado, decisión ni quién la pidió');
select ok(not has_table_privilege('moodly_worker', 'public.approvals', 'update')
          and (select string_agg(column_name, ', ' order by column_name) from information_schema.column_privileges
               where grantee = 'moodly_worker' and table_name = 'approvals' and privilege_type = 'UPDATE') = 'status'
          and not has_table_privilege('moodly_worker', 'public.approvals', 'delete')
          and not has_table_privilege('moodly_worker', 'public.approvals', 'truncate'),
  'no borra aprobaciones y de una solo puede tocar el estado (20261113130000: caducar una respuesta que ya no toca, 56); nada más');

-- Como moodly_worker, con A fijada (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok(format($$select pg_temp.request(%L, %L, %L, %L)$$, 'e5100000-0000-4000-8000-000000000001', :org_a, :loc_a1, repeat('1', 64)),
  'pide la aprobación de lo que espera a una persona');
select lives_ok(format($$select pg_temp.request(%L, %L, %L, %L)$$, 'e5100000-0000-4000-8000-000000000001', :org_a, :loc_a1, repeat('1', 64)),
  'otra vez (la entrega se reanudó): on conflict no hace nada');
select lives_ok(format($$select pg_temp.request(%L, %L, %L, %L)$$, 'e5100000-0000-4000-8000-000000000002', :org_a, :loc_a1, repeat('2', 64)),
  'y la de la segunda');
select results_eq(
  $$select status, decided_by is null, decided_at is null from public.approvals where execution_id = 'e5100000-0000-4000-8000-000000000001'$$,
  $$values ('pending'::text, true, true)$$,
  'nace pendiente y sin decidir');
select throws_ok(
  format($$insert into public.approvals (organization_id, execution_id, location_id, effect_class, input_hash, required_role, status, expires_at)
           values (%L, 'e5100000-0000-4000-8000-000000000003', %L, 'external_message', %L, 'staff', 'approved', now() + interval '1 day')$$,
         :org_a, :loc_a1, repeat('3', 64)),
  '42501', null, 'no crea una aprobación ya aprobada (status sin privilegio)');
select throws_ok(
  format($$insert into public.approvals (organization_id, execution_id, location_id, effect_class, input_hash, required_role, decided_by, expires_at)
           values (%L, 'e5100000-0000-4000-8000-000000000003', %L, 'external_message', %L, 'staff', %L, now() + interval '1 day')$$,
         :org_a, :loc_a1, repeat('3', 64), :a_staff1),
  '42501', null, 'ni decidida por alguien (decided_by sin privilegio)');
select throws_ok($$update public.approvals set status = 'approved' where execution_id = 'e5100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'no aprueba una aprobación');
select throws_ok($$update public.approvals set status = 'expired' where execution_id = 'e5100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni la caduca (su respuesta sigue viva: guard_worker_approval)');
select throws_ok(format($$select pg_temp.request(%L, %L, %L, %L)$$, 'e5100000-0000-4000-8000-0000000000b1', :org_b, :loc_b1, repeat('b', 64)),
  '42501', null, 'no pide aprobaciones de otra organización (RLS, WITH CHECK)');
select throws_ok($$update public.executions set status = 'rejected' where id = 'e5100000-0000-4000-8000-000000000001'$$,
  '42501', null, 'no rechaza una ejecución cuya aprobación sigue pendiente');
reset role;

-- Una persona del equipo de A1 rechaza la primera y aprueba la segunda.
select pg_temp.login(:a_staff1) as s \gset
update public.approvals set status = 'rejected' where execution_id = 'e5100000-0000-4000-8000-000000000001';
update public.approvals set status = 'approved' where execution_id = 'e5100000-0000-4000-8000-000000000002';
reset role;

set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select lives_ok($$update public.executions set status = 'rejected' where id = 'e5100000-0000-4000-8000-000000000001'$$,
  'con la aprobación rechazada por una persona, copia el rechazo en la ejecución');
select throws_ok($$update public.executions set status = 'rejected' where id = 'e5100000-0000-4000-8000-000000000002'$$,
  '42501', null, 'pero no rechaza una aprobada');
select throws_ok($$update public.executions set status = 'approved' where id = 'e5100000-0000-4000-8000-000000000002'$$,
  '42501', null, 'ni pone «approved», aunque la aprobación lo esté');
select lives_ok($$update public.executions set status = 'executed', output = '{"ok":true}' where id = 'e5100000-0000-4000-8000-000000000002'$$,
  'la aprobada la ejecuta (guard_execution_status: aprobación aprobada y con el mismo hash)');
reset role;

-- service_role, igual que antes.
set local role service_role;
select lives_ok($$update public.executions set status = 'rejected' where id = 'e5100000-0000-4000-8000-000000000003'$$,
  'service_role sigue pudiendo cerrar como rechazada lo que espera a una persona');
reset role;

select * from finish();
rollback;
