-- Los eventos de las citas (20261104120000, paso 4e-0): reservar, mover y
-- cancelar una cita viva emiten su evento en la misma transacción, con la
-- organización y el local de la fila y solo ids y horas en el payload; lo demás
-- no emite nada. Nadie de la app puede escribir eventos ni llamar a la función.
begin;
\ir _fixtures/tenants.psql
select plan(15);

insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc \gset
insert into public.services (organization_id, name, duration_minutes) values (:org_b, 'Corte', 30) returning id as svc_b \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab1 \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 2', 'room') returning id as cab2 \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_b, :loc_b1, 'Sillón', 'room') returning id as chair \gset
insert into public.resource_services (organization_id, resource_id, service_id) values
  (:org_a, :'cab1', :'svc'), (:org_a, :'cab2', :'svc'), (:org_b, :'chair', :'svc_b');
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as bea \gset

-- Solo cuentan las organizaciones del fixture: la base local puede tener el seed.
create temp view fixture_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b) and type like 'appointment.%';

-- ===========================================================================
-- 1. Nadie de la app puede emitirlos
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'private.emit_appointment_event()'::regprocedure),
  'emit_appointment_event es security definer (escribe el evento por quien no tiene privilegios)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.emit_appointment_event()', 'execute')),
  null, 'nadie de la app puede ejecutar emit_appointment_event');
select ok(not has_table_privilege('authenticated', 'public.domain_events', 'insert')
          and not has_table_privilege('service_role', 'public.domain_events', 'insert'),
  'y nadie de la app escribe en domain_events');

-- ===========================================================================
-- 2. Reservar
-- ===========================================================================
insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
values (:org_a, :loc_a1, :'svc', :'cab1', :'ana', '2030-06-03 09:00+02', 'evt:reserva-1', 'agent') returning id as appt \gset

select is(
  (select row(type, location_id, payload)::text from fixture_events where payload ->> 'appointment_id' = :'appt'),
  row('appointment.created'::text, :loc_a1::uuid,
      jsonb_build_object('appointment_id', :'appt'::uuid, 'starts_at', '2030-06-03 09:00+02'::timestamptz))::text,
  'reservar emite appointment.created con el local de la cita y solo el id y la hora');

-- Una cita de otra organización: su evento, con su organización y su local.
insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
values (:org_b, :loc_b1, :'svc_b', :'chair', :'bea', '2030-06-03 10:00+02', 'evt:reserva-b', 'user') returning id as appt_b \gset
select is(
  (select row(organization_id, location_id, type)::text from fixture_events where payload ->> 'appointment_id' = :'appt_b'),
  row(:org_b::uuid, :loc_b1::uuid, 'appointment.created'::text)::text,
  'cada evento, con la organización y el local de su fila');

-- ===========================================================================
-- 3. Mover
-- ===========================================================================
update public.appointments set starts_at = '2030-06-03 11:00+02' where id = :'appt';
select is(
  (select payload from fixture_events where payload ->> 'appointment_id' = :'appt' and type = 'appointment.rescheduled'),
  jsonb_build_object('appointment_id', :'appt'::uuid, 'starts_at', '2030-06-03 11:00+02'::timestamptz,
                     'previous_starts_at', '2030-06-03 09:00+02'::timestamptz),
  'mover la hora emite appointment.rescheduled con la hora nueva y la anterior');

update public.appointments set resource_id = :'cab2' where id = :'appt';
select is(
  (select count(*)::int from fixture_events where payload ->> 'appointment_id' = :'appt' and type = 'appointment.rescheduled'),
  2, 'cambiar solo de recurso también es moverla');

-- Lo que no cambia la cita para el cliente no emite nada.
update public.appointments set synced_at = now(), external_ref = 'ext-1' where id = :'appt';
select is((select count(*)::int from fixture_events where payload ->> 'appointment_id' = :'appt'), 3,
  'sincronizarla no emite nada');

-- ===========================================================================
-- 4. Cancelar
-- ===========================================================================
update public.appointments set status = 'cancelled' where id = :'appt';
select is(
  (select row(type, location_id, payload)::text from fixture_events
   where payload ->> 'appointment_id' = :'appt' and type = 'appointment.cancelled'),
  row('appointment.cancelled'::text, :loc_a1::uuid,
      jsonb_build_object('appointment_id', :'appt'::uuid, 'starts_at', '2030-06-03 11:00+02'::timestamptz))::text,
  'cancelar emite appointment.cancelled con la hora que queda libre');
select is((select count(*)::int from fixture_events where payload ->> 'appointment_id' = :'appt'), 4,
  'un evento por cambio: reservar, mover dos veces y cancelar');
update public.appointments set synced_at = now() where id = :'appt';
select is((select count(*)::int from fixture_events where payload ->> 'appointment_id' = :'appt'), 4,
  'sincronizar una cita ya cancelada no la vuelve a cancelar');

-- ===========================================================================
-- 5. Lo demás no emite nada
-- ===========================================================================
insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by, status)
values (:org_a, :loc_a1, :'svc', :'cab1', :'ana', '2030-06-04 09:00+02', 'evt:ya-cancelada', 'sync', 'cancelled') returning id as appt_cancelled \gset
select is((select count(*)::int from fixture_events where payload ->> 'appointment_id' = :'appt_cancelled'), 0,
  'una cita que llega ya cancelada (sincronizada) no emite appointment.created');

insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
values (:org_a, :loc_a1, :'svc', :'cab1', :'ana', '2030-06-05 09:00+02', 'evt:completada', 'agent') returning id as appt_done \gset
update public.appointments set status = 'completed' where id = :'appt_done';
select is(
  (select array_agg(type order by created_at) from fixture_events where payload ->> 'appointment_id' = :'appt_done'),
  array['appointment.created'], 'completarla no emite nada todavía (nadie lo consume)');

-- ===========================================================================
-- 6. Una cita la reserva el worker (service_role): su evento sale igual
-- ===========================================================================
set local role service_role;
insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
values (:org_a, :loc_a1, :'svc', :'cab2', :'ana', '2030-06-06 09:00+02', 'evt:worker', 'agent');
reset role;
select is(
  (select count(*)::int from fixture_events e join public.appointments a on a.id = (e.payload ->> 'appointment_id')::uuid
   where a.idempotency_key = 'evt:worker' and e.type = 'appointment.created'),
  1, 'con la clave secreta del worker, que no puede escribir eventos, el evento sale igual');
select is(
  (select count(*)::int from fixture_events where not (payload ?| array['appointment_id']) or payload ? 'contact_id'),
  0, 'ningún evento de cita lleva el contacto ni datos personales');

select * from finish();
rollback;
