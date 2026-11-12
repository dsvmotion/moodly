-- Lo que necesitan los recordatorios (20261108090000, paso 4e-1): la cita
-- guarda la conversación en la que la reservó el agente (de su organización y
-- de su contacto, y no cambia), y Recepción trae de serie la skill
-- appointment_reminder, que sale sola (execute) y no puede ir más allá.
begin;
\ir _fixtures/tenants.psql
select plan(18);

select a.id as reception_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'reception' \gset
select a.id as customer_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'customer' \gset
select a.id as reception_b from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_b and t.key = 'reception' \gset
select id as reminder from public.skills where organization_id is null and key = 'appointment_reminder' \gset

-- Las citas de un agente van en un hueco libre (20261111210000, R-08): el local abre de lunes a viernes.
update public.locations set timezone = 'Europe/Madrid',
  opening_hours = '{"mon": ["09:00", "14:00"], "tue": ["09:00", "14:00"], "wed": ["09:00", "14:00"], "thu": ["09:00", "14:00"], "fri": ["09:00", "14:00"]}'
where id = :loc_a1;
insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab \gset
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'cab', :'svc');
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'rem-web-a1', 'reception', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'webchat', 'rem-web-b1', 'reception', 'active') returning id as ca_b \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Carla') returning id as carla \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as bea \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'ana', :'ca_a', :'reception_a') returning id as conv_ana \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'carla', :'ca_a', :'reception_a') returning id as conv_carla \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'bea', :'ca_b', :'reception_b') returning id as conv_bea \gset

-- ===========================================================================
-- 1. La conversación de la reserva
-- ===========================================================================
-- Como el worker: con su clave secreta (service_role).
set local role service_role;
insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, conversation_id, starts_at, idempotency_key, booked_by)
values (:org_a, :loc_a1, :'svc', :'cab', :'ana', :'conv_ana', '2030-06-03 09:00+02', 'rem:reserva-1', 'agent') returning id as appt \gset
reset role;
select is((select conversation_id from public.appointments where id = :'appt'), :'conv_ana'::uuid,
  'la cita guarda la conversación en la que se reservó');

select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, conversation_id, starts_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, %L, '2030-06-03 10:00+02', 'rem:otra-org', 'agent')$$,
    :org_a, :loc_a1, :'svc', :'cab', :'ana', :'conv_bea'),
  '23514', 'la conversación no es del contacto de la cita', 'no puede ser una conversación de otra organización (y si el trigger fallara, la clave compuesta)');
select throws_ok(
  format($$insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, conversation_id, starts_at, idempotency_key, booked_by)
           values (%L, %L, %L, %L, %L, %L, '2030-06-03 10:00+02', 'rem:otro-contacto', 'agent')$$,
    :org_a, :loc_a1, :'svc', :'cab', :'ana', :'conv_carla'),
  '23514', 'la conversación no es del contacto de la cita', 'ni la de otro contacto de la misma organización');

insert into public.appointments (organization_id, location_id, service_id, resource_id, contact_id, starts_at, idempotency_key, booked_by)
values (:org_a, :loc_a1, :'svc', :'cab', :'carla', '2030-06-03 11:00+02', 'rem:del-equipo', 'user') returning id as appt_staff \gset
select is((select conversation_id from public.appointments where id = :'appt_staff'), null,
  'una cita que no reservó el agente no tiene conversación');

select throws_ok(
  format($$update public.appointments set conversation_id = %L where id = %L$$, :'conv_carla', :'appt_staff'),
  '42501', 'la conversación en la que se reservó una cita no cambia', 'no se le pone después');
select lives_ok(
  format($$update public.appointments set starts_at = '2030-06-03 12:00+02' where id = %L$$, :'appt'),
  'moverla no toca la conversación');
select is((select conversation_id from public.appointments where id = :'appt'), :'conv_ana'::uuid,
  'que sigue siendo la misma');

update public.appointments set status = 'cancelled' where id = :'appt';
select is((select conversation_id from public.appointments where id = :'appt'), :'conv_ana'::uuid,
  'cancelarla tampoco');

delete from public.conversations where id = :'conv_ana';
select is((select row(status, conversation_id)::text from public.appointments where id = :'appt'),
  row('cancelled'::text, null::uuid)::text,
  'si se borra la conversación, la cita se queda, sin ella');

-- ===========================================================================
-- 2. La skill de los recordatorios
-- ===========================================================================
select is(
  (select row(kind, effect_class, default_autonomy, max_autonomy, restricted_to_agent_types, status)::text
   from public.skills where id = :'reminder'),
  row('code'::text, 'external_outreach'::text, 'execute'::text, 'execute'::text, '{reception}'::text[], 'published'::text)::text,
  'appointment_reminder: de código, envío a clientes, sola (execute) como mucho, solo de Recepción, publicada');
select is(
  (select row(autonomy_level, enabled)::text from public.agent_skills where agent_id = :'reception_a' and skill_id = :'reminder'),
  row('execute'::text, true)::text,
  'Recepción la trae de serie, activa y sola');
select is((select count(*)::int from public.agent_skills where agent_id = :'reception_b' and skill_id = :'reminder' and organization_id = :org_b), 1,
  'en cada organización, con la organización de su agente');
select is((select count(*)::int from public.agent_skills where agent_id = :'customer_a' and skill_id = :'reminder'), 0,
  'Atención al cliente no');
select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level) values (%L, %L, %L, 'execute')$$,
    :'customer_a', :'reminder', :org_a),
  '23514', null, 'ni se le puede dar');
select throws_ok(
  format($$update public.agent_skills set autonomy_level = 'autonomous' where agent_id = %L and skill_id = %L$$, :'reception_a', :'reminder'),
  '23514', null, 'y no pasa de execute: el techo de la clase');
select is(
  (select count(*)::int from public.agents a join public.agent_types t on t.id = a.agent_type_id and t.key = 'reception'
   where not exists (select 1 from public.agent_skills g where g.agent_id = a.id and g.skill_id = :'reminder')),
  0, 'ningún agente de Recepción se queda sin ella, tampoco los que ya existían');

-- ===========================================================================
-- 3. Nadie de la app escribe en las citas
-- ===========================================================================
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$update public.appointments set conversation_id = null where id = %L$$, :'appt_staff'),
  '42501', null, 'ni un org_admin con MFA');
reset role;
select ok(not has_column_privilege('authenticated', 'public.appointments', 'conversation_id', 'update'),
  'authenticated no tiene privilegio sobre la columna');

select * from finish();
rollback;
