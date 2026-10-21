-- audit_logs (MANUAL §10.5, ADR 0021): solo inserción para los roles de
-- aplicación, `at` fijado por la base de datos, el equipo interno solo
-- inserta filas propias y lee todas, y el org_admin lee las de su
-- organización (D5).
begin;
\ir _fixtures/tenants.psql
select plan(60);

-- Ejecuta una sentencia y devuelve 'ok:<filas>' o el SQLSTATE del error.
create function pg_temp.try_sql(p_sql text) returns text language plpgsql as $$
declare
  n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return 'ok:' || n;
exception when others then
  return sqlstate;
end;
$$;

-- Un usuario tenant intenta escribir una fila como si fuera equipo interno.
create function pg_temp.insert_as_staff() returns text language sql as $$
  select pg_temp.try_sql(format(
    $q$insert into public.audit_logs (organization_id, actor_type, actor_id, action)
       values ('a0000000-0000-4000-8000-000000000000', 'platform_staff', %L, 'ops.org.viewed')$q$,
    (select auth.uid())));
$$;

-- Organizaciones de las filas de auditoría que ve el usuario actual
-- ('-' = sin organización), ordenadas.
create function pg_temp.visible_orgs() returns text[] language sql as $$
  select coalesce(array_agg(coalesce(organization_id::text, '-') order by organization_id::text nulls first), '{}')
  from public.audit_logs;
$$;

-- Lo mismo, solo con las filas de este archivo (orgs A y B, internos del
-- fixture o eventos test.* de sistema), para que el archivo pase igual con
-- filas de desarrollo en la base de datos local.
create function pg_temp.fixture_orgs() returns text[] language sql as $$
  select coalesce(array_agg(coalesce(organization_id::text, '-') order by organization_id::text nulls first), '{}')
  from public.audit_logs
  where organization_id in ('a0000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000000')
     or (organization_id is null and (actor_id in ('e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002')
                                      or action like 'test.%'));
$$;

-- ===========================================================================
-- 1. Estructura
-- ===========================================================================
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.audit_logs'::regclass),
  'audit_logs: RLS activado y forzado'
);
select is(
  (select array_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ',') order by policyname)
   from pg_policies where schemaname = 'public' and tablename = 'audit_logs'),
  array['audit_logs_insert_platform_staff:INSERT:authenticated',
        'audit_logs_select_org_admin:SELECT:authenticated',
        'audit_logs_select_platform_staff:SELECT:authenticated'],
  'audit_logs: solo políticas de INSERT y SELECT, todas solo para authenticated'
);
select is(
  (select array_agg(p order by p)
   from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege('anon', 'public.audit_logs', p)),
  null,
  'audit_logs: anon sin ningún privilegio'
);
select is(
  (select array_agg(p order by p)
   from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege('authenticated', 'public.audit_logs', p)),
  array['INSERT', 'SELECT'],
  'audit_logs: authenticated solo tiene INSERT y SELECT (sin UPDATE, DELETE, TRUNCATE, REFERENCES ni TRIGGER)'
);
select is(
  (select array_agg(p order by p)
   from unnest(array['UPDATE', 'DELETE', 'TRUNCATE']) as p
   where has_table_privilege('service_role', 'public.audit_logs', p)),
  null,
  'audit_logs: la service role tampoco tiene UPDATE, DELETE ni TRUNCATE (D6)'
);
select columns_are(
  'public', 'audit_logs',
  array['id', 'organization_id', 'actor_type', 'actor_id', 'action', 'target', 'metadata', 'at'],
  'audit_logs: columnas de §4.2'
);

-- ===========================================================================
-- 2. Restricciones (como plataforma)
-- ===========================================================================
insert into public.audit_logs (organization_id, actor_type, actor_id, action) values
  (:org_a, 'user',   :a_admin, 'test.a.user'),
  (:org_b, 'system', null,     'test.b.system');

select throws_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('user', %L, 'x')$$, :a_admin),
  '23514', null,
  'D7: un evento de usuario sin organización → rechazado'
);
select throws_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('agent', %L, 'x')$$, gen_random_uuid()),
  '23514', null,
  'D7: un evento de agente sin organización → rechazado'
);
select throws_ok(
  format($$insert into public.audit_logs (organization_id, actor_type, action) values (%L, 'user', 'x')$$, :org_a),
  '23514', null,
  'un evento de usuario sin actor_id → rechazado (solo el sistema puede no tenerlo)'
);
select lives_ok(
  $$insert into public.audit_logs (actor_type, action) values ('system', 'test.platform.system')$$,
  'D7: un evento de sistema sin organización → permitido'
);
select lives_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('platform_staff', %L, 'test.platform.staff')$$, :p_admin),
  'D7: un evento del equipo interno sin organización → permitido'
);

-- ===========================================================================
-- 3. INSERT: el equipo interno solo inserta filas propias
-- ===========================================================================
select pg_temp.staff_login(:p_admin) as p_admin_session \gset

select lives_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('platform_staff', %L, 'ops.org_list.viewed')$$, :p_admin),
  'platform_admin: inserta su evento sin organización (lista de organizaciones)'
);
select lives_ok(
  format($$insert into public.audit_logs (organization_id, actor_type, actor_id, action, target)
           values (%L, 'platform_staff', %L, 'ops.org.viewed', jsonb_build_object('organization_id', %L))$$, :org_a, :p_admin, :org_a),
  'platform_admin: inserta su evento sobre la organización A'
);
select throws_ok(
  format($$insert into public.audit_logs (organization_id, actor_type, actor_id, action) values (%L, 'platform_staff', %L, 'ops.org.viewed')$$, :org_a, :p_operator),
  '42501', null,
  'platform_admin: no puede firmar como otro interno (actor_id ajeno)'
);
select throws_ok(
  format($$insert into public.audit_logs (organization_id, actor_type, actor_id, action) values (%L, 'platform_staff', %L, 'ops.org.viewed')$$, :org_a, :a_admin),
  '42501', null,
  'platform_admin: no puede firmar como un usuario tenant'
);
select throws_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('system', %L, 'ops.org_list.viewed')$$, :p_admin),
  '42501', null,
  'platform_admin: no puede cambiar actor_type a system'
);
select throws_ok(
  format($$insert into public.audit_logs (organization_id, actor_type, actor_id, action) values (%L, 'user', %L, 'ops.org.viewed')$$, :org_a, :p_admin),
  '42501', null,
  'platform_admin: no puede cambiar actor_type a user'
);
select throws_ok(
  $$insert into public.audit_logs (actor_type, action) values ('platform_staff', 'ops.org_list.viewed')$$,
  '42501', null,
  'platform_admin: no puede insertar sin actor_id'
);
-- `at` lo fija la base de datos: antedatar o posfechar no sirve.
with i as (
  insert into public.audit_logs (actor_type, actor_id, action, at)
  values ('platform_staff', :p_admin, 'ops.audit.viewed', '2000-01-01 00:00:00+00')
  returning at
)
select is((select at from i), now(), 'platform_admin: `at` antedatado → la fila queda con now()');
select is(
  pg_temp.try_sql(format(
    $q$insert into public.audit_logs (actor_type, actor_id, action, at) values ('platform_staff', %L, 'x', '2999-01-01')$q$, :p_admin))
  || ':' || (select count(*) from public.audit_logs where at > now()),
  'ok:1:0',
  'platform_admin: `at` posfechado → tampoco cuela'
);
-- Se borra como plataforma para que no cuente en el resto del archivo.
reset role;
delete from public.audit_logs where action = 'x';

select pg_temp.staff_login(:p_operator);
select lives_ok(
  format($$insert into public.audit_logs (organization_id, actor_type, actor_id, action) values (%L, 'platform_staff', %L, 'ops.org.viewed')$$, :org_b, :p_operator),
  'platform_operator: también inserta sus eventos (D1)'
);

reset role;
select pg_temp.login(:p_revoked);
select is(pg_temp.insert_as_staff(), '42501', 'interno revocado: no puede insertar');

reset role;
delete from auth.sessions where id = :'p_admin_session';
select pg_temp.staff_act_as(:p_admin, :'p_admin_session');
select is(pg_temp.insert_as_staff(), '42501', 'interno con la sesión borrada (logout): no puede insertar');

-- Usuarios tenant: no pueden escribir filas del equipo interno (ni ninguna otra).
reset role;
select pg_temp.login(:a_admin);
select is(pg_temp.insert_as_staff(), '42501', 'org_admin A: no puede insertar filas de equipo interno');
select is(
  pg_temp.try_sql(format(
    $q$insert into public.audit_logs (organization_id, actor_type, actor_id, action) values (%L, 'user', %L, 'x')$q$, :org_a, :a_admin)),
  '42501',
  'org_admin A: tampoco puede insertar filas como usuario (sin política tenant de INSERT)'
);
reset role;
select pg_temp.login(:a_region_mgr);
select is(pg_temp.insert_as_staff(), '42501', 'region_manager A: no puede insertar filas de equipo interno');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is(pg_temp.insert_as_staff(), '42501', 'location_manager A1: no puede insertar filas de equipo interno');
reset role;
select pg_temp.login(:a_staff1);
select is(pg_temp.insert_as_staff(), '42501', 'staff A1: no puede insertar filas de equipo interno');
reset role;
select pg_temp.login(:a_staff2);
select is(pg_temp.insert_as_staff(), '42501', 'staff A2: no puede insertar filas de equipo interno');
reset role;
select pg_temp.login(:b_admin);
select is(pg_temp.insert_as_staff(), '42501', 'org_admin B: no puede insertar filas de equipo interno');
reset role;
select pg_temp.login(:b_loc_mgr);
select is(pg_temp.insert_as_staff(), '42501', 'location_manager B1: no puede insertar filas de equipo interno');
reset role;
select pg_temp.login(:outsider);
select is(pg_temp.insert_as_staff(), '42501', 'usuario sin membership: no puede insertar filas de equipo interno');

-- ===========================================================================
-- 4. SELECT
-- Filas: A = 2 (usuario A, platform_admin), B = 2 (sistema, platform_operator),
--        sin organización = 4 (sistema, interno, lista de organizaciones, audit).
-- ===========================================================================
\set all_orgs 'array[''-'', ''-'', ''-'', ''-'', ' :org_a ', ' :org_a ', ' :org_b ', ' :org_b ']'

reset role;
select count(*) as all_rows from public.audit_logs \gset
select pg_temp.staff_login(:p_admin);
select is(pg_temp.fixture_orgs(), :all_orgs, 'platform_admin: lee las filas de A, B y sin organización');
select is((select count(*) from public.audit_logs), :all_rows::bigint, 'platform_admin: lee todas las filas que hay');
reset role;
select pg_temp.staff_login(:p_operator);
select is(pg_temp.fixture_orgs(), :all_orgs, 'platform_operator: lee las filas de A, B y sin organización (D1)');
select is((select count(*) from public.audit_logs), :all_rows::bigint, 'platform_operator: lee todas las filas que hay');

reset role;
select pg_temp.login(:a_admin) as a_admin_session \gset
select is(pg_temp.visible_orgs(), array[:org_a, :org_a], 'org_admin A: solo ve las filas de A (D5)');
reset role;
select pg_temp.login(:b_admin);
select is(pg_temp.visible_orgs(), array[:org_b, :org_b], 'org_admin B: solo ve las filas de B (D5)');

reset role;
select pg_temp.login(:a_region_mgr);
select is(pg_temp.visible_orgs(), '{}', 'region_manager A: no ve ninguna fila');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is(pg_temp.visible_orgs(), '{}', 'location_manager A1: no ve ninguna fila');
reset role;
select pg_temp.login(:a_staff1);
select is(pg_temp.visible_orgs(), '{}', 'staff A1: no ve ninguna fila');
reset role;
select pg_temp.login(:a_staff2);
select is(pg_temp.visible_orgs(), '{}', 'staff A2: no ve ninguna fila');
reset role;
select pg_temp.login(:b_loc_mgr);
select is(pg_temp.visible_orgs(), '{}', 'location_manager B1: no ve ninguna fila');
reset role;
select pg_temp.login(:outsider);
select is(pg_temp.visible_orgs(), '{}', 'usuario sin membership: no ve ninguna fila');
reset role;
select pg_temp.login(:p_revoked);
select is(pg_temp.visible_orgs(), '{}', 'interno revocado: no ve ninguna fila');

reset role;
select pg_temp.staff_act_as(:p_admin, :'p_admin_session');
select is(pg_temp.visible_orgs(), '{}', 'interno con la sesión borrada (logout): no ve ninguna fila');
reset role;
delete from auth.sessions where id = :'a_admin_session';
select pg_temp.act_as(:a_admin, :'a_admin_session');
select is(pg_temp.visible_orgs(), '{}', 'org_admin A con la sesión borrada (logout): no ve ninguna fila');

-- ===========================================================================
-- 5. Solo inserción: UPDATE, DELETE y TRUNCATE fallan
-- ===========================================================================
reset role;
select pg_temp.staff_login(:p_admin);
select throws_ok($$update public.audit_logs set action = 'borrado'$$, '42501', null, 'platform_admin: no puede modificar filas');
select throws_ok('delete from public.audit_logs', '42501', null, 'platform_admin: no puede borrar filas');
select throws_ok('truncate public.audit_logs', '42501', null, 'platform_admin: no puede truncar');

reset role;
select pg_temp.login(:b_admin);
select throws_ok($$update public.audit_logs set action = 'borrado'$$, '42501', null, 'org_admin B: no puede modificar filas de su organización');
select throws_ok('delete from public.audit_logs', '42501', null, 'org_admin B: no puede borrar filas de su organización');
select throws_ok('truncate public.audit_logs', '42501', null, 'org_admin B: no puede truncar');

reset role;
set local role service_role;
select throws_ok($$update public.audit_logs set action = 'borrado'$$, '42501', null, 'service role: no puede modificar filas');
select throws_ok('delete from public.audit_logs', '42501', null, 'service role: no puede borrar filas');
select throws_ok('truncate public.audit_logs', '42501', null, 'service role: no puede truncar');

-- Segunda capa, aislada: aunque alguien volviera a conceder los privilegios,
-- el trigger rechaza UPDATE, DELETE y TRUNCATE de los roles de aplicación. Se
-- comprueba el mensaje para saber qué capa ha frenado.
reset role;
grant update, delete, truncate on public.audit_logs to service_role;
set local role service_role;
select throws_ok(
  $$update public.audit_logs set action = 'borrado'$$,
  '42501', 'audit_logs es solo inserción: UPDATE no permitido',
  'trigger: rechaza UPDATE aunque haya privilegio'
);
select throws_ok(
  'delete from public.audit_logs',
  '42501', 'audit_logs es solo inserción: DELETE no permitido',
  'trigger: rechaza DELETE aunque haya privilegio'
);
select throws_ok(
  'truncate public.audit_logs',
  '42501', 'audit_logs es solo inserción: TRUNCATE no permitido',
  'trigger: rechaza TRUNCATE aunque haya privilegio'
);
reset role;
revoke update, delete, truncate on public.audit_logs from service_role;

select is(
  pg_temp.fixture_orgs() || array[(select count(*) from public.audit_logs where action = 'borrado')::text],
  :all_orgs || array['0'],
  'tras los intentos: las 8 filas siguen intactas'
);

select * from finish();
rollback;
