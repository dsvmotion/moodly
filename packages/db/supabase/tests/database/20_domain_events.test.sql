-- Eventos de dominio, el outbox (20261024090000_domain_events.sql, ADR 0009).
begin;
\ir _fixtures/tenants.psql
select plan(36);

-- ===========================================================================
-- 1. Privilegios: la app solo lee; la plataforma lee y marca como publicado
-- ===========================================================================
select is(
  (select array_agg(p order by p) from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p
   where has_table_privilege('anon', 'public.domain_events', p)),
  null, 'anon: ningún privilegio');
select is(
  (select array_agg(p order by p) from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p
   where has_table_privilege('authenticated', 'public.domain_events', p)),
  array['SELECT'], 'authenticated: solo SELECT (ningún miembro escribe eventos)');
select is(
  (select array_agg(p order by p) from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p
   where has_table_privilege('service_role', 'public.domain_events', p)),
  array['SELECT'], 'service_role: SELECT en la tabla y nada más a nivel de tabla');
select is(
  (select array_agg(attname::text order by attname) from pg_attribute
   where attrelid = 'public.domain_events'::regclass and attnum > 0 and not attisdropped
     and has_column_privilege('service_role', 'public.domain_events', attname, 'UPDATE')),
  array['published_at'], 'service_role: solo puede actualizar published_at');
select ok(
  (select prosecdef from pg_proc where oid = 'private.emit_invitation_created()'::regprocedure),
  'emit_invitation_created es security definer (escribe el evento por quien no tiene privilegios)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.emit_invitation_created()', 'execute')),
  null, 'nadie de la app puede ejecutar emit_invitation_created');

-- ===========================================================================
-- 2. invitation.created se escribe en la misma transacción que el alta
-- ===========================================================================
select pg_temp.login_mfa(:a_admin);
select public.create_invitation(:org_a, 'nueva@test.local', 'staff', '{}', array[:loc_a1]::uuid[]) is not null as created \gset
reset role;
select id as invitation_id from public.invitations where organization_id = :org_a and email = 'nueva@test.local' \gset

-- Solo cuentan las organizaciones del fixture: la base local puede tener el seed.
-- Se lee como postgres (sin RLS); las lecturas por rol van a la tabla.
create temp view fixture_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b);

select is((select count(*)::int from fixture_events where type = 'invitation.created'), 1,
  'crear una invitación deja un evento invitation.created');
select is((select organization_id from fixture_events where type = 'invitation.created'), :org_a::uuid,
  'el evento es de la organización de la invitación');
select is((select payload->>'invitation_id' from fixture_events where type = 'invitation.created'), :'invitation_id'::text,
  'el payload apunta a la invitación por su id');
select is(
  (select array_agg(k order by k) from fixture_events, jsonb_object_keys(payload) as k where type = 'invitation.created'),
  array['invitation_id', 'invited_by', 'role'],
  'el payload no lleva el email ni el token: solo ids y el rol');
select is((select payload->>'invited_by' from fixture_events where type = 'invitation.created'), :a_admin::text,
  'invited_by sale de la fila de la invitación');
select ok((select published_at is null and chain_depth = 0 and location_id is null
           from fixture_events where type = 'invitation.created'),
  'nace pendiente, sin cadena y sin local');

-- Un alta rechazada no deja evento: va en la misma transacción.
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_b, :loc_b1),
  '42501', null, 'org_admin A no puede invitar a B…');
reset role;
select is((select count(*)::int from fixture_events where organization_id = :org_b), 0,
  '… y el intento no deja ningún evento en B');
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', '{}')$$, :org_a),
  '23514', null, 'una invitación incoherente se rechaza…');
reset role;
select is((select count(*)::int from fixture_events), 1, '… y tampoco deja evento');

-- ===========================================================================
-- 3. Lectura: el org_admin de su organización y el equipo interno con soporte
-- ===========================================================================
insert into public.domain_events (organization_id, type, payload)
values (:org_b, 'invitation.created', jsonb_build_object('invitation_id', gen_random_uuid()));

select pg_temp.login_mfa(:a_admin);
select is((select array_agg(distinct organization_id) from public.domain_events), array[:org_a::uuid],
  'org_admin A: ve los eventos de A y ninguno de B');
reset role;
select pg_temp.login_mfa(:b_admin);
select is((select array_agg(distinct organization_id) from public.domain_events), array[:org_b::uuid],
  'org_admin B: ve los de B y ninguno de A');
reset role;
select pg_temp.login(:a_staff1);
select is_empty('select 1 from public.domain_events', 'staff: no ve eventos');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is_empty('select 1 from public.domain_events', 'location_manager: no ve eventos');
reset role;
select pg_temp.staff_login(:p_operator);
select is((select count(distinct organization_id)::int from public.domain_events where organization_id in (:org_a, :org_b)), 2,
  'equipo interno con soporte vigente: los ve');
reset role;

-- ===========================================================================
-- 4. Nadie de la app falsifica, cambia ni borra un evento
-- ===========================================================================
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$insert into public.domain_events (organization_id, type) values (%L, 'invitation.created')$$, :org_a),
  '42501', null, 'org_admin: no puede insertar eventos, ni de su organización');
select throws_ok($$update public.domain_events set published_at = now()$$, '42501', null,
  'org_admin: no puede marcarlos como publicados');
select throws_ok($$delete from public.domain_events$$, '42501', null, 'org_admin: no puede borrarlos');
reset role;

set local role service_role;
select throws_ok(
  format($$insert into public.domain_events (organization_id, type) values (%L, 'invitation.created')$$, :org_a),
  '42501', null, 'service_role: tampoco inserta (se concederá cuando el worker lo necesite)');
select throws_ok($$update public.domain_events set payload = '{}'::jsonb$$, '42501', null,
  'service_role: no cambia el payload');
select throws_ok(format($$update public.domain_events set organization_id = %L$$, :org_b), '42501', null,
  'service_role: no cambia la organización');
select lives_ok($$update public.domain_events set published_at = '2999-01-01' where published_at is null$$,
  'service_role: marca los pendientes como publicados');
select throws_ok($$delete from public.domain_events$$, '42501', null, 'service_role: no los borra');
reset role;
select ok((select bool_and(published_at = now()) from fixture_events),
  'la hora de publicación la pone la base de datos, no quien publica');

-- ===========================================================================
-- 5. Integridad, para cualquier rol
-- ===========================================================================
select throws_ok(
  format($$insert into public.domain_events (organization_id, location_id, type) values (%L, %L, 'appointment.created')$$, :org_a, :loc_b1),
  '23514', null, 'el local tiene que ser de la organización del evento');
select lives_ok(
  format($$insert into public.domain_events (organization_id, location_id, type) values (%L, %L, 'appointment.created')$$, :org_a, :loc_a1),
  'un local de la organización sí');
select throws_ok(
  format($$insert into public.domain_events (organization_id, type) values (%L, 'Invitación creada')$$, :org_a),
  '23514', null, 'el tipo es entidad.verbo en minúsculas');
select throws_ok(
  format($$insert into public.domain_events (organization_id, type, chain_depth) values (%L, 'appointment.created', 6)$$, :org_a),
  '23514', null, 'una cadena de más de 5 eventos se corta (protección contra bucles)');
select throws_ok(
  format($$insert into public.domain_events (organization_id, type, payload) values (%L, 'appointment.created', %L::jsonb)$$,
    :org_a, jsonb_build_object('blob', repeat('x', 9000))),
  '23514', null, 'el payload no pasa de 8 KB: lleva ids, no documentos');
select throws_ok(
  format($$insert into public.domain_events (organization_id, type, created_at, published_at) values (%L, 'appointment.created', now(), now() - interval '1 minute')$$, :org_a),
  '23514', null, 'no se publica antes de crearse');

select * from finish();
rollback;
