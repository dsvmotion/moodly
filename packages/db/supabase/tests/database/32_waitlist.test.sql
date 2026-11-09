-- La lista de espera (20261109090000, paso 4f-1): la escribe solo el worker,
-- la lee cada uno lo de su alcance, es coherente (organización, conversación
-- del contacto, servicio del local, recurso que hace el servicio), una entrada
-- viva por contacto, servicio y local, y un hueco ofrecido no se le da a nadie
-- más mientras dura la oferta. Recepción trae de serie join_waitlist.
begin;
\ir _fixtures/tenants.psql
select plan(27);

select a.id as reception_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'reception' \gset
select a.id as reception_b from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_b and t.key = 'reception' \gset
select id as join_skill from public.skills where organization_id is null and key = 'join_waitlist' \gset

update public.locations set timezone = 'Europe/Madrid', opening_hours = '{"mon": ["09:00", "14:00"]}' where id = :loc_a1;
insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc \gset
insert into public.services (organization_id, location_id, name, duration_minutes) values (:org_a, :loc_a2, 'Solo en A2', 30) returning id as svc_a2 \gset
insert into public.services (organization_id, name, duration_minutes) values (:org_b, 'Corte', 30) returning id as svc_b \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab1 \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina sin láser', 'room') returning id as cab_other \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a2, 'Cabina A2', 'room') returning id as cab_a2 \gset
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'cab1', :'svc'), (:org_a, :'cab_a2', :'svc');
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'wl-web-a1', 'reception', 'active') returning id as ca_a \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Carla') returning id as carla \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as bea \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'ana', :'ca_a', :'reception_a') returning id as conv_ana \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'carla', :'ca_a', :'reception_a') returning id as conv_carla \gset

-- ===========================================================================
-- 1. La escribe el worker
-- ===========================================================================
set local role service_role;
insert into public.waitlist_entries (organization_id, location_id, contact_id, conversation_id, service_id, wanted_from, wanted_until, idempotency_key)
values (:org_a, :loc_a1, :'ana', :'conv_ana', :'svc', '2030-06-03 00:00+02', '2030-06-10 00:00+02', 'wl:ana-1') returning id as entry \gset
reset role;
select is((select status from public.waitlist_entries where id = :'entry'), 'waiting', 'el worker apunta a alguien: empieza esperando');

select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-04 00:00+02', 'wl:ana-2')$$, :org_a, :loc_a1, :'ana', :'svc'),
  '23505', null, 'una sola entrada viva por contacto, servicio y local');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, conversation_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-04 00:00+02', 'wl:otra-conv')$$, :org_a, :loc_a1, :'carla', :'conv_ana', :'svc'),
  '23514', 'la conversación no es del contacto de la entrada', 'la conversación tiene que ser del contacto');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-04 00:00+02', 'wl:servicio-a2')$$, :org_a, :loc_a1, :'carla', :'svc_a2'),
  '23514', 'el servicio no se ofrece en ese local', 'el servicio tiene que ofrecerse en el local');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-04 00:00+02', 'wl:otra-org')$$, :org_a, :loc_a1, :'bea', :'svc'),
  '23503', null, 'nunca un contacto de otra organización');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key, status, offered_resource_id, offered_starts_at, offered_ends_at, offer_expires_at)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-04 00:00+02', 'wl:ya-ofrecida', 'offered', %L, '2030-06-03 09:00+02', '2030-06-03 09:30+02', now())$$,
         :org_a, :loc_a1, :'carla', :'svc', :'cab1'),
  '23514', 'una entrada nueva de la lista empieza esperando', 'una entrada nueva empieza esperando');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-03 00:00+02', 'wl:franja-vacia')$$, :org_a, :loc_a1, :'carla', :'svc'),
  '23514', null, 'la franja no puede estar vacía');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-09-03 00:00+02', 'wl:franja-larga')$$, :org_a, :loc_a1, :'carla', :'svc'),
  '23514', null, 'ni pasar de 62 días');

-- ===========================================================================
-- 2. La oferta
-- ===========================================================================
select throws_ok(
  format($$update public.waitlist_entries set status = 'offered' where id = %L$$, :'entry'),
  '23514', null, 'una oferta lleva su hueco y su plazo');
select throws_ok(
  format($$update public.waitlist_entries set status = 'offered', offered_resource_id = %L, offered_starts_at = '2030-06-03 09:00+02',
           offered_ends_at = '2030-06-03 09:30+02', offer_expires_at = now() + interval '30 minutes' where id = %L$$, :'cab_other', :'entry'),
  '23514', 'el recurso ofrecido no es del local o no hace el servicio', 'el recurso ofrecido tiene que hacer el servicio');
select throws_ok(
  format($$update public.waitlist_entries set status = 'offered', offered_resource_id = %L, offered_starts_at = '2030-06-03 09:00+02',
           offered_ends_at = '2030-06-03 09:30+02', offer_expires_at = now() + interval '30 minutes' where id = %L$$, :'cab_a2', :'entry'),
  '23514', 'el recurso ofrecido no es del local o no hace el servicio', 'y ser del local de la entrada');

-- Los huecos del lunes en la Cabina 1, antes de ofrecer nada.
create temp table slots_before as
  select starts_at from public.find_booking_slots(:org_a, :loc_a1, :'svc', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)
  where resource_id = :'cab1';
select ok(exists (select 1 from slots_before where starts_at = '2030-06-03 09:00+02'), 'el lunes a las 9:00 está libre');

set local role service_role;
update public.waitlist_entries set status = 'offered', offered_resource_id = :'cab1', offered_starts_at = '2030-06-03 09:00+02',
  offered_ends_at = '2030-06-03 09:30+02', offer_expires_at = now() + interval '30 minutes' where id = :'entry';
reset role;
select ok(
  not exists (select 1 from public.find_booking_slots(:org_a, :loc_a1, :'svc', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)
              where resource_id = :'cab1' and tstzrange(starts_at, ends_at, '[)') && tstzrange('2030-06-03 09:00+02', '2030-06-03 09:30+02', '[)')),
  'mientras está ofrecido, el hueco no se le da a nadie más (ni lo que se solape)');
select ok(
  exists (select 1 from public.find_booking_slots(:org_a, :loc_a1, :'svc', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)
          where resource_id = :'cab1' and starts_at = '2030-06-03 09:30+02'),
  'el resto de la mañana sigue libre');

update public.waitlist_entries set offer_expires_at = now() - interval '1 minute' where id = :'entry';
select ok(
  exists (select 1 from public.find_booking_slots(:org_a, :loc_a1, :'svc', '2030-06-03 00:00+02', '2030-06-04 00:00+02', 50)
          where resource_id = :'cab1' and starts_at = '2030-06-03 09:00+02'),
  'pasado el plazo, el hueco vuelve a estar libre');

-- Acepta: queda reservada, con el hueco que aceptó como historia.
update public.waitlist_entries set status = 'booked' where id = :'entry';
select is((select row(status, offered_starts_at)::text from public.waitlist_entries where id = :'entry'),
  row('booked'::text, '2030-06-03 09:00+02'::timestamptz)::text, 'reservada, con el hueco que aceptó');
select throws_ok(
  format($$update public.waitlist_entries set status = 'waiting' where id = %L$$, :'entry'),
  '42501', 'una entrada cerrada de la lista ya no cambia', 'una entrada cerrada ya no cambia');
select throws_ok(
  format($$update public.waitlist_entries set service_id = %L where id = %L$$, :'svc_a2', :'entry'),
  '42501', null, 'ni su servicio, su contacto, su local o su organización');

-- Cerrada la primera, se puede volver a apuntar.
set local role service_role;
insert into public.waitlist_entries (organization_id, location_id, contact_id, conversation_id, service_id, wanted_from, wanted_until, idempotency_key)
values (:org_a, :loc_a1, :'ana', :'conv_ana', :'svc', '2030-06-10 00:00+02', '2030-06-17 00:00+02', 'wl:ana-3') returning id as entry2 \gset
reset role;
select is((select count(*)::int from public.waitlist_entries where contact_id = :'ana' and status in ('waiting', 'offered')), 1,
  'cerrada la anterior, se puede volver a apuntar');

-- ===========================================================================
-- 3. La app solo lee, lo de su alcance
-- ===========================================================================
select pg_temp.login(:a_staff1);
select is((select count(*)::int from public.waitlist_entries where id = :'entry2'), 1, 'el equipo de A1 la ve');
select throws_ok(
  format($$update public.waitlist_entries set status = 'cancelled' where id = %L$$, :'entry2'),
  '42501', null, 'pero no la cambia');
select throws_ok(
  format($$insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
           values (%L, %L, %L, %L, '2030-06-03 00:00+02', '2030-06-04 00:00+02', 'wl:desde-la-app')$$, :org_a, :loc_a1, :'carla', :'svc'),
  '42501', null, 'ni apunta a nadie');
reset role;
select pg_temp.login(:b_admin);
select is((select count(*)::int from public.waitlist_entries where id = :'entry2'), 0, 'otra organización no la ve');
reset role;

-- ===========================================================================
-- 4. La skill
-- ===========================================================================
select is(
  (select row(kind, effect_class, default_autonomy, max_autonomy, restricted_to_agent_types, status)::text from public.skills where id = :'join_skill'),
  row('code'::text, 'internal_write'::text, 'execute'::text, 'autonomous'::text, '{reception}'::text[], 'published'::text)::text,
  'join_waitlist: escritura interna, sola (execute) de serie, solo de Recepción, publicada');
select is(
  (select row(autonomy_level, enabled)::text from public.agent_skills where agent_id = :'reception_a' and skill_id = :'join_skill'),
  row('execute'::text, true)::text, 'Recepción la trae de serie, activa');
select is((select count(*)::int from public.agent_skills where agent_id = :'reception_b' and skill_id = :'join_skill' and organization_id = :org_b), 1,
  'en cada organización');
select is(
  (select count(*)::int from public.agents a join public.agent_types t on t.id = a.agent_type_id and t.key = 'reception'
   where not exists (select 1 from public.agent_skills g where g.agent_id = a.id and g.skill_id = :'join_skill')),
  0, 'ningún agente de Recepción se queda sin ella, tampoco los que ya existían');

select * from finish();
rollback;
