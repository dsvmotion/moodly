-- OA02, PR 2 (20261113150000): quien aprueba una respuesta del agente puede
-- corregir su texto al aprobarla, y solo entonces; nadie más, nunca después,
-- nunca al rechazar y solo en respuestas. Y una reserva o un cambio de cita
-- cuya hora ya pasó no se aprueba.
begin;
\ir _fixtures/tenants.psql
select plan(34);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
\set h '''abababababababababababababababababababababababababababababababab'''

insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger)
values ('e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message'),
       ('e5000000-0000-4000-8000-000000000003', :org_a, :loc_a3, :'agent_a', 'inbound_message');

insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, idempotency_key)
values
  -- 1: una respuesta en A1 (se aprueba editada)
  ('e5100000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
   'external_message', 'draft', '{"text": "Hola"}', '{"kind": "conversation"}', :h, 'drafted', 'e-1'),
  -- 2: otra respuesta en A1 (se rechaza: sin edición)
  ('e5100000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
   'external_message', 'draft', '{"text": "Hola otra vez"}', '{"kind": "conversation"}', :h, 'drafted', 'e-2'),
  -- 3: una reserva en A1 con la hora ya pasada
  ('e5100000-0000-4000-8000-000000000003', 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'book_appointment', 1,
   'internal_write', 'draft', '{"service_id": "s", "starts_at": "2020-06-01T09:00:00+02:00"}', '{"kind": "appointment"}', :h, 'drafted', 'e-3'),
  -- 4: una reserva en A1 con la hora por llegar
  ('e5100000-0000-4000-8000-000000000004', 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'book_appointment', 1,
   'internal_write', 'draft', '{"service_id": "s", "starts_at": "2099-06-01T09:00:00+02:00"}', '{"kind": "appointment"}', :h, 'drafted', 'e-4'),
  -- 5: algo que no es una respuesta
  ('e5100000-0000-4000-8000-000000000005', 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'cancel_appointment', 1,
   'internal_write', 'draft', '{"appointment_id": "a"}', '{"kind": "appointment"}', :h, 'drafted', 'e-5'),
  -- 6: una respuesta en A3 (otro alcance)
  ('e5100000-0000-4000-8000-000000000006', 'e5000000-0000-4000-8000-000000000003', :org_a, :loc_a3, 'reply', 1,
   'external_message', 'draft', '{"text": "Hola desde A3"}', '{"kind": "conversation"}', :h, 'drafted', 'e-6'),
  -- 7: una respuesta en A1 para los límites del texto
  ('e5100000-0000-4000-8000-000000000007', 'e5000000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
   'external_message', 'draft', '{"text": "Hola"}', '{"kind": "conversation"}', :h, 'drafted', 'e-7');

insert into public.approvals (id, execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at)
select ('e5200000-0000-4000-8000-00000000000' || n)::uuid, ('e5100000-0000-4000-8000-00000000000' || n)::uuid, :org_a,
       case when n = 6 then :loc_a3::uuid else :loc_a1::uuid end,
       case when n in (1, 2, 6, 7) then 'external_message' else 'internal_write' end, :h, 'staff', now() + interval '1 day'
from generate_series(1, 7) as n;

-- ===========================================================================
-- 1. La columna, la regla y los privilegios
-- ===========================================================================
select col_type_is('public', 'approvals', 'edited_input', 'jsonb', 'approvals.edited_input es jsonb');
select ok(has_column_privilege('authenticated', 'public.approvals', 'edited_input', 'update'), 'quien decide puede escribirla (al aprobar)');
select ok(not has_column_privilege('moodly_worker', 'public.approvals', 'edited_input', 'update'), 'el worker no');
select is(
  array[private.valid_reply_edit('{"text": "Hola"}'), private.valid_reply_edit(jsonb_build_object('text', repeat('a', 4000))),
        private.valid_reply_edit('{"text": ""}'), private.valid_reply_edit('{"text": "   "}'),
        private.valid_reply_edit(jsonb_build_object('text', repeat('a', 4001))), private.valid_reply_edit('{"text": "x", "otra": 1}'),
        private.valid_reply_edit('{"text": 5}'), private.valid_reply_edit('{}'), private.valid_reply_edit('["x"]'), private.valid_reply_edit(null)],
  array[true, true, false, false, false, false, false, false, false, false],
  'una edición válida es {"text": …} con 1 a 4000 caracteres sin contar los espacios de los lados, y nada más');
select throws_ok(
  format($$insert into public.approvals (execution_id, organization_id, location_id, effect_class, input_hash, required_role, expires_at, edited_input)
           values (%L, %L, %L, 'external_message', %L, 'staff', now() + interval '1 day', '{"text": "x"}')$$,
         'e5100000-0000-4000-8000-000000000001', :org_a, :loc_a1, :h),
  null, null, 'una aprobación no nace editada');

-- ===========================================================================
-- 2. Quien no puede decidirla, no la edita
-- ===========================================================================
select pg_temp.login(:a_staff2) as s \gset
with u as (update public.approvals set status = 'approved', edited_input = '{"text": "De A2"}'
           where id = 'e5200000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'el staff de A2 no aprueba ni edita una respuesta de A1') from u;
reset role;
select pg_temp.login(:a_staff1) as s \gset
with u as (update public.approvals set status = 'approved', edited_input = '{"text": "De A1"}'
           where id = 'e5200000-0000-4000-8000-000000000006' returning 1)
select is(count(*)::int, 0, 'el staff de A1 no aprueba ni edita una de A3') from u;
reset role;
select is((select edited_input from public.approvals where id = 'e5200000-0000-4000-8000-000000000006'), null::jsonb, 'y la de A3 sigue sin editar');

-- ===========================================================================
-- 3. Solo al aprobar, solo una respuesta, con un texto válido
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
select throws_ok($$update public.approvals set edited_input = '{"text": "Sin decidir"}' where id = 'e5200000-0000-4000-8000-000000000001'$$,
  '42501', null, 'editar sin aprobar: no');
select throws_ok($$update public.approvals set status = 'rejected', edited_input = '{"text": "Rechazo"}' where id = 'e5200000-0000-4000-8000-000000000002'$$,
  '42501', null, 'editar al rechazar: no');
select throws_ok($$update public.approvals set status = 'approved', edited_input = '{"appointment_id": "b"}' where id = 'e5200000-0000-4000-8000-000000000005'$$,
  '42501', null, 'editar algo que no es una respuesta: no');
select throws_ok($$update public.approvals set status = 'approved', edited_input = '{"text": "   "}' where id = 'e5200000-0000-4000-8000-000000000007'$$,
  '23514', null, 'un texto vacío: no');
select throws_ok(format($$update public.approvals set status = 'approved', edited_input = %L where id = 'e5200000-0000-4000-8000-000000000007'$$,
                        jsonb_build_object('text', repeat('a', 4001))),
  '23514', null, 'más de 4000 caracteres: no');
select throws_ok($$update public.approvals set status = 'approved', edited_input = '{"text": "x", "conversation_id": "otra"}' where id = 'e5200000-0000-4000-8000-000000000007'$$,
  '23514', null, 'con otro campo (el destino, por ejemplo): no');
select throws_ok($$update public.approvals set status = 'approved', edited_input = '{"text": 5}' where id = 'e5200000-0000-4000-8000-000000000007'$$,
  '23514', null, 'un texto que no es texto: no');
reset role;
select is(
  (select array_agg(status order by id) from public.approvals where id::text like 'e52%' and id::text not like '%6'),
  array['pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
  'ninguno de esos intentos decidió nada');

-- ===========================================================================
-- 4. Aprobar con la edición: una vez, y no cambia después
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
with u as (update public.approvals set status = 'approved', edited_input = '{"text": "Hola, corregido por el equipo"}'
           where id = 'e5200000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 1, 'el staff de A1 aprueba la respuesta con su corrección') from u;
reset role;
select results_eq(
  $$select status, edited_input, decided_by from public.approvals where id = 'e5200000-0000-4000-8000-000000000001'$$,
  format($$values ('approved'::text, '{"text": "Hola, corregido por el equipo"}'::jsonb, %L::uuid)$$, :a_staff1),
  'queda aprobada, con la edición y quien la decidió');
select is((select input from public.executions where id = 'e5100000-0000-4000-8000-000000000001'), '{"text": "Hola"}'::jsonb,
  'la ejecución sigue como la propuso el agente');
select is(
  (select count(*)::int from public.domain_events where type = 'approval.decided' and payload->>'approval_id' = 'e5200000-0000-4000-8000-000000000001'),
  1, 'y emite su approval.decided, como siempre');

select pg_temp.login(:a_staff1) as s \gset
with u as (update public.approvals set edited_input = '{"text": "Otra cosa"}' where id = 'e5200000-0000-4000-8000-000000000001' returning 1)
select is(count(*)::int, 0, 'después de aprobar, quien decidió ya no la toca (RLS: solo pendientes)') from u;
reset role;
select throws_ok($$update public.approvals set edited_input = '{"text": "Otra cosa"}' where id = 'e5200000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni la plataforma: lo aprobado no se edita después');
select throws_ok($$update public.approvals set edited_input = null where id = 'e5200000-0000-4000-8000-000000000001'$$,
  '42501', null, 'ni se quita');

-- El texto en el límite sí vale.
select pg_temp.login(:a_staff1) as s \gset
with u as (update public.approvals set status = 'approved', edited_input = jsonb_build_object('text', repeat('a', 4000))
           where id = 'e5200000-0000-4000-8000-000000000007' returning 1)
select is(count(*)::int, 1, '4000 caracteres, sí') from u;

-- Rechazar sin editar, como siempre.
with u as (update public.approvals set status = 'rejected' where id = 'e5200000-0000-4000-8000-000000000002' returning 1)
select is(count(*)::int, 1, 'rechazar sin edición, como siempre') from u;
reset role;
select is((select edited_input from public.approvals where id = 'e5200000-0000-4000-8000-000000000002'), null::jsonb, 'y queda sin edición');

-- ===========================================================================
-- 5. Una reserva cuya hora ya pasó no se aprueba
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
select throws_ok($$update public.approvals set status = 'approved' where id = 'e5200000-0000-4000-8000-000000000003'$$,
  'BK001', null, 'aprobar una reserva con la hora ya pasada: no');
with u as (update public.approvals set status = 'rejected' where id = 'e5200000-0000-4000-8000-000000000003' returning 1)
select is(count(*)::int, 1, 'rechazarla, sí') from u;
with u as (update public.approvals set status = 'approved' where id = 'e5200000-0000-4000-8000-000000000004' returning 1)
select is(count(*)::int, 1, 'una reserva con la hora por llegar se aprueba, como siempre') from u;
-- Lo que no es una reserva ni un cambio no mira la hora.
with u as (update public.approvals set status = 'approved' where id = 'e5200000-0000-4000-8000-000000000005' returning 1)
select is(count(*)::int, 1, 'una cancelación se aprueba sin mirar ninguna hora') from u;
reset role;

-- ===========================================================================
-- 6. El worker no escribe la edición
-- ===========================================================================
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select throws_ok($$update public.approvals set edited_input = '{"text": "Del worker"}' where id = 'e5200000-0000-4000-8000-000000000006'$$,
  '42501', null, 'moodly_worker no puede escribir edited_input (sin privilegio de columna)');
reset role;
select is((select edited_input from public.approvals where id = 'e5200000-0000-4000-8000-000000000006'), null::jsonb, 'y la de A3 sigue sin editar');

-- ===========================================================================
-- 7. CHECK: una edición solo en una aprobada
-- ===========================================================================
select throws_ok(
  $$update public.approvals set status = 'expired', edited_input = '{"text": "x"}' where id = 'e5200000-0000-4000-8000-000000000006'$$,
  '42501', null, 'caducar con edición: no (la plataforma tampoco)');
select is((select status from public.approvals where id = 'e5200000-0000-4000-8000-000000000006'), 'pending', 'y sigue pendiente');

select * from finish();
rollback;
