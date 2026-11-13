-- moodly_worker y integrations (20261112250000, O-02, ADR 0049): lee solo las
-- columnas que usan el webhook de Nango y la lectura del calendario, y cambia
-- solo las de 20261112210000. Ni la tabla entera ni scopes, secret_id,
-- server_version, connected_by, created_at o updated_at.
begin;
\ir _fixtures/tenants.psql
select plan(14);

insert into public.integrations (organization_id, provider, kind, status, external_connection_id)
values (:org_a, 'google-calendar', 'platform', 'active', 'conn-52-a') returning id as int_a \gset

-- Privilegios, exactos.
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integrations' and privilege_type = 'SELECT'),
  'external_connection_id, id, kind, last_health_check, location_id, organization_id, provider, status',
  'lee de integrations solo las columnas que usa el worker');
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integrations' and privilege_type = 'UPDATE'),
  'external_connection_id, last_health_check, status',
  'y cambia solo estas (sin cambios desde 20261112210000)');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'moodly_worker' and table_name = 'integrations'),
  0, 'sin ningún privilegio de tabla entera sobre integrations');
select ok(not has_table_privilege('moodly_worker', 'public.integrations', 'insert,delete,truncate'),
  'ni INSERT, DELETE ni TRUNCATE');

-- Como moodly_worker, con la organización A fijada.
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

-- Lo que hacen el webhook y la lectura del calendario, sigue valiendo.
select results_eq(
  format($$select provider, external_connection_id from public.integrations
    where organization_id = %L and provider = any(array['google-calendar', 'outlook-calendar']) and kind = 'platform'
      and status = 'active' and location_id is null and external_connection_id is not null
    order by last_health_check desc nulls last, provider limit 1$$, :org_a),
  $$values ('google-calendar'::text, 'conn-52-a'::text)$$,
  'la lectura del calendario (con su orden) funciona');
select results_eq(
  format($$select id, status, external_connection_id from public.integrations
    where id = %L and organization_id = %L and kind = 'platform' and provider = 'google-calendar' for update$$, :'int_a', :org_a),
  format($$values (%L::uuid, 'active'::text, 'conn-52-a'::text)$$, :'int_a'),
  'y el SELECT … FOR UPDATE del webhook');
select lives_ok(
  format($$update public.integrations set status = 'active', external_connection_id = 'conn-52-b', last_health_check = now()
    where id = %L and organization_id = %L returning id$$, :'int_a', :org_a),
  'y su UPDATE con RETURNING');

-- Lo demás, no (42501: sin privilegio de columna).
select throws_ok($$select * from public.integrations$$, '42501', null, 'select * falla: no lee la tabla entera');
select throws_ok($$select scopes from public.integrations$$, '42501', null, 'no lee scopes');
select throws_ok($$select secret_id from public.integrations$$, '42501', null, 'ni secret_id');
select throws_ok($$select server_version from public.integrations$$, '42501', null, 'ni server_version');
select throws_ok($$select connected_by from public.integrations$$, '42501', null, 'ni quién la conectó');
select throws_ok($$select id from public.integrations where created_at < now() or updated_at < now()$$, '42501', null,
  'ni created_at o updated_at, tampoco en el WHERE');
select throws_ok(format($$update public.integrations set status = 'error' where id = %L returning scopes$$, :'int_a'), '42501', null,
  'ni en el RETURNING de un UPDATE');
reset role;

select * from finish();
rollback;
