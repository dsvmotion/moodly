-- Revocación real de sesiones (tarea 3c-1): un JWT sigue siendo válido hasta
-- que caduca, pero si su sesión ya no está viva en auth.sessions (logout,
-- sesión caducada, usuario baneado o borrado), RLS no devuelve nada.
begin;
\ir _fixtures/tenants.psql
select plan(26);

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

-- ---------------------------------------------------------------------------
-- Con sesión viva: ve su organización
-- ---------------------------------------------------------------------------
select pg_temp.login(:a_admin) as a_admin_session \gset
select is(pg_temp.visible_counts(), array[1, 2, 3, 5, 5], 'org_admin A con sesión viva: ve 1 org, 2 regiones, 3 locales, 5 perfiles, 5 memberships');
select ok((select private.session_is_active()), 'session_is_active() = true con la sesión del login');

-- ---------------------------------------------------------------------------
-- Logout: Supabase Auth borra la fila de auth.sessions. El JWT (claims) sigue
-- siendo el mismo, pero ya no ve nada ni puede escribir.
-- ---------------------------------------------------------------------------
reset role;
delete from auth.sessions where id = :'a_admin_session';
select pg_temp.act_as(:a_admin, :'a_admin_session');

select ok(not (select private.session_is_active()), 'sesión borrada: session_is_active() = false');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'sesión borrada: no ve nada en ninguna de las 5 tablas');
select throws_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_a, 'tras logout'),
  '42501', null,
  'sesión borrada: no puede crear regiones'
);
select throws_ok(
  format('insert into public.memberships (user_id, organization_id, role) values (%L, %L, %L)', :outsider, :org_a, 'org_admin'),
  '42501', null,
  'sesión borrada: no puede crear memberships'
);
with u as (update public.organizations set name = 'tras logout' where id = :org_a returning 1)
select is(count(*)::int, 0, 'sesión borrada: no puede modificar su organización') from u;
with u as (update public.locations set opening_hours = '{}' where organization_id = :org_a returning 1)
select is(count(*)::int, 0, 'sesión borrada: no puede modificar locales') from u;
with u as (update public.users set full_name = 'tras logout' where id = :a_admin returning 1)
select is(count(*)::int, 0, 'sesión borrada: no puede modificar ni su propio perfil') from u;
with d as (delete from public.memberships where organization_id = :org_a returning 1)
select is(count(*)::int, 0, 'sesión borrada: no puede borrar memberships') from d;

-- Un nuevo login (sesión nueva) vuelve a dar acceso.
reset role;
select pg_temp.login(:a_admin) as a_admin_session2 \gset
select is(pg_temp.visible_counts(), array[1, 2, 3, 5, 5], 'nuevo login: vuelve a ver su organización');

-- ---------------------------------------------------------------------------
-- Otros motivos de sesión no viva
-- ---------------------------------------------------------------------------
reset role;
update auth.sessions set not_after = now() - interval '1 minute' where id = :'a_admin_session2';
select pg_temp.act_as(:a_admin, :'a_admin_session2');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'sesión caducada (not_after en el pasado): no ve nada');

reset role;
select pg_temp.login(:a_loc1_mgr) as loc_session \gset
select is((select count(*)::int from public.locations), 1, 'location_manager A1 con sesión viva: ve su local');

reset role;
update auth.users set banned_until = now() + interval '1 day' where id = :a_loc1_mgr;
select pg_temp.act_as(:a_loc1_mgr, :'loc_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'usuario baneado: no ve nada aunque su sesión exista');

reset role;
update auth.users set banned_until = now() - interval '1 day' where id = :a_loc1_mgr;
select pg_temp.act_as(:a_loc1_mgr, :'loc_session');
select is((select count(*)::int from public.locations), 1, 'ban ya vencido: vuelve a ver su local');

reset role;
update auth.users set deleted_at = now() where id = :a_loc1_mgr;
select pg_temp.act_as(:a_loc1_mgr, :'loc_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'usuario borrado (deleted_at): no ve nada');

-- ---------------------------------------------------------------------------
-- JWT manipulado o incompleto
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :a_staff1, 'role', 'authenticated')::text, true);
set local role authenticated;
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'JWT sin session_id: no ve nada');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', :a_staff1, 'role', 'authenticated', 'session_id', 'no-es-un-uuid')::text, true);
set local role authenticated;
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'session_id con formato inválido: no ve nada (sin error)');

-- session_id de una sesión viva de OTRO usuario: no vale para suplantarle.
reset role;
select pg_temp.login(:b_admin) as b_session \gset
reset role;
select pg_temp.act_as(:a_staff1, :'b_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 0, 0], 'session_id de otro usuario: no ve nada');

-- La sesión de B sigue funcionando para B y solo para B.
reset role;
select pg_temp.act_as(:b_admin, :'b_session');
select is(pg_temp.visible_counts(), array[1, 1, 1, 2, 2], 'admin B con su sesión: ve solo B');

-- ---------------------------------------------------------------------------
-- La función en sí: permisos y aislamiento
-- ---------------------------------------------------------------------------
reset role;
select ok(not has_function_privilege('anon', 'private.session_is_active()', 'execute'), 'anon no puede ejecutar session_is_active()');
select ok(has_function_privilege('authenticated', 'private.session_is_active()', 'execute'), 'authenticated puede ejecutar session_is_active()');
select ok(not has_table_privilege('authenticated', 'auth.sessions', 'select'), 'authenticated sigue sin poder leer auth.sessions directamente');
select is(
  (select proconfig from pg_proc where oid = 'private.session_is_active()'::regprocedure),
  array['search_path=""'],
  'session_is_active() fija search_path vacío'
);
select is(
  (select provolatile::text from pg_proc where oid = 'private.session_is_active()'::regprocedure),
  's',
  'session_is_active() es STABLE (necesario para el InitPlan)'
);
select is(
  (select pronargs::int from pg_proc where oid = 'private.session_is_active()'::regprocedure),
  0,
  'session_is_active() no recibe argumentos (no depende de la fila)'
);

select * from finish();
rollback;
