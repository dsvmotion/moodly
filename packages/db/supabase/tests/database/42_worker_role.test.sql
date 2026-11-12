-- PL-T1, paso 1 (20261112040500, ADR 0049): el rol moodly_worker. Con la
-- organización A fijada en la transacción solo ve y escribe lo de A; sin
-- organización no ve nada; no puede cambiar de rol, saltarse RLS ni tocar auth;
-- y solo tiene los privilegios del módulo que ya lo usa.
begin;
\ir _fixtures/tenants.psql
select plan(23);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset

-- ===========================================================================
-- 1. El rol
-- ===========================================================================
select results_eq(
  $$select rolsuper, rolbypassrls, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin from pg_roles where rolname = 'moodly_worker'$$,
  $$values (false, false, false, false, false, false)$$,
  'moodly_worker: sin superusuario, sin BYPASSRLS, sin heredar, sin crear roles ni bases, sin login (se lo da cada entorno)');
-- (En el paso 2, cuando el seed y staging le den login, rolcanlogin de esta
-- aserción deja de ser false en esos entornos: hay que cambiarla allí.)
select is(
  (select array_agg(r.rolname::text order by r.rolname) from pg_auth_members m join pg_roles r on r.oid = m.roleid
   where m.member = 'moodly_worker'::regrole),
  null, 'no es miembro de ningún rol (ni authenticated, ni service_role, ni postgres)');
select results_eq(
  $$select m.member::regrole::text, m.inherit_option, m.set_option from pg_auth_members m
    where m.roleid = 'moodly_worker'::regrole order by 1$$,
  $$values ('postgres', false, false)$$,
  'nadie puede actuar como moodly_worker ni heredar sus privilegios: solo postgres, que lo creó, y sin INHERIT ni SET');
select ok(not has_schema_privilege('moodly_worker', 'auth', 'usage'), 'no tiene acceso al esquema auth');
select ok(not has_schema_privilege('moodly_worker', 'public', 'create'), 'no puede crear tablas en public (sin DDL)');
select is(
  (select array_agg(distinct table_name::text order by table_name::text) from information_schema.role_table_grants
   where grantee = 'moodly_worker'),
  array['agent_runs', 'agents', 'approvals', 'channel_accounts', 'conversation_summaries', 'conversations', 'executions', 'locations', 'messages', 'org_model_settings', 'services', 'usage_records'],
  'solo tiene privilegios sobre las tablas que lee el turno de conversación al prepararse (con su resumen, 20261112110000, y el gasto, 20261112120000)');
select is(
  (select array_agg(distinct privilege_type::text) from information_schema.role_table_grants where grantee = 'moodly_worker'),
  array['SELECT'], 'y solo de lectura');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and has_function_privilege('moodly_worker', p.oid, 'execute')),
  array['worker_agent_turn_context', 'worker_organization_id'],
  'de public y private solo puede ejecutar worker_organization_id y worker_agent_turn_context (20261112110000)');

-- ===========================================================================
-- 2. Datos (como la plataforma): una conversación con un mensaje en A y en B
-- ===========================================================================
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'whatsapp', 'w-a1', 'customer', 'active') returning id as ca_a1 \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'whatsapp', 'w-b1', 'customer', 'active') returning id as ca_b1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as c_bea \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a1', :'agent_a') returning id as conv_a \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'c_bea', :'ca_b1', :'agent_b') returning id as conv_b \gset
insert into public.messages (organization_id, conversation_id, direction, author, content)
values (:org_a, :'conv_a', 'in', 'contact', 'Hola desde A'), (:org_b, :'conv_b', 'in', 'contact', 'Hola desde B');

-- ===========================================================================
-- 3. Sin organización fijada no ve nada
-- ===========================================================================
-- postgres crea el rol (con ADMIN), pero en PG16 no puede actuar como él sin la
-- opción SET: se la da solo dentro de este test (se deshace con el rollback).
-- Y para llamar a pgTAP mientras actúa como el rol, uso del esquema extensions,
-- también solo aquí.
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select is((select count(*)::int from public.conversations), 0, 'sin organización en la transacción no ve ninguna conversación');
select is((select count(*)::int from public.messages), 0, 'ni ningún mensaje');
select is(private.worker_organization_id(), null::uuid, 'worker_organization_id() es null');

-- ===========================================================================
-- 4. Con A fijada, solo lo de A
-- ===========================================================================
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select is((select array_agg(id) from public.conversations), array[:'conv_a'::uuid], 'con A fijada ve solo la conversación de A');
select is((select array_agg(content) from public.messages), array['Hola desde A'], 'y solo los mensajes de A');
select is((select count(*)::int from public.conversations where id = :'conv_b'), 0,
  'aunque pida por id una conversación de B, no la ve');
select is((select count(*)::int from public.locations where organization_id = :org_b), 0,
  'ni filtrando por la organización de B');

-- Sin privilegio, nada: ni escribir donde solo puede leer, ni leer lo que no le hace falta.
select throws_ok($$insert into public.conversations (organization_id) values (gen_random_uuid())$$,
  '42501', null, 'no puede escribir en una tabla de la que solo lee');
select throws_ok($$select * from public.integration_secrets$$, '42501', null, 'no puede leer los secretos de las integraciones');
select throws_ok($$select * from auth.users$$, '42501', null, 'ni auth.users');
select throws_ok($$select private.can_see_scope(gen_random_uuid(), null)$$, '42501', null,
  'ni llamar a los helpers de las políticas de la app');

reset role;

-- No puede cambiar de rol para saltarse RLS. SET ROLE lo comprueba contra el
-- usuario de la sesión (aquí, postgres), así que se pregunta por el rol mismo:
-- es lo que mira Postgres cuando el worker se conecta como moodly_worker.
select ok(not pg_has_role('moodly_worker', 'service_role', 'SET'), 'no puede pasar a service_role');
select ok(not pg_has_role('moodly_worker', 'postgres', 'SET') and not pg_has_role('moodly_worker', 'authenticated', 'SET'),
  'ni a postgres ni a authenticated');

-- ===========================================================================
-- 5. La política impide escribir en otra organización (WITH CHECK)
-- ===========================================================================
-- Un privilegio de escritura que el rol aún no tiene, solo dentro de este test
-- (se deshace con el rollback), para probar la política y no la falta de privilegio.
grant insert on public.contacts to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select throws_ok(format($$insert into public.contacts (organization_id, display_name) values (%L, 'Intrusa')$$, :org_b),
  '42501', null, 'con A fijada no puede crear un contacto en B');
select lives_ok(format($$insert into public.contacts (organization_id, display_name) values (%L, 'Carla')$$, :org_a),
  'en A, sí');
reset role;

select * from finish();
rollback;
