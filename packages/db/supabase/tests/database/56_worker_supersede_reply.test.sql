-- O-01, gate M1 (20261113130000): el worker caduca solo la aprobación de un
-- borrador de respuesta que ya no toca (su ejecución, failed con superseded) y
-- nada más; y el código de un envío «unknown» se guarda sin cambiar el estado.
begin;
\ir _fixtures/tenants.psql
select plan(16);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset
insert into public.agent_runs (id, organization_id, location_id, agent_id, trigger, status)
values ('e5600000-0000-4000-8000-000000000001', :org_a, :loc_a1, :'agent_a', 'inbound_message', 'awaiting_approval'),
       ('e5600000-0000-4000-8000-0000000000b1', :org_b, :loc_b1, :'agent_b', 'inbound_message', 'awaiting_approval');
-- 1: respuesta que ya no toca; 2: respuesta viva; 3: una reserva (internal_write) también marcada; b1: de B, marcada.
insert into public.executions (id, run_id, organization_id, location_id, skill_key, skill_version, effect_class,
                               autonomy_applied, input, target, input_hash, status, output, idempotency_key)
values ('e5610000-0000-4000-8000-000000000001', 'e5600000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
        'external_message', 'draft', '{}', '{"kind":"none"}', repeat('1', 64), 'drafted', null, 'x56-1'),
       ('e5610000-0000-4000-8000-000000000002', 'e5600000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'reply', 1,
        'external_message', 'draft', '{}', '{"kind":"none"}', repeat('2', 64), 'drafted', null, 'x56-2'),
       ('e5610000-0000-4000-8000-000000000003', 'e5600000-0000-4000-8000-000000000001', :org_a, :loc_a1, 'book_appointment', 1,
        'internal_write', 'draft', '{}', '{"kind":"none"}', repeat('3', 64), 'drafted', null, 'x56-3'),
       ('e5610000-0000-4000-8000-0000000000b1', 'e5600000-0000-4000-8000-0000000000b1', :org_b, :loc_b1, 'reply', 1,
        'external_message', 'draft', '{}', '{"kind":"none"}', repeat('b', 64), 'drafted', null, 'x56-b');
insert into public.approvals (organization_id, execution_id, location_id, effect_class, input_hash, required_role, reason, expires_at)
values (:org_a, 'e5610000-0000-4000-8000-000000000001', :loc_a1, 'external_message', repeat('1', 64), 'staff', 'Responder', now() + interval '1 day'),
       (:org_a, 'e5610000-0000-4000-8000-000000000002', :loc_a1, 'external_message', repeat('2', 64), 'staff', 'Responder', now() + interval '1 day'),
       (:org_a, 'e5610000-0000-4000-8000-000000000003', :loc_a1, 'internal_write', repeat('3', 64), 'staff', 'Reservar', now() + interval '1 day'),
       (:org_b, 'e5610000-0000-4000-8000-0000000000b1', :loc_b1, 'external_message', repeat('b', 64), 'staff', 'Responder', now() + interval '1 day');
-- Las marcas de superseded que pondría el worker (en 1, 3 y b1; 2 sigue viva).
update public.executions set status = 'failed', output = '{"superseded":"newer_message"}'
where id in ('e5610000-0000-4000-8000-000000000001', 'e5610000-0000-4000-8000-000000000003', 'e5610000-0000-4000-8000-0000000000b1');

select ok(not (select prosecdef from pg_proc where oid = 'private.guard_worker_approval()'::regprocedure),
  'guard_worker_approval es invoker');

grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

select lives_ok($$update public.approvals set status = 'expired' where execution_id = 'e5610000-0000-4000-8000-000000000001'$$,
  'caduca la aprobación de una respuesta que ya no toca');
select results_eq($$select status, decided_by is null, decided_at is null from public.approvals where execution_id = 'e5610000-0000-4000-8000-000000000001'$$,
  $$values ('expired'::text, true, true)$$, 'queda expired y sin decidir');
select throws_ok($$update public.approvals set status = 'expired' where execution_id = 'e5610000-0000-4000-8000-000000000002'$$,
  '42501', null, 'no caduca la de una respuesta viva');
select throws_ok($$update public.approvals set status = 'expired' where execution_id = 'e5610000-0000-4000-8000-000000000003'$$,
  '42501', null, 'ni la de una reserva, aunque esté marcada (solo external_message)');
select throws_ok($$update public.approvals set status = 'approved' where execution_id = 'e5610000-0000-4000-8000-000000000002'$$,
  '42501', null, 'no aprueba');
select throws_ok($$update public.approvals set status = 'rejected' where execution_id = 'e5610000-0000-4000-8000-000000000002'$$,
  '42501', null, 'ni rechaza');
select throws_ok($$update public.approvals set reason = 'otra' where execution_id = 'e5610000-0000-4000-8000-000000000002'$$,
  '42501', null, 'ni cambia otra columna (sin privilegio)');
select throws_ok($$update public.approvals set status = 'pending' where execution_id = 'e5610000-0000-4000-8000-000000000001'$$,
  '42501', null, 'una caducada no vuelve a pending');
-- RLS: la de B no la ve, así que no la toca.
update public.approvals set status = 'expired' where execution_id = 'e5610000-0000-4000-8000-0000000000b1';
reset role;
select is((select status from public.approvals where execution_id = 'e5610000-0000-4000-8000-0000000000b1'), 'pending',
  'no caduca las de otra organización (RLS)');

-- delivery_error de un «unknown».
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', '560000000000001', 'customer', 'active') returning id as ca \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_a', :'ca', :'agent_a', 'agent') returning id as conv \gset
insert into public.messages (organization_id, conversation_id, direction, author, content, status)
values (:org_a, :'conv', 'out', 'agent', 'Hola', 'unknown'), (:org_a, :'conv', 'out', 'agent', 'Adiós', 'sent');
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org2 \gset
update public.messages set delivery_error = 'http_502' where content = 'Hola';
update public.messages set delivery_error = 'http_502' where content = 'Adiós';
reset role;
select results_eq($$select status, delivery_error from public.messages where content = 'Hola'$$,
  $$values ('unknown'::text, 'http_502'::text)$$, 'el código de un «unknown» se guarda sin cambiar el estado');
select results_eq($$select status, delivery_error from public.messages where content = 'Adiós'$$,
  $$values ('sent'::text, null::text)$$, 'en cualquier otro estado, sin cambio de estado no se toca el error (como antes)');
update public.messages set status = 'delivered', delivery_error = 'x' where content = 'Hola';
select results_eq($$select status, delivery_error from public.messages where content = 'Hola'$$,
  $$values ('delivered'::text, 'x'::text)$$, 'un aviso del proveedor lo resuelve (el estado cambia: lo de siempre)');
update public.messages set status = 'sent', delivery_error = 'y' where content = 'Hola';
select results_eq($$select status, delivery_error from public.messages where content = 'Hola'$$,
  $$values ('delivered'::text, 'x'::text)$$, 'delivered solo avanza: un sent tardío no cambia ni el estado ni el error');
update public.messages set status = 'unknown', delivery_error = 'z' where content = 'Hola';
select results_eq($$select status, delivery_error from public.messages where content = 'Hola'$$,
  $$values ('delivered'::text, 'x'::text)$$, 'ni vuelve a «unknown» para cambiar el error');

-- service_role sigue igual (puede caducar como antes).
set local role service_role;
select lives_ok($$update public.approvals set status = 'expired' where execution_id = 'e5610000-0000-4000-8000-000000000002'$$,
  'service_role, como antes');
reset role;

select * from finish();
rollback;
