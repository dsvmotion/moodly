-- La hora de una cita de un agente (20261111210000, R-08): al reservar o mover,
-- tiene que ser un hueco libre de find_booking_slots: en el futuro, dentro del
-- horario del local en su zona horaria, en la cuadrícula de 15 minutos y con el
-- recurso libre. El equipo (user) y los calendarios externos (sync) no pasan
-- por esa comprobación. Un hueco ocupado sigue siendo 23P01.
begin;
\ir _fixtures/tenants.psql
select plan(27);

update public.locations set timezone = 'Europe/Madrid',
  opening_hours = '{"mon": ["09:00", "14:00"], "tue": ["09:00", "14:00"], "wed": ["09:00", "14:00"]}'
where id = :loc_a1;

insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab1 \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 2', 'room') returning id as cab2 \gset
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'cab1', :'svc'), (:org_a, :'cab2', :'svc');
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Luis') returning id as luis \gset

-- 2030-06-03 es lunes (UTC+2 en Madrid): abre a las 9:00 = 07:00 UTC.
create temp table ids (k text primary key, v uuid not null);
insert into ids values ('org', :org_a), ('loc', :loc_a1), ('svc', :'svc'), ('cab1', :'cab1'), ('cab2', :'cab2'), ('ana', :'ana'), ('luis', :'luis');
create function pg_temp.book(p_key text, p_at timestamptz, p_by text default 'agent', p_resource text default 'cab1', p_contact text default 'ana')
returns void language sql as $$
  insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
  select (select v from ids where k = 'org'), (select v from ids where k = 'loc'), (select v from ids where k = 'svc'),
         (select v from ids where k = p_resource), (select v from ids where k = p_contact), p_at, p_key, p_by
$$;

-- Como el worker: con su clave secreta (service_role), por donde reserva el agente.
grant select on ids to service_role;
grant execute on function pg_temp.book(text, timestamptz, text, text, text) to service_role;
set local role service_role;

-- ===========================================================================
-- 1. Reservar: lo que se rechaza
-- ===========================================================================
select throws_ok($$select pg_temp.book('slot:pasado-1', '2020-06-01 07:00+00')$$, 'BK001', 'la hora de la cita ya ha pasado',
  'una cita de un agente en el pasado, aunque sea en horario, se rechaza');
select throws_ok($$select pg_temp.book('slot:cerrado-1', '2030-06-03 01:00+00')$$, 'BK001', null,
  'a las 3:00 de Madrid (cerrado) se rechaza');
select throws_ok($$select pg_temp.book('slot:domingo-1', '2030-06-02 08:00+00')$$, 'BK001', null,
  'un domingo, cerrado, se rechaza');
select throws_ok($$select pg_temp.book('slot:fuera-grid-1', '2030-06-03 07:10+00')$$, 'BK001', null,
  'a las 9:10, fuera de la cuadrícula de 15 minutos de la ventana, se rechaza');
select throws_ok($$select pg_temp.book('slot:pasa-cierre-1', '2030-06-03 11:45+00')$$, 'BK001', null,
  'una cita que terminaría después de cerrar (13:45 + 30 minutos) se rechaza');
select throws_ok($$select pg_temp.book('slot:antes-apertura-1', '2030-06-03 06:45+00')$$, 'BK001', null,
  'y una que empieza antes de abrir (8:45)');
select is((select count(*)::int from public.appointments where idempotency_key like 'slot:%'), 0, 'ninguna de las rechazadas dejó cita');

-- ===========================================================================
-- 2. Reservar: lo que se acepta
-- ===========================================================================
select lives_ok($$select pg_temp.book('slot:ok-1', '2030-06-03 07:00+00')$$, 'la primera hora del lunes se acepta');
select lives_ok($$select pg_temp.book('slot:ok-2', '2030-06-03 11:30+00')$$, 'y la última (13:30 + 30 minutos = cierre)');
select lives_ok($$select pg_temp.book('slot:ok-3', '2030-06-03 08:15+00', 'agent', 'cab2')$$, 'y una en la cuadrícula del otro recurso');
select throws_ok($$select pg_temp.book('slot:ocupado-1', '2030-06-03 07:00+00', 'agent', 'cab1', 'luis')$$, '23P01', null,
  'un hueco ocupado sigue siendo 23P01 (hueco ocupado), no «hora no disponible»');
select lives_ok($$select pg_temp.book('slot:cab2-mismo-1', '2030-06-03 07:00+00', 'agent', 'cab2', 'luis')$$,
  'la misma hora en el otro recurso, libre, se acepta');

-- ===========================================================================
-- 3. Mover
-- ===========================================================================
select id as appt from public.appointments where idempotency_key = 'slot:ok-1' \gset
select throws_ok(format($$update public.appointments set starts_at = '2020-06-01 07:00+00' where id = %L$$, :'appt'),
  'BK001', 'la hora de la cita ya ha pasado', 'mover una cita al pasado se rechaza');
select throws_ok(format($$update public.appointments set starts_at = '2030-06-03 01:00+00' where id = %L$$, :'appt'),
  'BK001', null, 'mover una cita a las 3:00 se rechaza');
select throws_ok(format($$update public.appointments set starts_at = '2030-06-03 07:20+00' where id = %L$$, :'appt'),
  'BK001', null, 'mover una cita fuera de la cuadrícula se rechaza');
select throws_ok(format($$update public.appointments set starts_at = '2030-06-03 11:30+00' where id = %L$$, :'appt'),
  '23P01', null, 'mover una cita a un hueco ocupado sigue siendo 23P01');
select lives_ok(format($$update public.appointments set starts_at = '2030-06-03 07:15+00' where id = %L$$, :'appt'),
  'mover una cita 15 minutos, solapándose con su propia hora anterior, se acepta (no se cuenta a sí misma)');
select lives_ok(format($$update public.appointments set starts_at = '2030-06-04 09:00+00' where id = %L$$, :'appt'),
  'mover una cita a otro día, dentro de horario, se acepta');
select lives_ok(format($$update public.appointments set status = 'cancelled' where id = %L$$, :'appt'),
  'cancelar no vuelve a comprobar la hora');

-- ===========================================================================
-- 4. Quien no es un agente no pasa por la comprobación
-- ===========================================================================
select lives_ok($$select pg_temp.book('slot:equipo-1', '2020-06-01 01:00+00', 'user', 'cab2')$$,
  'el equipo puede apuntar una cita fuera de horario y ya pasada');
select lives_ok($$select pg_temp.book('slot:sync-1', '2020-06-01 03:10+00', 'sync', 'cab2')$$,
  'y un calendario externo refleja lo que ya existe allí');

-- ===========================================================================
-- 5. La lista de espera: el hueco ofrecido a este contacto
-- ===========================================================================
reset role;
insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
values (:org_a, :loc_a1, :'luis', :'svc', '2030-06-04 00:00+00', '2030-06-05 00:00+00', 'slot:espera-luis') returning id as entry \gset
update public.waitlist_entries set status = 'offered', offered_resource_id = :'cab1', offered_starts_at = '2030-06-04 10:00+00',
  offered_ends_at = '2030-06-04 10:30+00', offer_expires_at = now() + interval '30 minutes' where id = :'entry';
set local role service_role;
select throws_ok($$select pg_temp.book('slot:oferta-otra-1', '2030-06-04 10:00+00', 'agent', 'cab1', 'ana')$$, 'BK001', null,
  'el hueco que se le ofreció a Luis no lo reserva otra persona');
select lives_ok($$select pg_temp.book('slot:oferta-luis-1', '2030-06-04 10:00+00', 'agent', 'cab1', 'luis')$$,
  'pero Luis, a quien se le ofreció, sí');

-- ===========================================================================
-- 6. Una conexión directa de plataforma no queda bloqueada (como las guardas, ADR 0003)
-- ===========================================================================
reset role;
select lives_ok($$select pg_temp.book('slot:plataforma-1', '2020-06-01 01:00+00', 'agent', 'cab1')$$,
  'una conexión directa de plataforma (migraciones, seed) puede escribir una cita de agente a cualquier hora');

-- ===========================================================================
-- 7. Nadie de la app puede hacerse pasar por un agente para saltarse la comprobación
-- ===========================================================================
-- La app solo lee las citas: authenticated no puede escribirlas, ni reservar
-- con booked_by = 'agent' ni cambiar el origen de una cita existente.
select ok(not has_table_privilege('authenticated', 'public.appointments', 'insert')
          and not has_table_privilege('authenticated', 'public.appointments', 'update')
          and not has_table_privilege('authenticated', 'public.appointments', 'delete'),
  'authenticated no tiene privilegios de escritura sobre appointments: la comprobación no depende de lo que declare booked_by');
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2020-06-01 01:00+00', 'slot:app-agente', 'agent')$$, :org_a, :loc_a1, :'svc', :'cab1', :'ana'),
  '42501', null, 'un org_admin con MFA no reserva a mano como «agent» (ni a las 3:00 ni en el pasado)');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, '2020-06-01 01:00+00', 'slot:app-user', 'user')$$, :org_a, :loc_a1, :'svc', :'cab1', :'ana'),
  '42501', null, 'ni como «user»: la app no escribe citas (las escribe el worker)');
reset role;

select * from finish();
rollback;
