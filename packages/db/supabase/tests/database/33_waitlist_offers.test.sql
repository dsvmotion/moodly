-- La oferta de la lista de espera (20261109120000, paso 4f-2): Recepción trae
-- de serie la skill waitlist_offer, que sale sola (execute) y no puede ir más
-- allá; y lo que hace el worker con una entrada al ofrecerle un hueco.
begin;
\ir _fixtures/tenants.psql
select plan(14);

select a.id as reception_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'reception' \gset
select a.id as customer_a from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'customer' \gset
select a.id as reception_b from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_b and t.key = 'reception' \gset
select id as offer_skill from public.skills where organization_id is null and key = 'waitlist_offer' \gset

-- ===========================================================================
-- 1. La skill de las ofertas
-- ===========================================================================
select is(
  (select row(kind, effect_class, default_autonomy, max_autonomy, restricted_to_agent_types, status)::text
   from public.skills where id = :'offer_skill'),
  row('code'::text, 'external_outreach'::text, 'execute'::text, 'execute'::text, '{reception}'::text[], 'published'::text)::text,
  'waitlist_offer: de código, envío a clientes, sola (execute) como mucho, solo de Recepción, publicada');
select is(
  (select row(autonomy_level, enabled)::text from public.agent_skills where agent_id = :'reception_a' and skill_id = :'offer_skill'),
  row('execute'::text, true)::text,
  'Recepción la trae de serie, activa y sola');
select is((select count(*)::int from public.agent_skills where agent_id = :'reception_b' and skill_id = :'offer_skill' and organization_id = :org_b), 1,
  'en cada organización, con la organización de su agente');
select is((select count(*)::int from public.agent_skills where agent_id = :'customer_a' and skill_id = :'offer_skill'), 0,
  'Atención al cliente no');
select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level) values (%L, %L, %L, 'execute')$$,
    :'customer_a', :'offer_skill', :org_a),
  '23514', null, 'ni se le puede dar');
select throws_ok(
  format($$update public.agent_skills set autonomy_level = 'autonomous' where agent_id = %L and skill_id = %L$$, :'reception_a', :'offer_skill'),
  '23514', null, 'y no pasa de execute: el techo de la clase');
select is(
  (select count(*)::int from public.agents a join public.agent_types t on t.id = a.agent_type_id and t.key = 'reception'
   where not exists (select 1 from public.agent_skills g where g.agent_id = a.id and g.skill_id = :'offer_skill')),
  0, 'ningún agente de Recepción se queda sin ella, tampoco los que ya existían');

-- ===========================================================================
-- 2. Lo que hace el worker con una entrada (con su clave secreta)
-- ===========================================================================
insert into public.services (organization_id, name, duration_minutes) values (:org_a, 'Láser', 30) returning id as svc \gset
insert into public.booking_resources (organization_id, location_id, name, kind) values (:org_a, :loc_a1, 'Cabina 1', 'room') returning id as cab \gset
insert into public.resource_services (organization_id, resource_id, service_id) values (:org_a, :'cab', :'svc');
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as ana \gset

set local role service_role;
insert into public.waitlist_entries (organization_id, location_id, contact_id, service_id, wanted_from, wanted_until, idempotency_key)
values (:org_a, :loc_a1, :'ana', :'svc', '2030-06-03 00:00+02', '2030-06-10 00:00+02', 'offer:entrada-1') returning id as entry, created_at as entry_created \gset

-- Ofrecer: el hueco, hasta cuándo, y solo si sigue esperando.
update public.waitlist_entries
set status = 'offered', offered_resource_id = :'cab', offered_starts_at = '2030-06-04 10:00+02',
    offered_ends_at = '2030-06-04 10:30+02', offer_expires_at = '2030-06-03 12:30+02'
where id = :'entry' and status = 'waiting';
select is((select status from public.waitlist_entries where id = :'entry'), 'offered', 'el worker le ofrece un hueco');

-- Que nadie conteste en 30 minutos: vuelve a esperar, sin oferta, en su sitio de la lista.
update public.waitlist_entries
set status = 'waiting', offered_resource_id = null, offered_starts_at = null, offered_ends_at = null, offer_expires_at = null
where id = :'entry' and status = 'offered' and offer_expires_at = '2030-06-03 12:30+02';
select is(
  (select row(status, offered_resource_id, offered_starts_at, offer_expires_at)::text from public.waitlist_entries where id = :'entry'),
  row('waiting'::text, null::uuid, null::timestamptz, null::timestamptz)::text,
  'si no contesta a tiempo, vuelve a esperar sin la oferta');
select is((select created_at from public.waitlist_entries where id = :'entry'), :'entry_created'::timestamptz,
  'y sin perder su sitio en la lista (created_at no cambia)');
select throws_ok(
  format($$update public.waitlist_entries set status = 'offered' where id = %L$$, :'entry'),
  '23514', null, 'una oferta sin su hueco y su plazo no vale');

-- La franja ya pasó: caduca, y una entrada caducada ya no cambia.
update public.waitlist_entries set status = 'expired' where id = :'entry' and status = 'waiting';
select is((select status from public.waitlist_entries where id = :'entry'), 'expired', 'caduca cuando pasa su franja');
select throws_ok(
  format($$update public.waitlist_entries set status = 'waiting' where id = %L$$, :'entry'),
  '42501', 'una entrada cerrada de la lista ya no cambia', 'y ya no vuelve');
reset role;

-- ===========================================================================
-- 3. Nadie de la app escribe en la lista
-- ===========================================================================
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$update public.waitlist_entries set status = 'waiting' where id = %L$$, :'entry'),
  '42501', null, 'ni un org_admin con MFA');
reset role;

select * from finish();
rollback;
