-- Runs, ejecuciones y aprobaciones atadas al contenido (20261030090000,
-- ADR 0047 paso 2b, control 3.3). Lo que se aprueba no cambia; solo decide una
-- persona con sesión, rol y alcance (aal2 para lo financiero y para el
-- org_admin); y la decisión deja un approval.decided en el outbox.
begin;
\ir _fixtures/tenants.psql
select plan(66);

-- ===========================================================================
-- Datos: un run en A1 con varias ejecuciones y sus aprobaciones (como la plataforma)
-- ===========================================================================
select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
\set hash_1 '''1111111111111111111111111111111111111111111111111111111111111111'''
\set hash_2 '''2222222222222222222222222222222222222222222222222222222222222222'''
\set hash_3 '''3333333333333333333333333333333333333333333333333333333333333333'''
\set hash_4 '''4444444444444444444444444444444444444444444444444444444444444444'''
\set hash_5 '''5555555555555555555555555555555555555555555555555555555555555555'''
\set hash_6 '''6666666666666666666666666666666666666666666666666666666666666666'''

insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('d0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message'),
       ('d0000000-0000-4000-8000-000000000002', :org_a, null, :'agent_a', 'schedule'),
       ('d0000000-0000-4000-8000-000000000003', :org_a, :loc_a3, :'agent_a', 'inbound_message'),
       ('d0000000-0000-4000-8000-000000000004', :org_b, :loc_b1, :'agent_b', 'inbound_message');
-- Un run que pidió una persona: el location_manager de A1.
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, requested_by)
values ('d0000000-0000-4000-8000-000000000005', :org_a, :loc_a1, :'agent_a', 'staff_instruction', :a_loc1_mgr);

insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, idempotency_key)
values
  -- 1: cancelar una cita en A1, la pide un location_manager
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'cancel_booking', 1,
   'internal_write', 'execute', '{"booking_ref":"b1"}', '{"kind":"none"}', :hash_1, 'needs_approval', 'k1'),
  -- 2: un descuento en A1 (financiero)
  ('d1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'apply_discount', 1,
   'financial', 'draft', '{"percent":10}', '{"kind":"none"}', :hash_2, 'drafted', 'k2'),
  -- 3: de toda la organización
  ('d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', :org_a, null, 'create_task', 1,
   'internal_write', 'draft', '{"title":"x"}', '{"kind":"none"}', :hash_3, 'drafted', 'k3'),
  -- 4: en A3 (otra región)
  ('d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', :org_a, :loc_a3, 'create_task', 1,
   'internal_write', 'draft', '{"title":"y"}', '{"kind":"none"}', :hash_4, 'drafted', 'k4'),
  -- 5: de la organización B
  ('d1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', :org_b, :loc_b1, 'create_task', 1,
   'internal_write', 'draft', '{"title":"z"}', '{"kind":"none"}', :hash_5, 'drafted', 'k5'),
  -- 6: un reembolso en A1 que pidió el location_manager de A1
  ('d1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005', :org_a, :loc_a1, 'refund', 1,
   'financial', 'draft', '{"amount":50}', '{"kind":"none"}', :hash_6, 'drafted', 'k6');

insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'internal_write', :hash_1, 'location_manager', now() + interval '1 day'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', :org_a, :loc_a1, 'financial', :hash_2, 'location_manager', now() + interval '1 day'),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', :org_a, null, 'internal_write', :hash_3, 'org_admin', now() + interval '1 day'),
  ('d2000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000004', :org_a, :loc_a3, 'internal_write', :hash_4, 'staff', now() + interval '1 day'),
  ('d2000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005', :org_b, :loc_b1, 'internal_write', :hash_5, 'staff', now() + interval '1 day');
insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, requested_by, expires_at)
values ('d2000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000006', :org_a, :loc_a1, 'financial', :hash_6, 'location_manager', :a_loc1_mgr, now() + interval '1 day');

-- ===========================================================================
-- 1. Coherencia al crear (para todos los roles)
-- ===========================================================================
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger) values (%L, %L, 'schedule')$$, :org_a, :'agent_b'),
  '23514', null, 'un run con el agente de otra organización no nace');
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, requested_by) values (%L, %L, 'schedule', %L)$$, :org_a, :'agent_a', :a_admin),
  '23514', null, 'solo un run staff_instruction lleva quien lo pidió');
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger, requested_by) values (%L, %L, 'staff_instruction', %L)$$, :org_a, :'agent_a', :b_admin),
  '23514', null, 'quien pide un run es de su organización');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
           values ('d1000000-0000-4000-8000-000000000006', %L, %L, 'financial', %L, 'location_manager', now() + interval '1 hour')$$,
         :org_a, :loc_a1, :hash_6),
  '23514', null, 'la aprobación lleva a quien pidió el run (no se puede omitir)');
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('d0000000-0000-4000-8000-000000000001', %L, %L, 'x_skill', 1, 'read', 'execute', '{}', '{"kind":"none"}', %L, 'executed', 'k-local')$$,
         :org_a, :loc_a2, :hash_1),
  '23514', null, 'una ejecución en otro local que su run no nace');
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('d0000000-0000-4000-8000-000000000001', %L, %L, 'x_skill', 1, 'read', 'execute', '{}', '{"kind":"none"}', %L, 'executed', 'k-org')$$,
         :org_b, :loc_a1, :hash_1),
  '23514', null, 'una ejecución en otra organización que su run no nace');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
           values ('d1000000-0000-4000-8000-000000000001', %L, %L, 'internal_write', %L, 'staff', now() + interval '1 hour')$$,
         :org_a, :loc_a1, :hash_2),
  '23514', null, 'una aprobación con otro hash que su ejecución no nace');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
           values ('d1000000-0000-4000-8000-000000000002', %L, %L, 'internal_write', %L, 'staff', now() + interval '1 hour')$$,
         :org_a, :loc_a1, :hash_2),
  '23514', null, 'una aprobación con otra clase de efecto que su ejecución no nace');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, status, expires_at)
           values ('d1000000-0000-4000-8000-000000000001', %L, %L, 'internal_write', %L, 'staff', 'approved', now() + interval '1 hour')$$,
         :org_a, :loc_a1, :hash_1),
  '23514', null, 'una aprobación no nace aprobada');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
           values ('d1000000-0000-4000-8000-000000000001', %L, %L, 'internal_write', %L, 'staff', now() - interval '1 hour')$$,
         :org_a, :loc_a1, :hash_1),
  '23514', null, 'una aprobación no nace caducada');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
           values ('d1000000-0000-4000-8000-000000000003', %L, null, 'internal_write', %L, 'staff', now() + interval '1 hour')$$,
         :org_a, :hash_3),
  '23514', null, 'una aprobación de toda la organización la decide un org_admin');

-- ===========================================================================
-- 2. Lo que se aprueba no cambia, tampoco para la plataforma
-- ===========================================================================
select throws_ok($$update public.executions set input = '{"booking_ref":"b2"}' where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la entrada de una ejecución no cambia (ni con la service role)');
select throws_ok($$update public.executions set target = '{"kind":"conversation","conversationId":"c","contactId":"x"}' where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'el destino de una ejecución no cambia');
select throws_ok($$update public.executions set input_hash = repeat('9', 64) where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'el hash de una ejecución no cambia');
select throws_ok($$update public.executions set skill_key = 'other_skill' where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la skill de una ejecución no cambia');
select lives_ok($$update public.executions set preview = '{"summary":"Cancelar la cita b1"}' where id = 'd1000000-0000-4000-8000-000000000001'$$,
  'la vista previa se pone una vez');
select throws_ok($$update public.executions set preview = '{"summary":"Otra cosa"}' where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'y después no cambia');
select throws_ok($$update public.approvals set input_hash = repeat('9', 64) where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'el hash de una aprobación no cambia');
select throws_ok($$update public.approvals set expires_at = now() + interval '1 year' where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la caducidad de una aprobación no cambia');
select throws_ok($$update public.approvals set required_role = 'staff' where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'el rol que pide una aprobación no cambia');
select throws_ok($$update public.approvals set requested_by = null where id = 'd2000000-0000-4000-8000-000000000006'$$,
  '42501', null, 'quien pidió una aprobación no cambia');
select throws_ok($$update public.agent_runs set requested_by = null where id = 'd0000000-0000-4000-8000-000000000005'$$,
  '42501', null, 'ni quien pidió el run');

-- La plataforma no aprueba: ni la service role ni el dueño de las tablas.
set local role service_role;
select throws_ok($$update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la service role no aprueba');
reset role;
select throws_ok($$update public.approvals set status = 'rejected' where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'el dueño de las tablas tampoco rechaza');

-- ===========================================================================
-- 3. Leer: cada uno lo de su alcance
-- ===========================================================================
reset role;
select pg_temp.login(:a_staff1) as s \gset
select is((select array_agg(id::text order by id) from public.approvals),
  array['d2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000006'],
  'el staff de A1 ve las aprobaciones de A1, no las de A3, la de toda la organización ni las de B');
select is((select count(*)::int from public.executions), 3, 'y solo las ejecuciones de A1');
select is((select count(*)::int from public.agent_runs), 2, 'y solo los runs de A1');
reset role;
select pg_temp.login(:a_admin) as s \gset
select is((select count(*)::int from public.approvals), 5, 'el org_admin de A ve las 5 de su organización');
reset role;
select pg_temp.login(:b_admin) as s \gset
select is((select array_agg(id::text) from public.approvals), array['d2000000-0000-4000-8000-000000000005'],
  'el org_admin de B solo ve la suya');
reset role;
select pg_temp.login(:outsider) as s \gset
select is((select count(*)::int from public.approvals), 0, 'alguien sin organización no ve ninguna');

-- La app no crea ni borra.
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.agent_runs (organization_id, agent_id, trigger) values (%L, %L, 'schedule')$$, :org_a, :'agent_a'),
  '42501', null, 'la app no crea runs (ni el org_admin con aal2)');
select throws_ok($$delete from public.approvals where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la app no borra aprobaciones');
select throws_ok($$update public.executions set status = 'approved' where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la app no cambia ejecuciones');

-- ===========================================================================
-- 4. Decidir: rol, alcance y aal2
-- ===========================================================================
-- La función de la política, por sí sola: aunque la RLS de lectura ya oculta
-- las aprobaciones de otros locales, decidir comprueba el alcance otra vez.
reset role;
select pg_temp.login(:a_staff2) as s \gset
select is(private.can_decide_approval(:org_a, :loc_a3, 'staff'), false, 'can_decide_approval: el staff de A2 no llega a A3');
select is(private.can_decide_approval(:org_a, :loc_a2, 'staff'), true, 'can_decide_approval: el staff de A2 sí decide en A2 lo que pide un staff');
reset role;
select pg_temp.login(:a_region_mgr) as s \gset
select is(private.can_decide_approval(:org_a, :loc_a3, 'staff'), false, 'can_decide_approval: el region_manager no llega fuera de su región');
reset role;
select pg_temp.login(:a_loc1_mgr) as s \gset
select is(private.can_decide_approval(:org_a, null, 'location_manager'), false, 'can_decide_approval: sin local, solo el org_admin');

reset role;
select pg_temp.login(:a_staff1) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'el staff no decide lo que pide un location_manager') from u;

reset role;
select pg_temp.login(:a_staff2) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 0, 'el staff de A2 no decide en A3 aunque baste con staff') from u;

reset role;
select pg_temp.login(:a_region_mgr) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 0, 'el region_manager de A-Norte no decide en A3 (A-Sur)') from u;

reset role;
select pg_temp.login(:a_admin) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000003' returning 1)
select is(count(*)::int, 0, 'el org_admin sin aal2 no decide') from u;

reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'el org_admin de otra organización no decide, ni con aal2') from u;

select pg_temp.staff_login(:p_admin) as s \gset
select is((select count(*)::int from public.approvals where organization_id = :org_a), 5, 'el equipo interno con permiso las ve');
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'pero no decide') from u;

reset role;
select pg_temp.login(:a_loc1_mgr) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 0, 'lo financiero no se aprueba sin aal2, ni con el rol y el alcance') from u;
select throws_ok($$update public.approvals set status = 'approved', reason = 'otra cosa' where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'quien decide solo puede tocar el estado');
select throws_ok(
  format($$update public.approvals set status = 'approved', decided_by = %L where id = 'd2000000-0000-4000-8000-000000000001'$$, :a_staff1),
  '42501', null, 'ni poner a otro como quien decidió');
select throws_ok($$update public.approvals set status = 'expired' where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'una persona no marca una aprobación como caducada');

-- El location_manager de A1 aprueba la cancelación (no financiera): sin aal2 basta.
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 1, 'el location_manager de A1 aprueba lo suyo') from u;
select results_eq(
  $$select decided_by, decided_at is not null from public.approvals where id = 'd2000000-0000-4000-8000-000000000001'$$,
  format('values (%L::uuid, true)', :a_loc1_mgr),
  'decided_by y decided_at los pone la base de datos');
with u as (update public.approvals set status = 'rejected' where id = 'd2000000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'una aprobación decidida no se vuelve a decidir') from u;

-- Con aal2, el mismo location_manager aprueba lo financiero.
reset role;
select pg_temp.login_mfa(:a_loc1_mgr) as s \gset
with u as (update public.approvals set status = 'rejected' where id = 'd2000000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 1, 'con aal2, el location_manager rechaza el descuento') from u;

-- El org_admin con aal2 decide lo de toda la organización.
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000003' returning 1)
select is(count(*)::int, 1, 'el org_admin con aal2 decide lo de toda la organización') from u;

-- Separación de funciones: el reembolso lo pidió el location_manager de A1.
reset role;
select pg_temp.login_mfa(:a_loc1_mgr) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000006' returning 1)
select is(count(*)::int, 0, 'quien pidió lo financiero no lo aprueba, ni con rol, alcance y aal2') from u;
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000006' returning 1)
select is(count(*)::int, 1, 'lo aprueba otra persona con rol, alcance y aal2') from u;

reset role;
select throws_ok($$update public.approvals set status = 'pending', decided_at = null, decided_by = null where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'una decisión no se deshace, tampoco desde la plataforma');

-- ===========================================================================
-- 5. Caducidad
-- ===========================================================================
select lives_ok($$update public.approvals set status = 'expired' where id = 'd2000000-0000-4000-8000-000000000004'$$,
  'la plataforma marca una aprobación como caducada');
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 0, 'una aprobación caducada no se aprueba') from u;
reset role;
select throws_ok($$update public.approvals set status = 'pending' where id = 'd2000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'y no vuelve a pendiente');

-- Pasada la hora, ni con rol, alcance y aal2: una aprobación cuya caducidad ya
-- pasó sin que nadie la marcara. now() no avanza dentro de la transacción del
-- test, así que se adelanta la caducidad saltándose la guarda solo aquí.
alter table public.approvals disable trigger guard_approval;
update public.approvals set created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where id = 'd2000000-0000-4000-8000-000000000005';
alter table public.approvals enable trigger guard_approval;
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.approvals set status = 'approved' where id = 'd2000000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 0, 'pasada la caducidad no se aprueba aunque nadie la haya marcado') from u;

-- ===========================================================================
-- 6. La decisión deja un approval.decided en el outbox, sin datos personales
-- ===========================================================================
reset role;
select results_eq(
  $$select organization_id, location_id, payload ->> 'decision', payload ->> 'run_id', chain_depth
    from public.domain_events where type = 'approval.decided' and payload ->> 'approval_id' = 'd2000000-0000-4000-8000-000000000001'$$,
  format($$values (%L::uuid, %L::uuid, 'approved', 'd0000000-0000-4000-8000-000000000001', 0::smallint)$$, :org_a, :loc_a1),
  'aprobar emite approval.decided con la organización y el local de la aprobación');
select is(
  (select payload ->> 'decision' from public.domain_events where type = 'approval.decided' and payload ->> 'approval_id' = 'd2000000-0000-4000-8000-000000000002'),
  'rejected', 'rechazar también lo emite');
select is(
  (select count(*)::int from public.domain_events where type = 'approval.decided'), 4,
  'una vez por decisión (tres aprobadas y una rechazada); caducar no emite');
select is(
  (select array_agg(distinct k order by k) from public.domain_events, jsonb_object_keys(payload) k where type = 'approval.decided'),
  array['approval_id', 'decision', 'execution_id', 'run_id'],
  'el payload solo lleva identificadores y la decisión');

-- ===========================================================================
-- 7. Cada decisión queda en la auditoría (append-only), con quién decidió
-- ===========================================================================
select results_eq(
  $$select action, actor_type, actor_id from public.audit_logs
    where action like 'approval.%' order by target ->> 'approval_id'$$,
  format($$values ('approval.approved', 'user', %L::uuid), ('approval.rejected', 'user', %L::uuid),
                  ('approval.approved', 'user', %L::uuid), ('approval.approved', 'user', %L::uuid)$$,
         :a_loc1_mgr, :a_loc1_mgr, :a_admin, :a_admin),
  'aprobar y rechazar quedan en audit_logs con la persona que decidió; caducar no');
select is(
  (select metadata ->> 'input_hash' from public.audit_logs where target ->> 'approval_id' = 'd2000000-0000-4000-8000-000000000001'),
  repeat('1', 64), 'la auditoría guarda el hash de lo que se aprobó');

select * from finish();
rollback;
