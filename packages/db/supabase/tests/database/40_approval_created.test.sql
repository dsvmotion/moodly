-- Aviso de las aprobaciones nuevas (20261112060000, M-02): cada aprobación nueva
-- deja un approval.created en el outbox, en la misma transacción; y
-- approval_notification dice a quién avisar con la misma regla con la que RLS
-- deja decidirla (private.can_decide_approval y approvals_decide), de una sola
-- organización y solo para service_role.
begin;
\ir _fixtures/tenants.psql
select plan(33);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
\set hash '''abababababababababababababababababababababababababababababababab'''

-- Datos (la plataforma, como el worker): un run por local y una ejecución por aprobación.
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('f0000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message'),
       ('f0000000-0000-4000-8000-000000000002', :org_a, null, :'agent_a', 'schedule'),
       ('f0000000-0000-4000-8000-000000000003', :org_a, :loc_a2, :'agent_a', 'inbound_message'),
       ('f0000000-0000-4000-8000-000000000004', :org_a, :loc_a3, :'agent_a', 'inbound_message'),
       ('f0000000-0000-4000-8000-000000000005', :org_b, :loc_b1, :'agent_b', 'inbound_message');
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, requested_by)
values ('f0000000-0000-4000-8000-000000000006', :org_a, :loc_a1, :'agent_a', 'staff_instruction', :a_loc1_mgr);

insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, idempotency_key)
select ('f1000000-0000-4000-8000-00000000000' || n)::uuid, ('f0000000-0000-4000-8000-00000000000' || r)::uuid,
       org, loc, 'reply', 1, effect, 'execute', '{}', '{"kind":"none"}', :hash, 'needs_approval', 'ac-' || n
from (values
  (1, 1, :org_a::uuid, :loc_a1::uuid, 'external_message'),   -- A1, lo decide el staff
  (2, 1, :org_a::uuid, :loc_a1::uuid, 'external_outreach'),  -- A1, lo decide quien dirige el local
  (3, 2, :org_a::uuid, null::uuid,    'internal_write'),     -- toda la organización: solo el org_admin
  (4, 3, :org_a::uuid, :loc_a2::uuid, 'external_message'),   -- A2 (región norte)
  (5, 4, :org_a::uuid, :loc_a3::uuid, 'external_message'),   -- A3 (región sur)
  (6, 5, :org_b::uuid, :loc_b1::uuid, 'external_message'),   -- B1
  (7, 6, :org_a::uuid, :loc_a1::uuid, 'financial')           -- A1, financiero, lo pidió el location_manager
) as v(n, r, org, loc, effect);

create temp view created_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b) and type = 'approval.created';

select is((select count(*)::int from created_events), 0, 'antes de las aprobaciones, ningún approval.created');

insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, reason, expires_at)
values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'external_message', :hash, 'staff', 'Responder a Ana', now() + interval '1 day'),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000002', :org_a, :loc_a1, 'external_outreach', :hash, 'location_manager', null, now() + interval '1 day'),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000003', :org_a, null, 'internal_write', :hash, 'org_admin', null, now() + interval '1 day'),
  ('f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000004', :org_a, :loc_a2, 'external_message', :hash, 'staff', null, now() + interval '1 day'),
  ('f2000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000005', :org_a, :loc_a3, 'external_message', :hash, 'staff', null, now() + interval '1 day'),
  ('f2000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000006', :org_b, :loc_b1, 'external_message', :hash, 'staff', null, now() + interval '1 day');
insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, requested_by, expires_at)
values ('f2000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000007', :org_a, :loc_a1, 'financial', :hash, 'location_manager', :a_loc1_mgr, now() + interval '1 day');

-- ===========================================================================
-- 1. Las funciones: quién puede llamarlas
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'private.emit_approval_created()'::regprocedure),
  'emit_approval_created es security definer (escribe el evento; service_role no tiene INSERT en domain_events)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.emit_approval_created()', 'execute')),
  null, 'nadie de la app puede ejecutar emit_approval_created');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'public.approval_notification(uuid, uuid)', 'execute')),
  array['service_role'], 'approval_notification: solo service_role (el worker)');
select ok((select provolatile = 's' from pg_proc where oid = 'public.approval_notification(uuid, uuid)'::regprocedure),
  'approval_notification es stable: solo lee');
select ok(not has_table_privilege('authenticated', 'public.approvals', 'insert'),
  'una persona no crea aprobaciones (no puede fabricar un approval.created)');

-- ===========================================================================
-- 2. approval.created, en la misma transacción que la aprobación
-- ===========================================================================
select is((select count(*)::int from created_events), 7, 'un approval.created por aprobación nueva');
select is(
  (select payload from created_events where payload->>'approval_id' = 'f2000000-0000-4000-8000-000000000001'),
  jsonb_build_object('approval_id', 'f2000000-0000-4000-8000-000000000001',
                     'execution_id', 'f1000000-0000-4000-8000-000000000001',
                     'run_id', 'f0000000-0000-4000-8000-000000000001'),
  'el payload solo lleva ids (sin datos personales ni el tenant)');
select is(
  (select array[organization_id::text, location_id::text, source_run_id::text] from created_events
   where payload->>'approval_id' = 'f2000000-0000-4000-8000-000000000001'),
  array[:org_a::text, :loc_a1::text, 'f0000000-0000-4000-8000-000000000001'],
  'la organización y el local salen de la aprobación; el run que la provocó, de su ejecución');
select is(
  (select organization_id::text from created_events where payload->>'approval_id' = 'f2000000-0000-4000-8000-000000000006'),
  :org_b::text, 'el de B es de B');
select is(
  (select location_id from created_events where payload->>'approval_id' = 'f2000000-0000-4000-8000-000000000003'),
  null, 'una aprobación de toda la organización deja el evento sin local');

-- Cambiar el estado no deja otro (aquí la caduca la plataforma: decidir solo puede una persona con sesión).
update public.approvals set status = 'expired' where id = 'f2000000-0000-4000-8000-000000000005';
select is((select count(*)::int from created_events), 7, 'cambiar el estado de una aprobación no deja otro approval.created');
select is((public.approval_notification(:org_a, 'f2000000-0000-4000-8000-000000000005')->'approval'->>'status'), 'expired',
  'y approval_notification dice su estado (el worker no avisa de una que ya no está pendiente)');

-- ===========================================================================
-- 3. A quién se avisa: la misma regla que deja decidir
-- ===========================================================================
create function pg_temp.recipients(p_org uuid, p_approval uuid) returns text[] language sql as $$
  select array_agg(r->>'user_id' order by r->>'user_id')
  from jsonb_array_elements(public.approval_notification(p_org, p_approval)->'recipients') as r;
$$;

-- Quien puede decidirla según RLS: can_decide_approval con la identidad de cada
-- persona del fixture, y lo financiero y lo destructivo no lo decide quien lo
-- pidió (approvals_decide). Se lee como postgres: solo cambia el sub del JWT.
create function pg_temp.deciders(p_approval uuid) returns text[] language plpgsql as $$
declare
  v_approval public.approvals;
  v_user uuid;
  v_out text[] := '{}';
begin
  select * into v_approval from public.approvals where id = p_approval;
  for v_user in select id from auth.users where email like '%@test.local' order by id::text loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    if private.can_decide_approval(v_approval.organization_id, v_approval.location_id, v_approval.required_role)
       and (v_approval.effect_class not in ('financial', 'destructive') or v_approval.requested_by is distinct from v_user) then
      v_out := v_out || v_user::text;
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return nullif(v_out, '{}');
end;
$$;

select is(pg_temp.recipients(organization_id, id), pg_temp.deciders(id),
  format('aprobación %s: se avisa exactamente a quien puede decidirla', right(id::text, 1)))
from public.approvals where id::text like 'f2000000-%' order by id;

select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000001'),
  array[:a_admin::text, :a_region_mgr::text, :a_loc1_mgr::text, :a_staff1::text],
  'A1 (staff): el org_admin, el region_manager de su región, su location_manager y su staff; no el staff de A2 ni nadie de B');
select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000002'),
  array[:a_admin::text, :a_region_mgr::text, :a_loc1_mgr::text],
  'A1 (location_manager): el staff ya no');
select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000003'), array[:a_admin::text],
  'de toda la organización: solo el org_admin');
select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000005'), array[:a_admin::text],
  'A3 (región sur): ni el region_manager del norte ni el staff de otros locales');
select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000007'), array[:a_admin::text, :a_region_mgr::text],
  'financiero: no se avisa a quien lo pidió (no puede aprobarlo)');
select is(pg_temp.recipients(:org_b, 'f2000000-0000-4000-8000-000000000006'), array[:b_admin::text, :b_loc_mgr::text],
  'B1: solo gente de B');

-- ===========================================================================
-- 4. Lo que devuelve, y solo de su organización
-- ===========================================================================
select is(
  (select r->>'email' from jsonb_array_elements(public.approval_notification(:org_a, 'f2000000-0000-4000-8000-000000000001')->'recipients') as r
   where r->>'user_id' = :a_staff1::text),
  'a_staff1@test.local', 'lleva el email de auth.users de cada persona');
select is(
  (select jsonb_build_object('reason', n->'approval'->'reason', 'location', n->'location', 'type_key', n->'agent'->'type_key')
   from public.approval_notification(:org_a, 'f2000000-0000-4000-8000-000000000001') as n),
  jsonb_build_object('reason', 'Responder a Ana', 'location', jsonb_build_object('name', 'Local A1', 'timezone', 'Europe/Madrid'),
                     'type_key', (select t.key from public.agents a join public.agent_types t on t.id = a.agent_type_id where a.id = :'agent_a')),
  'y el resumen, el local con su zona horaria y el tipo del agente');
select is(public.approval_notification(:org_b, 'f2000000-0000-4000-8000-000000000001'), null,
  'una aprobación de A pedida con la organización de B no existe');
select is(public.approval_notification(:org_a, 'f2000000-0000-4000-8000-000000000006'), null,
  'ni una de B con la de A');

-- ===========================================================================
-- 5. Cuentas que no pueden entrar, y organizaciones que no están activas
-- ===========================================================================
update auth.users set banned_until = now() + interval '1 day' where id = :a_staff1;
update auth.users set email_confirmed_at = null where id = :a_loc1_mgr;
select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000001'), array[:a_admin::text, :a_region_mgr::text],
  'ni una cuenta baneada ni una sin email confirmado');
update auth.users set banned_until = null where id = :a_staff1;
update auth.users set email_confirmed_at = now() where id = :a_loc1_mgr;
update auth.users set deleted_at = now() where id = :a_region_mgr;
select is(pg_temp.recipients(:org_a, 'f2000000-0000-4000-8000-000000000001'), array[:a_admin::text, :a_loc1_mgr::text, :a_staff1::text],
  'ni una cuenta borrada');
update auth.users set deleted_at = null where id = :a_region_mgr;

update public.organizations set status = 'suspended' where id = :org_a;
select is(public.approval_notification(:org_a, 'f2000000-0000-4000-8000-000000000001')->'recipients', '[]'::jsonb,
  'una organización suspendida no avisa a nadie');
update public.organizations set status = 'active' where id = :org_a;

select * from finish();
rollback;
