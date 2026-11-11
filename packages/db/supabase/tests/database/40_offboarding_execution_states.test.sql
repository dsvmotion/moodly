-- D-01 y D-02 (auditoría 2026-11-10, migración 20261111200000):
-- 1. A una persona del equipo se la puede borrar aunque haya decidido una
--    aprobación, pedido un run o escrito una fuente de conocimiento: las filas
--    se quedan, con la columna a null. Las guardas siguen sin dejar cambiar
--    esas columnas a mano.
-- 2. Una ejecución solo llega a executed (o approved) sin aprobación si la
--    política la dejó ejecutar (autonomía execute o autonomous) o, si esperaba
--    a una persona, con su aprobación aprobada. Para todos los roles: también
--    la service role, que es con la que trabaja el worker, y el dueño.
-- 3. Ni la service role borra ejecuciones ni aprobaciones.
begin;
\ir _fixtures/tenants.psql
select plan(38);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
\set h1 '''a111111111111111111111111111111111111111111111111111111111111111'''
\set h2 '''a222222222222222222222222222222222222222222222222222222222222222'''
\set h3 '''a333333333333333333333333333333333333333333333333333333333333333'''
\set h4 '''a444444444444444444444444444444444444444444444444444444444444444'''
\set h5 '''a555555555555555555555555555555555555555555555555555555555555555'''
\set h6 '''a666666666666666666666666666666666666666666666666666666666666666'''
\set h7 '''a777777777777777777777777777777777777777777777777777777777777777'''

-- ===========================================================================
-- Datos (como la plataforma)
-- ===========================================================================
-- Un run normal y uno que pidió el location_manager de A1.
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('e0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message');
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, requested_by)
values ('e0000000-0000-4000-8000-000000000002', :org_a, :loc_a1, :'agent_a', 'staff_instruction', :a_loc1_mgr);

insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, idempotency_key)
values
  -- 1: espera aprobación (la política lo pidió con autonomía execute)
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'cancel_booking', 1,
   'internal_write', 'execute', '{"booking_ref":"b1"}', '{"kind":"none"}', :h1, 'needs_approval', 'off-k1'),
  -- 2: un borrador
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
   'external_message', 'draft', '{"text":"hola"}', '{"kind":"none"}', :h2, 'drafted', 'off-k2'),
  -- 3: una sugerencia sin aprobación (no debería pasar, pero la base de datos no se fía)
  ('e1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'create_task', 1,
   'internal_write', 'suggest', '{"title":"x"}', '{"kind":"none"}', :h3, 'suggested', 'off-k3'),
  -- 4: un borrador que acabará caducado
  ('e1000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
   'external_message', 'draft', '{"text":"adiós"}', '{"kind":"none"}', :h4, 'drafted', 'off-k4'),
  -- 5: el reembolso que pidió el location_manager de A1 (su run)
  ('e1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', :org_a, :loc_a1, 'refund', 1,
   'financial', 'draft', '{"amount":50}', '{"kind":"none"}', :h5, 'drafted', 'off-k5'),
  -- 6: otro borrador, para aprobar y luego borrar a quien lo aprobó
  ('e1000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
   'external_message', 'draft', '{"text":"vale"}', '{"kind":"none"}', :h6, 'drafted', 'off-k6');

insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'internal_write', :h1, 'staff', now() + interval '1 day'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', :org_a, :loc_a1, 'external_message', :h2, 'staff', now() + interval '1 day'),
  ('e2000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000004', :org_a, :loc_a1, 'external_message', :h4, 'staff', now() + interval '1 day'),
  ('e2000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000006', :org_a, :loc_a1, 'external_message', :h6, 'staff', now() + interval '1 day');
insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, requested_by, expires_at)
values ('e2000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000005', :org_a, :loc_a1, 'financial', :h5, 'location_manager', :a_loc1_mgr, now() + interval '1 day');

-- Una fuente de conocimiento que escribió el staff de A2.
insert into public.knowledge_sources (id, organization_id, location_id, type, title, created_by)
values ('e3000000-0000-4000-8000-000000000001', :org_a, :loc_a2, 'faq', 'Horarios', :a_staff2);
insert into public.knowledge_sources (id, organization_id, location_id, type, title, created_by)
values ('e3000000-0000-4000-8000-000000000002', :org_a, :loc_a1, 'faq', 'Precios', :a_staff1);

-- ===========================================================================
-- 1. D-02: la service role no ejecuta lo que no se ha aprobado
-- ===========================================================================
set local role service_role;
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'la service role no marca executed una ejecución con la aprobación pendiente');
select throws_ok($$update public.executions set status = 'approved' where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni approved');
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'ni un borrador con la aprobación pendiente');
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'ni una sugerencia que no tiene aprobación');
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('e0000000-0000-4000-8000-000000000001', %L, %L, 'reply', 1, 'external_message', 'draft', '{}', '{"kind":"none"}', %L, 'executed', 'off-ins-1')$$,
         :org_a, :loc_a1, :h7),
  '42501', null, 'una ejecución con autonomía draft no nace executed');
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('e0000000-0000-4000-8000-000000000001', %L, %L, 'reply', 1, 'external_message', 'suggest', '{}', '{"kind":"none"}', %L, 'failed', 'off-ins-2')$$,
         :org_a, :loc_a1, :h7),
  '42501', null, 'ni failed con autonomía suggest (no se intentó sin aprobación)');
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('e0000000-0000-4000-8000-000000000001', %L, %L, 'reply', 1, 'external_message', 'execute', '{}', '{"kind":"none"}', %L, 'approved', 'off-ins-3')$$,
         :org_a, :loc_a1, :h7),
  '42501', null, 'una ejecución no nace approved');
select throws_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('e0000000-0000-4000-8000-000000000001', %L, %L, 'reply', 1, 'external_message', 'execute', '{}', '{"kind":"none"}', %L, 'rejected', 'off-ins-4')$$,
         :org_a, :loc_a1, :h7),
  '42501', null, 'ni rejected');
select lives_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, output, idempotency_key)
           values ('e0000000-0000-4000-8000-000000000001', %L, %L, 'reply', 1, 'external_message', 'autonomous', '{}', '{"kind":"none"}', %L, 'executed', '{"ok":true}', 'off-ins-5')$$,
         :org_a, :loc_a1, :h7),
  'lo que la política deja ejecutar (autonomous o execute) nace executed: el flujo sin aprobación');
select lives_ok(
  format($$insert into public.executions (run_id, organization_id, location_id, skill_key, skill_version, effect_class, autonomy_applied, input, target, input_hash, status, idempotency_key)
           values ('e0000000-0000-4000-8000-000000000001', %L, %L, 'reply', 1, 'external_message', 'execute', '{}', '{"kind":"none"}', %L, 'failed', 'off-ins-6')$$,
         :org_a, :loc_a1, :h7),
  'o failed, si se intentó y falló');
select throws_ok($$update public.executions set status = 'needs_approval' where idempotency_key = 'off-ins-5'$$,
  '42501', null, 'una ejecución hecha no vuelve atrás');
select throws_ok($$update public.executions set status = 'failed' where idempotency_key = 'off-ins-5'$$,
  '42501', null, 'ni cambia de final');

-- El dueño de las tablas tampoco se salta la máquina de estados.
reset role;
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'el dueño de las tablas tampoco ejecuta lo que no se ha aprobado');

-- ===========================================================================
-- 2. D-02: los flujos válidos del worker siguen pasando
-- ===========================================================================
-- El staff de A1 aprueba 1 y 6 y rechaza 2.
select pg_temp.login(:a_staff1) as s \gset
update public.approvals set status = 'approved' where id in ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000006');
update public.approvals set status = 'rejected' where id = 'e2000000-0000-4000-8000-000000000002';
reset role;
-- 4 caduca (lo marca la plataforma).
update public.approvals set status = 'expired' where id = 'e2000000-0000-4000-8000-000000000004';

set local role service_role;
select lives_ok($$update public.executions set status = 'executed', output = '{"ok":true}' where id = 'e1000000-0000-4000-8000-000000000001'$$,
  'con la aprobación aprobada, el worker la marca executed');
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'con la aprobación rechazada, no');
select lives_ok($$update public.executions set status = 'rejected' where id = 'e1000000-0000-4000-8000-000000000002'$$,
  'la marca rejected');
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'y rejected es final');
select throws_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'con la aprobación caducada, no se ejecuta');
select lives_ok($$update public.executions set status = 'failed' where id = 'e1000000-0000-4000-8000-000000000004'$$,
  'lo que espera a una persona puede acabar failed (la aprobación no cuadra, por ejemplo)');
select lives_ok($$update public.executions set status = 'approved' where id = 'e1000000-0000-4000-8000-000000000006'$$,
  'con la aprobación aprobada también puede pasar por approved');
select lives_ok($$update public.executions set status = 'executed' where id = 'e1000000-0000-4000-8000-000000000006'$$,
  'y de approved a executed');
select results_eq(
  $$select status from public.executions where id in ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002',
                                                      'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000006') order by id$$,
  $$values ('executed'), ('rejected'), ('failed'), ('executed')$$,
  'los estados quedan como los dejó el worker');

-- ===========================================================================
-- 3. D-02: ni la service role borra ejecuciones ni aprobaciones
-- ===========================================================================
select throws_ok($$delete from public.approvals where id = 'e2000000-0000-4000-8000-000000000005'$$,
  '42501', null, 'la service role no borra aprobaciones');
select throws_ok($$delete from public.executions where id = 'e1000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'ni ejecuciones');
reset role;

-- ===========================================================================
-- 4. D-01: las guardas siguen sin dejar tocar esas columnas a mano
-- ===========================================================================
select throws_ok($$update public.approvals set decided_by = null where id = 'e2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'quien decidió no se borra a mano mientras exista');
select throws_ok(
  format($$update public.approvals set decided_by = %L where id = 'e2000000-0000-4000-8000-000000000001'$$, :a_staff2),
  '42501', null, 'ni se cambia por otra persona');
select throws_ok($$update public.approvals set requested_by = null where id = 'e2000000-0000-4000-8000-000000000005'$$,
  '42501', null, 'quien pidió la aprobación no se borra a mano');
select throws_ok($$update public.agent_runs set requested_by = null where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'ni quien pidió el run');
select throws_ok($$update public.knowledge_sources set created_by = null where id = 'e3000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni el autor de una fuente');

-- ===========================================================================
-- 5. D-01: borrar a la persona (como la plataforma, desde auth.users)
-- ===========================================================================
select lives_ok(format('delete from auth.users where id = %L', :a_staff1),
  'se puede borrar a quien decidió aprobaciones (y escribió una fuente)');
select results_eq(
  $$select status, decided_by, decided_at is not null from public.approvals
    where id in ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000006') order by id$$,
  $$values ('approved', null::uuid, true), ('rejected', null::uuid, true), ('approved', null::uuid, true)$$,
  'sus decisiones se quedan, con decided_by a null y la fecha');
select is((select created_by from public.knowledge_sources where id = 'e3000000-0000-4000-8000-000000000002'), null,
  'y su fuente se queda sin autor');

select lives_ok(format('delete from auth.users where id = %L', :a_loc1_mgr),
  'se puede borrar a quien pidió un run y su aprobación');
select is((select requested_by from public.agent_runs where id = 'e0000000-0000-4000-8000-000000000002'), null,
  'el run se queda, sin quien lo pidió');
select results_eq(
  $$select status, requested_by from public.approvals where id = 'e2000000-0000-4000-8000-000000000005'$$,
  $$values ('pending', null::uuid)$$,
  'la aprobación se queda pendiente, sin quien la pidió');

select lives_ok(format('delete from auth.users where id = %L', :a_staff2),
  'se puede borrar al autor de una fuente de conocimiento');
select results_eq(
  $$select title, created_by from public.knowledge_sources where id = 'e3000000-0000-4000-8000-000000000001'$$,
  $$values ('Horarios', null::uuid)$$,
  'la fuente se queda, sin autor');

-- Lo que se aprueba sigue sin cambiar.
select throws_ok($$update public.approvals set reason = 'otra' where id = 'e2000000-0000-4000-8000-000000000005'$$,
  '42501', null, 'el resto de la aprobación sigue sin cambiar');

select * from finish();
rollback;
