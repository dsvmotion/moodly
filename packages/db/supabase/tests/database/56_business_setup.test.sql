-- Ajustes del negocio desde la app (20261113140000, OA04): el org_admin con
-- aal2 crea y cambia servicios (con precio), recursos y lo que hace cada uno,
-- y el horario de sus locales; nadie más. Lo sincronizado desde una
-- integración no se toca desde la app y el horario tiene un formato.
begin;
\ir _fixtures/tenants.psql
select plan(65);

-- ===========================================================================
-- Datos (la plataforma)
-- ===========================================================================
insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc_laser \gset
insert into public.services (organization_id, name, duration_minutes, external_ref) values (:org_a, 'Sincronizado', 30, 'koibox:1') returning id as svc_synced \gset
insert into public.services (organization_id, name, duration_minutes) values (:org_b, 'Corte', 30) returning id as svc_b \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab1 \gset
insert into public.booking_resources (organization_id, location_id, name, kind, external_ref) values (:org_a, :loc_a1, 'Ana (Koibox)', 'staff', 'koibox:7') returning id as res_synced \gset
insert into public.services (organization_id, location_id, name, duration_minutes) values (:org_a, :loc_a2, 'Masaje A2', 60) returning id as svc_a2 \gset
insert into public.resource_services (organization_id, resource_id, service_id) values
  (:org_a, :'cab1', :'svc_laser'), (:org_a, :'res_synced', :'svc_laser'), (:org_a, :'cab1', :'svc_synced');

-- ===========================================================================
-- 1. Estructura
-- ===========================================================================
select has_column('public', 'services', 'price_cents', 'services tiene precio en céntimos');
select col_default_is('public', 'services', 'currency', 'EUR', 'y la moneda es EUR por defecto');
select ok(
  (select convalidated from pg_constraint where conname = 'locations_opening_hours_format'),
  'el formato del horario está validado sobre lo que ya había');
select ok(private.valid_opening_hours('{}'), 'un horario vacío (cerrado) es válido');
select ok(private.valid_opening_hours('{"mon": ["09:00", "14:00"], "sat": ["10:00", "13:30"]}'), 'días con apertura y cierre, válido');
select ok(not private.valid_opening_hours('{"mon": ["14:00", "09:00"]}'), 'cerrar antes de abrir no');
select ok(not private.valid_opening_hours('{"mon": ["09:00", "09:00"]}'), 'abrir y cerrar a la vez no');
select ok(not private.valid_opening_hours('{"monday": ["09:00", "14:00"]}'), 'un día que no existe no');
select ok(not private.valid_opening_hours('{"mon": ["9:00", "14:00"]}'), 'una hora sin el cero no');
select ok(not private.valid_opening_hours('{"mon": ["09:00", "24:00"]}'), 'las 24:00 no');
select ok(not private.valid_opening_hours('{"mon": "09:00-14:00"}'), 'un texto en vez del par no');
select ok(not private.valid_opening_hours('{"mon": ["09:00", "14:00", "16:00"]}'), 'tres horas no');
select ok(not private.valid_opening_hours('{"mon": [9, 14]}'), 'números no');
select ok(not private.valid_opening_hours('[]'), 'una lista no');

-- ===========================================================================
-- 2. org_admin con aal1: lee, pero no cambia nada
-- ===========================================================================
select pg_temp.login(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.services (organization_id, name, duration_minutes) values (%L, 'sin mfa', 30)$$, :org_a),
  '42501', null, 'org_admin aal1: no crea servicios');
with u as (update public.services set price_cents = 1 where id = :'svc_laser' returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no cambia precios') from u;
select throws_ok(
  format($$insert into public.booking_resources (organization_id, location_id, name, kind) values (%L, %L, 'sin mfa', 'staff')$$, :org_a, :loc_a1),
  '42501', null, 'org_admin aal1: no crea recursos');
with d as (delete from public.resource_services where resource_id = :'cab1' returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no quita lo que hace un recurso') from d;
reset role;

-- ===========================================================================
-- 3. org_admin con aal2: sí
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
insert into public.services (organization_id, name, duration_minutes, price_cents, currency)
  values (:org_a, 'Facial', 45, 4500, 'EUR') returning id as svc_facial \gset
select is((select price_cents from public.services where id = :'svc_facial'), 4500, 'org_admin aal2: crea un servicio con precio');
with u as (update public.services set price_cents = 5000, duration_minutes = 60, name = 'Facial completo' where id = :'svc_facial' returning 1)
select is(count(*)::int, 1, 'y lo cambia') from u;
with u as (update public.services set active = false where id = :'svc_laser' returning 1)
select is(count(*)::int, 1, 'y lo desactiva') from u;
update public.services set active = true where id = :'svc_laser';
with u as (update public.services set price_cents = null where id = :'svc_facial' returning 1)
select is(count(*)::int, 1, 'y le quita el precio (sin precio publicado)') from u;
insert into public.booking_resources (organization_id, location_id, name, kind)
  values (:org_a, :loc_a1, 'Marta', 'staff') returning id as marta \gset
select ok(:'marta'::uuid is not null, 'crea un recurso');
with u as (update public.booking_resources set name = 'Marta G.', kind = 'staff' where id = :'marta' returning 1)
select is(count(*)::int, 1, 'y lo cambia') from u;
select lives_ok(
  format($$insert into public.resource_services (organization_id, resource_id, service_id) values (%L, %L, %L)$$, :org_a, :'marta', :'svc_facial'),
  'dice qué servicios hace');
with d as (delete from public.resource_services where resource_id = :'marta' and service_id = :'svc_facial' returning 1)
select is(count(*)::int, 1, 'y lo quita') from d;
with u as (update public.locations set opening_hours = '{"mon": ["10:00", "13:00"]}' where id = :loc_a1 returning 1)
select is(count(*)::int, 1, 'cambia el horario de un local') from u;

-- Lo que no se cambia desde la app.
select throws_ok(
  format($$update public.services set organization_id = %L where id = %L$$, :org_b, :'svc_facial'),
  '42501', null, 'la organización de un servicio no cambia');
select throws_ok(
  format($$update public.services set location_id = %L where id = %L$$, :loc_a2, :'svc_facial'),
  '42501', null, 'ni su local');
select throws_ok(
  format($$update public.services set external_ref = 'x' where id = %L$$, :'svc_facial'),
  '42501', null, 'ni su referencia externa');
select throws_ok(
  format($$insert into public.services (organization_id, name, duration_minutes, external_ref) values (%L, 'falso', 30, 'koibox:9')$$, :org_a),
  '42501', null, 'un servicio nuevo no se hace pasar por sincronizado');
select throws_ok(
  format($$delete from public.services where id = %L$$, :'svc_facial'),
  '42501', null, 'los servicios no se borran: se desactivan');
select throws_ok(
  format($$delete from public.booking_resources where id = %L$$, :'marta'),
  '42501', null, 'los recursos tampoco');
select throws_ok(
  format($$update public.booking_resources set location_id = %L where id = %L$$, :loc_a2, :'marta'),
  '42501', null, 'el local de un recurso no cambia');
select throws_ok(
  format($$update public.services set currency = 'JPY' where id = %L$$, :'svc_facial'),
  '23514', null, 'una moneda fuera de la lista no');
select throws_ok(
  format($$update public.services set price_cents = -1 where id = %L$$, :'svc_facial'),
  '23514', null, 'un precio negativo no');
select throws_ok(
  format($$update public.locations set opening_hours = '{"mon": ["14:00", "09:00"]}' where id = %L$$, :loc_a1),
  '23514', null, 'un horario fuera de formato no');

-- Lo sincronizado desde una integración.
select throws_ok(
  format($$update public.services set price_cents = 100 where id = %L$$, :'svc_synced'),
  '42501', null, 'un servicio sincronizado no se cambia desde la app');
select throws_ok(
  format($$update public.booking_resources set name = 'otra' where id = %L$$, :'res_synced'),
  '42501', null, 'un recurso sincronizado tampoco');
select throws_ok(
  format($$delete from public.resource_services where resource_id = %L$$, :'res_synced'),
  '42501', null, 'ni lo que hace');
select throws_ok(
  format($$insert into public.resource_services (organization_id, resource_id, service_id) values (%L, %L, %L)$$, :org_a, :'res_synced', :'svc_facial'),
  '42501', null, 'ni se le añade nada');
select throws_ok(
  format($$insert into public.resource_services (organization_id, resource_id, service_id) values (%L, %L, %L)$$, :org_a, :'marta', :'svc_synced'),
  '42501', null, 'ni se añade a quién hace un servicio sincronizado');
select throws_ok(
  format($$delete from public.resource_services where resource_id = %L and service_id = %L$$, :'cab1', :'svc_synced'),
  '42501', null, 'ni se quita de quién hace un servicio sincronizado (aunque el recurso no lo sea)');

-- Qué hace un recurso, de una vez (set_resource_services).
select is(public.set_resource_services(:'marta', array[:'svc_facial', :'svc_laser']::uuid[]), 2, 'set_resource_services: añade los que faltan');
select is(public.set_resource_services(:'marta', array[:'svc_laser', :'svc_laser']::uuid[]), 1, 'quita los que sobran, sin repetir');
select is(public.set_resource_services(:'marta', array[:'svc_laser']::uuid[]), 0, 'y sin cambios no toca nada');
select throws_ok(
  format($$select public.set_resource_services(%L, array[%L]::uuid[])$$, :'marta', :'svc_a2'),
  '23514', null, 'un servicio que no se ofrece en su sede, no');
select set_eq(
  format($$select service_id from public.resource_services where resource_id = %L$$, :'marta'),
  format($$values (%L::uuid)$$, :'svc_laser'),
  'y no queda a medias: lo que iba a quitar sigue ahí');
select throws_ok(
  format($$select public.set_resource_services(%L, '{}')$$, :'res_synced'),
  '42501', null, 'lo de un recurso sincronizado no se cambia');
select throws_ok(
  format($$select public.set_resource_services(%L, array[%L]::uuid[])$$, :'cab1', :'svc_laser'),
  '42501', null, 'ni se quita a quién hace un servicio sincronizado');
select is(public.set_resource_services(:'marta', '{}'), 1, 'con la lista vacía, los quita todos');

-- Otra organización.
select throws_ok(
  format($$insert into public.services (organization_id, name, duration_minutes) values (%L, 'ajeno', 30)$$, :org_b),
  '42501', null, 'no crea servicios en otra organización');
with u as (update public.services set price_cents = 1 where id = :'svc_b' returning 1)
select is(count(*)::int, 0, 'ni cambia los suyos') from u;
reset role;

-- ===========================================================================
-- 4. Nadie más
-- ===========================================================================
select pg_temp.login(:a_loc1_mgr) as s \gset
select throws_ok(
  format($$insert into public.services (organization_id, name, duration_minutes) values (%L, 'manager', 30)$$, :org_a),
  '42501', null, 'un location_manager no crea servicios');
with u as (update public.services set price_cents = 1 where id = :'svc_laser' returning 1)
select is(count(*)::int, 0, 'ni cambia precios') from u;
with u as (update public.booking_resources set name = 'x' where id = :'cab1' returning 1)
select is(count(*)::int, 0, 'ni recursos de su local') from u;
select throws_ok(
  format($$select public.set_resource_services(%L, '{}')$$, :'cab1'),
  '42501', null, 'ni cambia lo que hace un recurso de su local');
select throws_ok(
  format($$update public.locations set opening_hours = '{"mon": "todo el día"}' where id = %L$$, :loc_a1),
  '23514', null, 'el horario que sí puede cambiar tiene el mismo formato');
reset role;
select pg_temp.login(:a_staff1) as s \gset
select throws_ok(
  format($$insert into public.booking_resources (organization_id, location_id, name, kind) values (%L, %L, 'staff', 'staff')$$, :org_a, :loc_a1),
  '42501', null, 'el staff no crea recursos');
with d as (delete from public.resource_services where resource_id = :'cab1' returning 1)
select is(count(*)::int, 0, 'ni quita lo que hace un recurso') from d;
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.services set price_cents = 1 where id = :'svc_laser' returning 1)
select is(count(*)::int, 0, 'el org_admin de otra organización no cambia nada de esta') from u;
select throws_ok(
  format($$select public.set_resource_services(%L, '{}')$$, :'cab1'),
  '42501', null, 'ni lo que hace un recurso suyo');
reset role;

-- ===========================================================================
-- 5. Los huecos siguen lo que se configuró
-- ===========================================================================
update public.locations set timezone = 'Europe/Madrid' where id = :loc_a1;
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'marta', :'svc_facial');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_facial', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  9, 'el lunes de 10 a 13, un servicio de 60 minutos con un recurso: cada 15 minutos, 9 huecos');
select is(
  (select min(starts_at) from public.find_booking_slots(:org_a, :loc_a1, :'svc_facial', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)),
  '2030-06-03 08:00+00'::timestamptz, 'el primero a las 10:00 de Madrid');
select is(
  (select count(*)::int from public.find_booking_slots(:org_a, :loc_a1, :'svc_facial', '2030-06-04 00:00+02', '2030-06-05 00:00+02', 50)),
  0, 'el martes, que se quitó, cerrado');

select * from finish();
rollback;
