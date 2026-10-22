-- Equipo interno (platform_staff, ADR 0021): identidad separada de los roles
-- tenant, lectura entre tenants de solo lectura y acceso que se corta al
-- revocar, cerrar sesión, banear o borrar la cuenta.
begin;
\ir _fixtures/tenants.psql
select plan(55);

-- Ejecuta una sentencia y devuelve 'ok:<filas>' o el SQLSTATE del error. El
-- bloque con excepción revierte lo que haya hecho la sentencia si falla.
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

-- Cuenta lo que ve el usuario actual en las 5 tablas de tenants.
create function pg_temp.visible_counts() returns int[] language sql as $$
  select array[
    (select count(*)::int from public.organizations),
    (select count(*)::int from public.regions),
    (select count(*)::int from public.locations),
    (select count(*)::int from public.users),
    (select count(*)::int from public.memberships)
  ];
$$;

-- Lo que un usuario tenant ve y consigue en platform_staff: filas visibles,
-- is_platform_staff() y resultado de INSERT/UPDATE/DELETE.
create function pg_temp.tenant_probe() returns text[] language sql as $$
  select array[
    'filas: '  || (select count(*) from public.platform_staff),
    'helper: ' || (select private.is_platform_staff()),
    'insert: ' || pg_temp.try_sql(format(
      $q$insert into public.platform_staff (user_id, role) values (%L, 'platform_admin')$q$, (select auth.uid()))),
    'update: ' || pg_temp.try_sql('update public.platform_staff set revoked_at = null'),
    'delete: ' || pg_temp.try_sql('delete from public.platform_staff')
  ];
$$;

-- Intentos de escritura del equipo interno en las 5 tablas de tenants: sin
-- políticas de escritura para él, todo falla o afecta a 0 filas.
create function pg_temp.staff_write_probe() returns text[] language sql as $$
  select array[
    'insert organizations: ' || pg_temp.try_sql($q$insert into public.organizations (name) values ('intrusa')$q$),
    'insert regions: '       || pg_temp.try_sql($q$insert into public.regions (organization_id, name) values ('a0000000-0000-4000-8000-000000000000', 'intrusa')$q$),
    'insert locations: '     || pg_temp.try_sql($q$insert into public.locations (organization_id, name) values ('b0000000-0000-4000-8000-000000000000', 'intruso')$q$),
    'insert memberships: '   || pg_temp.try_sql($q$insert into public.memberships (user_id, organization_id, role) values ('c3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'org_admin')$q$),
    'insert users: '         || pg_temp.try_sql(format('insert into public.users (id) values (%L)', gen_random_uuid())),
    'update organizations: ' || pg_temp.try_sql($q$update public.organizations set name = 'hackeada'$q$),
    'update regions: '       || pg_temp.try_sql($q$update public.regions set name = 'hackeada'$q$),
    'update locations: '     || pg_temp.try_sql($q$update public.locations set opening_hours = '{"x": 1}'$q$),
    'update memberships: '   || pg_temp.try_sql($q$update public.memberships set role = 'org_admin', scope_region_ids = '{}', scope_location_ids = '{}'$q$),
    'update users: '         || pg_temp.try_sql(format($q$update public.users set full_name = 'hackeado' where id <> %L$q$, (select auth.uid()))),
    'delete organizations: ' || pg_temp.try_sql('delete from public.organizations'),
    'delete regions: '       || pg_temp.try_sql('delete from public.regions'),
    'delete locations: '     || pg_temp.try_sql('delete from public.locations'),
    'delete memberships: '   || pg_temp.try_sql('delete from public.memberships'),
    'delete users: '         || pg_temp.try_sql(format('delete from public.users where id <> %L', (select auth.uid())))
  ];
$$;

-- ===========================================================================
-- 1. Estructura de platform_staff
-- ===========================================================================
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.platform_staff'::regclass),
  'platform_staff: RLS activado y forzado'
);
select is(
  (select array_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ',') order by policyname)
   from pg_policies where schemaname = 'public' and tablename = 'platform_staff'),
  array['platform_staff_select_self:SELECT:authenticated'],
  'platform_staff: una sola política, SELECT de la propia fila, solo para authenticated'
);
select is(
  (select array_agg(p order by p)
   from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege('anon', 'public.platform_staff', p)),
  null,
  'platform_staff: anon sin ningún privilegio'
);
select is(
  (select array_agg(p order by p)
   from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege('authenticated', 'public.platform_staff', p)),
  array['SELECT'],
  'platform_staff: authenticated solo tiene SELECT (conceder y retirar es de la plataforma, D4)'
);

-- ===========================================================================
-- 2. El helper private.is_platform_staff(text[])
-- ===========================================================================
select ok(
  (select prosecdef from pg_proc where oid = 'private.is_platform_staff(text[])'::regprocedure),
  'is_platform_staff(): security definer'
);
select is(
  (select proconfig from pg_proc where oid = 'private.is_platform_staff(text[])'::regprocedure),
  array['search_path=""'],
  'is_platform_staff(): fija search_path vacío'
);
select ok(
  not has_function_privilege('anon', 'private.is_platform_staff(text[])', 'execute'),
  'is_platform_staff(): anon no puede ejecutarla'
);
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where p.oid = 'private.is_platform_staff(text[])'::regprocedure
     and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0,
  'is_platform_staff(): sin EXECUTE para PUBLIC'
);
select ok(
  has_function_privilege('authenticated', 'private.is_platform_staff(text[])', 'execute')
    and has_function_privilege('service_role', 'private.is_platform_staff(text[])', 'execute'),
  'is_platform_staff(): la ejecutan authenticated y service_role'
);
-- Solo lee: SQL y STABLE (Postgres rechaza INSERT/UPDATE/DELETE en una
-- función SQL no volátil) y sin sentencias de escritura en el cuerpo.
select ok(
  (select provolatile = 's' and prolang = (select oid from pg_language where lanname = 'sql')
          and prosrc !~* '\m(insert|update|delete|truncate|merge)\M'
   from pg_proc where oid = 'private.is_platform_staff(text[])'::regprocedure),
  'is_platform_staff(): solo lee (SQL, STABLE, sin escrituras)'
);

-- ===========================================================================
-- 3. Usuarios tenant: no ven platform_staff, no pueden escribir en ella y
--    is_platform_staff() es false. Todos los roles de A y B y sin membership.
-- ===========================================================================
\set tenant_expected 'array[''filas: 0'', ''helper: false'', ''insert: 42501'', ''update: 42501'', ''delete: 42501'']'

select pg_temp.login_mfa(:a_admin);
select is(pg_temp.tenant_probe(), :tenant_expected, 'org_admin A: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login(:a_region_mgr);
select is(pg_temp.tenant_probe(), :tenant_expected, 'region_manager A: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is(pg_temp.tenant_probe(), :tenant_expected, 'location_manager A1: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login(:a_staff1);
select is(pg_temp.tenant_probe(), :tenant_expected, 'staff A1: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login(:a_staff2);
select is(pg_temp.tenant_probe(), :tenant_expected, 'staff A2: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login_mfa(:b_admin);
select is(pg_temp.tenant_probe(), :tenant_expected, 'org_admin B: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login(:b_loc_mgr);
select is(pg_temp.tenant_probe(), :tenant_expected, 'location_manager B1: no ve platform_staff, no escribe en ella y no es equipo interno');
reset role;
select pg_temp.login(:outsider);
select is(pg_temp.tenant_probe(), :tenant_expected, 'usuario sin membership: no ve platform_staff, no escribe en ella y no es equipo interno');

-- Un usuario tenant sigue viendo solo lo suyo (las políticas nuevas no le dan nada).
reset role;
select pg_temp.login_mfa(:a_admin);
select is(pg_temp.visible_counts(), array[1, 2, 3, 5, 5], 'org_admin A: sigue viendo solo A (1 org, 2 regiones, 3 locales, 5 perfiles, 5 memberships)');
reset role;
select pg_temp.login(:b_loc_mgr);
select is(pg_temp.visible_counts(), array[1, 1, 1, 2, 2], 'location_manager B1: sigue viendo solo B');

-- ===========================================================================
-- 4. Equipo interno: lee todo A y B, no escribe nada
-- Las comprobaciones se acotan a los datos del fixture o se comparan con lo
-- que hay de verdad (como superusuario), para que el archivo pase igual con
-- el seed de desarrollo cargado.
-- ===========================================================================
reset role;
select pg_temp.visible_counts()::text as super_counts \gset
-- Lo que debe ver el equipo interno con permiso para todas las organizaciones:
-- todo, salvo los perfiles de quien no tiene membership ni es interno.
select array[
  (select count(*)::int from public.organizations),
  (select count(*)::int from public.regions),
  (select count(*)::int from public.locations),
  (select count(*)::int from public.users u
    where exists (select 1 from public.memberships m where m.user_id = u.id)
       or exists (select 1 from public.platform_staff ps where ps.user_id = u.id)),
  (select count(*)::int from public.memberships)
]::text as all_counts \gset
select pg_temp.staff_login(:p_admin) as p_admin_session \gset

select results_eq(
  format('select id from public.organizations where id in (%L, %L) order by id', :org_a, :org_b),
  format('values (%L::uuid), (%L::uuid)', :org_a, :org_b),
  'platform_admin: ve las organizaciones A y B'
);
select is(pg_temp.visible_counts(), :'all_counts'::int[], 'platform_admin: ve todas las filas de las 5 tablas de tenants');
-- Fixture: 3 regiones y 4 locales, 10 perfiles (7 con membership + 3 internos;
-- el usuario sin membership no es de ninguna organización con permiso) y 7 memberships.
select is(
  (select array[
     (select count(*) from public.regions     where organization_id in (:org_a, :org_b)),
     (select count(*) from public.locations   where organization_id in (:org_a, :org_b)),
     (select count(*) from public.users       where full_name like '%@test.local'),
     (select count(*) from public.memberships where organization_id in (:org_a, :org_b))
   ]::int[]),
  array[3, 4, 10, 7],
  'platform_admin: ve las regiones, locales, perfiles y memberships de A y B'
);
select is(
  (select array_agg(organization_id::text || ':' || n order by organization_id)
   from (select organization_id, count(*) as n from public.memberships
         where organization_id in (:org_a, :org_b) group by organization_id) m),
  array[:org_a || ':5', :org_b || ':2'],
  'platform_admin: ve las memberships de A (5) y de B (2)'
);
select results_eq(
  'select user_id from public.platform_staff',
  format('values (%L::uuid)', :p_admin),
  'platform_admin: en platform_staff solo ve su propia fila'
);
select ok((select private.is_platform_staff()), 'platform_admin: is_platform_staff() = true');
select ok((select private.is_platform_staff(array['platform_admin'])), 'platform_admin: is_platform_staff([platform_admin]) = true');
select ok(not (select private.is_platform_staff(array['platform_operator'])), 'platform_admin: is_platform_staff([platform_operator]) = false');

\set staff_write_expected 'array[''insert organizations: 42501'', ''insert regions: 42501'', ''insert locations: 42501'', ''insert memberships: 42501'', ''insert users: 42501'', ''update organizations: ok:0'', ''update regions: ok:0'', ''update locations: ok:0'', ''update memberships: ok:0'', ''update users: ok:0'', ''delete organizations: ok:0'', ''delete regions: ok:0'', ''delete locations: ok:0'', ''delete memberships: ok:0'', ''delete users: ok:0'']'
select is(pg_temp.staff_write_probe(), :staff_write_expected, 'platform_admin: ningún INSERT/UPDATE/DELETE en las 5 tablas de tenants');

reset role;
select pg_temp.staff_login(:p_operator);
select is(pg_temp.visible_counts(), :'all_counts'::int[], 'platform_operator: ve lo mismo que platform_admin (D1)');
select ok((select private.is_platform_staff(array['platform_operator'])), 'platform_operator: is_platform_staff([platform_operator]) = true');
select ok(not (select private.is_platform_staff(array['platform_admin'])), 'platform_operator: is_platform_staff([platform_admin]) = false');
select is(pg_temp.staff_write_probe(), :staff_write_expected, 'platform_operator: ningún INSERT/UPDATE/DELETE en las 5 tablas de tenants');
-- Tampoco puede concederse acceso ni retirárselo a otro.
select is(
  pg_temp.try_sql(format('update public.platform_staff set revoked_at = now() where user_id = %L', :p_admin)),
  '42501',
  'platform_operator: no puede revocar a otro interno'
);

-- Como superusuario: nada ha cambiado.
reset role;
select is(
  (select array_agg(name order by name) from public.organizations where id in (:org_a, :org_b)),
  array['Org A', 'Org B'],
  'tras los intentos del equipo interno: organizaciones intactas'
);
select is(pg_temp.visible_counts(), :'super_counts'::int[], 'tras los intentos del equipo interno: ninguna fila creada ni borrada');
select is(
  (select array_agg(role || ':' || cardinality(scope_region_ids) || ':' || cardinality(scope_location_ids) order by user_id)
   from public.memberships where organization_id in (:org_a, :org_b)),
  array['org_admin:0:0', 'region_manager:1:0', 'location_manager:0:1', 'staff:0:1', 'staff:0:1',
        'org_admin:0:0', 'location_manager:0:1'],
  'tras los intentos del equipo interno: roles y alcances intactos'
);

-- ===========================================================================
-- 5. Acceso que se corta: revocado, logout, sesión caducada, baneado, borrado
-- ===========================================================================
select pg_temp.login(:p_revoked);
select is(pg_temp.visible_counts(), array[0, 0, 0, 1, 0], 'interno revocado: no ve nada de tenants (solo su propio perfil)');
select ok(not (select private.is_platform_staff()), 'interno revocado: is_platform_staff() = false');
select ok(
  (select revoked_at is not null from public.platform_staff where user_id = (select auth.uid())),
  'interno revocado: ve su propia fila, con revoked_at'
);

-- Revocar surte efecto en la siguiente consulta, con la misma sesión.
reset role;
update public.platform_staff set revoked_at = now() where user_id = :p_admin;
select pg_temp.staff_act_as(:p_admin, :'p_admin_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 1, 0], 'revocar: el interno deja de ver tenants en la siguiente consulta');
reset role;
update public.platform_staff set revoked_at = null where user_id = :p_admin;
select pg_temp.staff_act_as(:p_admin, :'p_admin_session');
select is(pg_temp.visible_counts(), :'all_counts'::int[], 'volver a conceder: recupera la lectura');

-- Logout (sesión borrada): el JWT sigue firmado, pero ya no ve nada.
reset role;
delete from auth.sessions where id = :'p_admin_session';
select pg_temp.staff_act_as(:p_admin, :'p_admin_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'interno con la sesión borrada (logout): no ve nada');
select is_empty('select 1 from public.platform_staff', 'interno con la sesión borrada: tampoco su fila de platform_staff');

reset role;
select pg_temp.staff_login(:p_admin) as p_admin_session2 \gset
reset role;
update auth.sessions set not_after = now() - interval '1 minute' where id = :'p_admin_session2';
select pg_temp.staff_act_as(:p_admin, :'p_admin_session2');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'interno con la sesión caducada: no ve nada');

reset role;
select pg_temp.staff_login(:p_operator) as p_operator_session \gset
reset role;
update auth.users set banned_until = now() + interval '1 day' where id = :p_operator;
select pg_temp.staff_act_as(:p_operator, :'p_operator_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'interno baneado: no ve nada aunque su sesión exista');

reset role;
update auth.users set banned_until = null, deleted_at = now() where id = :p_operator;
select pg_temp.staff_act_as(:p_operator, :'p_operator_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'interno borrado (deleted_at): no ve nada');

-- Borrado físico de la cuenta: su fila de platform_staff desaparece en cascada.
reset role;
delete from auth.users where id = :p_operator;
select is(
  (select count(*)::int from public.platform_staff where user_id = :p_operator),
  0,
  'interno borrado de auth.users: su fila de platform_staff se borra en cascada'
);
select pg_temp.staff_act_as(:p_operator, :'p_operator_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'interno borrado de auth.users: su JWT ya no ve nada');

-- ===========================================================================
-- 6. Identidades separadas (D2): interno no revocado ⇔ sin memberships
-- ===========================================================================
reset role;
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role) values (%L, %L, 'org_admin')$$, :p_admin, :org_a),
  '23514', 'una cuenta del equipo interno (platform_staff) no puede tener memberships de tenants',
  'plataforma: no puede dar una membership a un interno'
);
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'staff', array[%L]::uuid[])$$, :p_admin, :org_a, :loc_a1),
  '23514', 'una cuenta del equipo interno (platform_staff) no puede tener memberships de tenants',
  'org_admin A: no puede dar de alta a un interno en su organización'
);
reset role;
select throws_ok(
  format('update public.memberships set user_id = %L where user_id = %L', :p_admin, :a_staff2),
  '23514', 'una cuenta del equipo interno (platform_staff) no puede tener memberships de tenants',
  'plataforma: no puede reasignar una membership a un interno'
);
select throws_ok(
  format($$insert into public.platform_staff (user_id, role) values (%L, 'platform_operator')$$, :a_staff1),
  '23514', 'un usuario con memberships de tenants no puede ser equipo interno (platform_staff)',
  'plataforma: no puede hacer interno a un usuario con membership'
);
-- Un interno revocado sí puede pasar a tener membership, y entonces no se le
-- puede devolver el acceso interno.
select lives_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'staff', array[%L]::uuid[])$$, :p_revoked, :org_b, :loc_b1),
  'plataforma: un interno revocado puede tener membership'
);
select throws_ok(
  format('update public.platform_staff set revoked_at = null where user_id = %L', :p_revoked),
  '23514', 'un usuario con memberships de tenants no puede ser equipo interno (platform_staff)',
  'plataforma: no puede devolver el acceso interno a quien ya tiene membership'
);

select * from finish();
rollback;
