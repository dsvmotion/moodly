-- La referencia de la oferta (20261109150000, paso 4f-3): el workflow que hizo
-- la oferta en curso, para despertarlo cuando se reserva el hueco o se rechaza
-- la reserva de quien la aceptó. La pone y la quita solo el worker.
begin;
\ir _fixtures/tenants.psql
select plan(6);

insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab \gset
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'cab', :'svc');
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset

select has_column('public', 'waitlist_entries', 'offer_ref', 'la entrada guarda qué workflow hizo su oferta');

set local role service_role;
insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
values (:org_a, :loc_a1, :'ana', :'svc', '2030-06-03 00:00+02', '2030-06-10 00:00+02', 'ref:entrada-1') returning id as entry \gset
update public.waitlist_entries
set status = 'offered', offered_resource_id = :'cab', offered_starts_at = '2030-06-04 10:00+02',
    offered_ends_at = '2030-06-04 10:30+02', offer_expires_at = '2030-06-03 12:30+02', offer_ref = 'waitlist:cita-cancelada'
where id = :'entry';
select is((select offer_ref from public.waitlist_entries where id = :'entry'), 'waitlist:cita-cancelada',
  'el worker la pone al ofrecer');

-- Al aceptar, la oferta se alarga mientras la reserva espera a una persona.
update public.waitlist_entries set offer_expires_at = '2030-06-04 10:00+02' where id = :'entry' and offer_expires_at = '2030-06-03 12:30+02';
select is((select offer_expires_at from public.waitlist_entries where id = :'entry'), '2030-06-04 10:00+02'::timestamptz,
  'y alarga el plazo mientras la reserva espera a una persona');

select throws_ok(
  format($$update public.waitlist_entries set offer_ref = '' where id = %L$$, :'entry'),
  '23514', null, 'una referencia vacía no vale');

update public.waitlist_entries
set status = 'waiting', offered_resource_id = null, offered_starts_at = null, offered_ends_at = null, offer_expires_at = null, offer_ref = null
where id = :'entry';
select is((select offer_ref from public.waitlist_entries where id = :'entry'), null, 'y la quita al retirar la oferta');
reset role;

select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$update public.waitlist_entries set offer_ref = 'waitlist:otra' where id = %L$$, :'entry'),
  '42501', null, 'nadie de la app la cambia, ni un org_admin con MFA');
reset role;

select * from finish();
rollback;
