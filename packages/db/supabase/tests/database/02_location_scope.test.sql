-- Alcance por local y región dentro de una organización (MANUAL §4.4):
-- un location_manager del local 1 no ve el local 2; un region_manager solo
-- ve los locales de sus regiones; los roles no admin no escriben estructura.
begin;
\ir _fixtures/tenants.psql
select plan(22);

-- ---------------------------------------------------------------------------
-- location_manager de A1
-- ---------------------------------------------------------------------------
select pg_temp.login(:a_loc1_mgr);

select results_eq(
  'select id from public.locations',
  format('values (%L::uuid)', :loc_a1),
  'location_manager A1: solo ve el local A1'
);
select is_empty(
  format('select 1 from public.locations where id = %L', :loc_a2),
  'location_manager A1: no ve el local A2 (misma región)'
);
select results_eq(
  'select id from public.regions',
  format('values (%L::uuid)', :region_a_n),
  'location_manager A1: solo ve la región de su local'
);
select results_eq(
  'select user_id from public.memberships order by user_id',
  format('values (%L::uuid), (%L::uuid)', :a_loc1_mgr, :a_staff1),
  'location_manager A1: ve su membership y la del staff de A1, no la de A2'
);
select is_empty(
  format('select 1 from public.users where id = %L', :a_staff2),
  'location_manager A1: no ve el perfil del staff de A2'
);
select isnt_empty(
  format('select 1 from public.users where id = %L', :a_staff1),
  'location_manager A1: ve el perfil del staff de A1'
);

select throws_ok(
  format('insert into public.locations (organization_id, name) values (%L, %L)', :org_a, 'nuevo'),
  '42501', null,
  'location_manager A1: no puede crear locales'
);
with u as (update public.locations set name = 'renombrado' returning 1)
select is(count(*)::int, 0, 'location_manager A1: no puede modificar locales, ni el suyo') from u;

-- Escalada de privilegios: no puede ampliar su alcance ni cambiar su rol.
with u as (
  update public.memberships set role = 'org_admin', scope_location_ids = '{}'
  where user_id = :a_loc1_mgr returning 1
)
select is(count(*)::int, 0, 'location_manager A1: no puede ascenderse a org_admin') from u;
with u as (
  update public.memberships set scope_location_ids = array[:loc_a1, :loc_a2]::uuid[]
  where user_id = :a_loc1_mgr returning 1
)
select is(count(*)::int, 0, 'location_manager A1: no puede ampliar su alcance a A2') from u;
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'location_manager', array[%L]::uuid[])$$, :outsider, :org_a, :loc_a2),
  '42501', null,
  'location_manager A1: no puede dar de alta memberships'
);

-- ---------------------------------------------------------------------------
-- staff de A2
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login(:a_staff2);

select results_eq(
  'select id from public.locations',
  format('values (%L::uuid)', :loc_a2),
  'staff A2: solo ve el local A2'
);
select results_eq(
  'select user_id from public.memberships',
  format('values (%L::uuid)', :a_staff2),
  'staff A2: solo ve su propia membership'
);
select results_eq(
  'select id from public.users',
  format('values (%L::uuid)', :a_staff2),
  'staff A2: solo ve su propio perfil'
);

-- ---------------------------------------------------------------------------
-- region_manager de A-Norte
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login(:a_region_mgr);

select results_eq(
  'select id from public.locations order by id',
  format('values (%L::uuid), (%L::uuid)', :loc_a1, :loc_a2),
  'region_manager A-Norte: ve A1 y A2'
);
select is_empty(
  format('select 1 from public.locations where id = %L', :loc_a3),
  'region_manager A-Norte: no ve A3 (otra región)'
);
select results_eq(
  'select id from public.regions',
  format('values (%L::uuid)', :region_a_n),
  'region_manager A-Norte: solo ve su región'
);
select results_eq(
  'select user_id from public.memberships order by user_id',
  format('values (%L::uuid), (%L::uuid), (%L::uuid), (%L::uuid)', :a_region_mgr, :a_loc1_mgr, :a_staff1, :a_staff2),
  'region_manager A-Norte: ve las memberships de los locales de su región, no la del org_admin'
);
select throws_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_a, 'nueva'),
  '42501', null,
  'region_manager: no puede crear regiones'
);

-- ---------------------------------------------------------------------------
-- Tras volver a superusuario: nada ha cambiado
-- ---------------------------------------------------------------------------
reset role;
select is((select role from public.memberships where user_id = :a_loc1_mgr), 'location_manager', 'rol del location_manager intacto');
select is((select scope_location_ids from public.memberships where user_id = :a_loc1_mgr), array[:loc_a1]::uuid[], 'alcance del location_manager intacto');
select is((select count(*)::int from public.locations where name = 'renombrado'), 0, 'ningún local renombrado');

select * from finish();
rollback;
