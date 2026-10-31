-- Reservas con el calendario propio (20261031140000, paso 4b). Los huecos
-- respetan el horario y la zona horaria del local (cambio de hora incluido);
-- la base de datos nunca deja dos citas solapadas del mismo recurso ni dos
-- citas para la misma petición; cada uno ve lo de su alcance y la app solo lee.
begin;
\ir _fixtures/tenants.psql
select plan(34);

-- ===========================================================================
-- Datos (la plataforma)
-- ===========================================================================
update public.locations set timezone = 'Europe/Madrid',
  opening_hours = '{"mon": ["09:00", "14:00"], "tue": ["09:00", "14:00"], "wed": ["09:00", "14:00"], "thu": ["09:00", "14:00"], "fri": ["09:00", "14:00"]}'
where id in (:loc_a1, :loc_a2);

insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc_laser \gset
insert into public.services (organization_id, location_id, name, duration_minutes) values (:org_a, :loc_a2, 'Masaje', 60) returning id as svc_massage \gset
insert into public.services (organization_id, name, duration_minutes) values (:org_b, 'Corte', 30) returning id as svc_b \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab1 \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 2', 'room') returning id as cab2 \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a2, 'Sala', 'room') returning id as sala \gset
insert into public.resource_services (organization_id, resource_id, service_id) values
  (:org_a, :'cab1', :'svc_laser'), (:org_a, :'cab2', :'svc_laser'), (:org_a, :'sala', :'svc_massage');
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Luis') returning id as luis \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as bea \gset

-- ===========================================================================
-- 1. Huecos
-- ===========================================================================
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  38, 'un lunes de 9 a 14 con dos cabinas: cada 15 minutos, 19 huecos de 30 minutos por cabina');
select is(
  (select min(starts_at) from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  '2030-06-03 07:00+00'::timestamptz, 'el primero, a las 9:00 de Madrid (UTC+2 en verano)');
select is(
  (select max(ends_at) from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  '2030-06-03 12:00+00'::timestamptz, 'y el último termina al cerrar, a las 14:00');
select is(
  (select min(starts_at) from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-03-25 00:00+01', '2030-03-26 00:00+01', 50)),
  '2030-03-25 08:00+00'::timestamptz, 'antes del cambio de hora, las 9:00 son las 8:00 UTC');
select is(
  (select min(starts_at) from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-04-01 00:00+02', '2030-04-02 00:00+02', 50)),
  '2030-04-01 07:00+00'::timestamptz, 'y después, las 7:00 UTC');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-06-02 00:00+02', '2030-06-03 00:00+02', 50)),
  0, 'el domingo, cerrado, no hay huecos');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_massage', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  0, 'ni de un servicio que no se ofrece en ese local');
select is(
  (select count(*)::int from public.find_booking_slots(:org_b, :loc_a1, :'svc_laser', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  0, 'ni con la organización de otro');
-- Un servicio que pasa a ofrecerse solo en otro local, con recursos que ya lo hacían.
insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Peeling', 30) returning id as svc_peel \gset
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'cab1', :'svc_peel');
update public.services set location_id = :loc_a2 where id = :'svc_peel';
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_peel', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  0, 'ni de un servicio que ha dejado de ofrecerse en ese local, aunque sus recursos lo hicieran');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-03 08:00+00', '2030-06-03 08:30+00', 'run-0:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_peel', :'cab1', :'ana'),
  '23514', null, 'y no se puede reservar');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2020-06-01 00:00+02', '2020-06-02 00:00+02', 50)),
  0, 'ni en el pasado');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 5)),
  5, 'devuelve como mucho los pedidos');

-- ===========================================================================
-- 2. Citas: sin solapes ni duplicados
-- ===========================================================================
insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
values (:org_a, :loc_a1, :'svc_laser', :'cab1', :'ana', '2030-06-03 07:00+00', '2030-06-03 23:00+00', 'run-1:book-1', 'agent')
returning id as appt1 \gset
select is((select ends_at from public.appointments where id = :'appt1'), '2030-06-03 07:30+00'::timestamptz,
  'la hora de fin la pone la base de datos con la duración del servicio');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_laser', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  36, 'una cita ocupa su hueco y el que se solapa con ella (el de las 9:15), no más: el de las 9:30 sigue libre');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-03 07:15+00', '2030-06-03 07:45+00', 'run-2:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_laser', :'cab1', :'ana'),
  '23P01', null, 'nunca dos citas solapadas del mismo recurso');
select lives_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-03 07:15+00', '2030-06-03 07:45+00', 'run-3:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_laser', :'cab2', :'ana'),
  'otro recurso, a la misma hora, sí');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-03 10:00+00', '2030-06-03 10:30+00', 'run-1:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_laser', :'cab1', :'ana'),
  '23505', null, 'la misma petición crea una sola cita: reintentar no duplica');

update public.appointments set status = 'cancelled' where id = :'appt1';
select isnt((select cancelled_at from public.appointments where id = :'appt1'), null, 'al cancelar, la base de datos pone cuándo');
select lives_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-03 07:00+00', '2030-06-03 07:30+00', 'run-4:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_laser', :'cab1', :'ana'),
  'y el hueco cancelado vuelve a estar libre');
select throws_ok(
  format($$update public.appointments set status = 'booked' where id = %L$$, :'appt1'),
  '42501', null, 'una cita cancelada no vuelve: reservar otra vez es otra cita');
select throws_ok(
  format($$update public.appointments set resource_id = %L where idempotency_key = 'run-3:book-1'$$, :'cab1'),
  '23P01', null, 'mover una cita (aquí, a la otra cabina) también respeta los solapes');
update public.appointments set starts_at = '2030-06-03 09:00+00' where idempotency_key = 'run-3:book-1';
select is((select ends_at from public.appointments where idempotency_key = 'run-3:book-1'), '2030-06-03 09:30+00'::timestamptz,
  'y al moverla se recalcula el fin');
select throws_ok(
  format($$update public.appointments set contact_id = %L where id = %L$$, :'luis', :'appt1'),
  '42501', null, 'el contacto de una cita no cambia');

select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-04 07:00+00', '2030-06-04 07:30+00', 'run-5:book-1', 'agent')$$,
         :org_a, :loc_a2, :'svc_laser', :'cab1', :'ana'),
  '23514', null, 'el recurso es del local de la cita');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-04 07:00+00', '2030-06-04 08:00+00', 'run-6:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_massage', :'cab1', :'ana'),
  '23514', null, 'y el servicio se ofrece en ese local');
select throws_ok(
  format($$insert into public.resource_services (organization_id, resource_id, service_id) values (%L, %L, %L)$$, :org_a, :'cab1', :'svc_massage'),
  '23514', null, 'un recurso solo hace servicios de su local');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, ends_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2030-06-04 07:00+00', '2030-06-04 07:30+00', 'run-7:book-1', 'agent')$$,
         :org_a, :loc_a1, :'svc_laser', :'cab1', :'bea'),
  '23503', null, 'nunca con un contacto de otra organización');

-- ===========================================================================
-- 3. Quién ve qué
-- ===========================================================================
select pg_temp.login(:a_loc1_mgr) as s \gset
select is((select count(*)::int from public.appointments), 3, 'un location_manager ve las citas de su local');
select set_eq($$select name from public.services$$, $$values ('Láser')$$, 'y los servicios de toda la organización, no los de otro local');
select is((select count(*)::int from public.booking_resources), 2, 'y los recursos de su local');
reset role;
select pg_temp.login(:a_staff2) as s \gset
select is((select count(*)::int from public.appointments), 0, 'el staff de otro local no ve esas citas');
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
select is((select count(*)::int from public.appointments) + (select count(*)::int from public.booking_resources), 0,
  'ni otra organización');
select throws_ok(
  format($$select * from public.find_booking_slots(%L, %L, %L, now(), now() + interval '1 day', 5)$$, :org_a, :loc_a1, :'svc_laser'),
  '42501', null, 'la app no busca huecos directamente: es del runtime');
reset role;
select ok(
  not exists (
    select 1 from unnest(array['services', 'booking_resources', 'resource_services', 'appointments']) t
    where has_table_privilege('authenticated', 'public.' || t, 'insert')
       or has_table_privilege('authenticated', 'public.' || t, 'update')
       or has_table_privilege('authenticated', 'public.' || t, 'delete')
  ),
  'la app no escribe en ninguna de las tablas de reservas');

select * from finish();
rollback;
