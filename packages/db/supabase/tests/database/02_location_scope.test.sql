-- Alcance por local y región dentro de una organización (MANUAL §4.4):
-- un location_manager del local 1 no ve el local 2; un region_manager solo
-- ve los locales de sus regiones. Los managers editan la operativa de sus
-- locales pero no su estructura, y nadie salvo el org_admin toca memberships.
begin;
\ir _fixtures/tenants.psql
select plan(35);

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
  format('values (%L::uuid), (%L::uuid), (%L::uuid)', :a_admin, :a_loc1_mgr, :a_staff1),
  'location_manager A1: ve al org_admin, a sí mismo y al staff de A1; no al de A2'
);
select is_empty(
  format('select 1 from public.users where id = %L', :a_staff2),
  'location_manager A1: no ve el perfil del staff de A2'
);
select isnt_empty(
  format('select 1 from public.users where id = %L', :a_staff1),
  'location_manager A1: ve el perfil del staff de A1'
);

-- Operativa de su local: sí. Estructura: no.
with u as (
  update public.locations set opening_hours = '{"mon": ["09:00", "20:00"]}', timezone = 'Atlantic/Canary'
  where id = :loc_a1 returning 1
)
select is(count(*)::int, 1, 'location_manager A1: puede cambiar horario y zona horaria de A1') from u;
with u as (update public.locations set opening_hours = '{}' where id = :loc_a2 returning 1)
select is(count(*)::int, 0, 'location_manager A1: no puede modificar A2') from u;
select throws_ok(
  format('update public.locations set name = %L where id = %L', 'renombrado', :loc_a1),
  '42501', 'los managers solo pueden cambiar horario, dirección y zona horaria de un local',
  'location_manager A1: no puede renombrar su local'
);
select throws_ok(
  format('update public.locations set region_id = %L where id = %L', :region_a_s, :loc_a1),
  '42501', null,
  'location_manager A1: no puede mover su local de región'
);
select throws_ok(
  format($$update public.locations set status = 'inactive' where id = %L$$, :loc_a1),
  '42501', 'los managers solo pueden cambiar horario, dirección y zona horaria de un local',
  'location_manager A1: no puede desactivar su local'
);
select throws_ok(
  format('insert into public.locations (organization_id, name) values (%L, %L)', :org_a, 'nuevo'),
  '42501', null,
  'location_manager A1: no puede crear locales'
);

-- Escalada de privilegios: no puede ampliar su alcance ni cambiar su rol.
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
with u as (
  update public.memberships set role = 'org_admin', scope_location_ids = '{}'
  where user_id = :a_loc1_mgr returning 1
)
select is(count(*)::int, 0, 'location_manager A1: no puede ascenderse a org_admin') from u;

-- ---------------------------------------------------------------------------
-- staff de A1 y de A2
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login(:a_staff1);

select results_eq(
  'select user_id from public.memberships order by user_id',
  format('values (%L::uuid), (%L::uuid), (%L::uuid)', :a_admin, :a_loc1_mgr, :a_staff1),
  'staff A1: ve a sus compañeros de A1 y al org_admin; no al staff de A2'
);

reset role;
select pg_temp.login(:a_staff2);

select results_eq(
  'select id from public.locations',
  format('values (%L::uuid)', :loc_a2),
  'staff A2: solo ve el local A2'
);
select results_eq(
  'select user_id from public.memberships order by user_id',
  format('values (%L::uuid), (%L::uuid)', :a_admin, :a_staff2),
  'staff A2: ve su membership y la del org_admin'
);
select results_eq(
  'select id from public.users order by id',
  format('values (%L::uuid), (%L::uuid)', :a_admin, :a_staff2),
  'staff A2: ve su perfil y el del org_admin'
);
with u as (update public.locations set opening_hours = '{}' where id = :loc_a2 returning 1)
select is(count(*)::int, 0, 'staff A2: no puede modificar su local') from u;

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
  format('values (%L::uuid), (%L::uuid), (%L::uuid), (%L::uuid), (%L::uuid)',
         :a_admin, :a_region_mgr, :a_loc1_mgr, :a_staff1, :a_staff2),
  'region_manager A-Norte: ve al org_admin y a las personas de los locales de su región'
);
with u as (update public.locations set address = 'Calle Norte 2' where id = :loc_a2 returning 1)
select is(count(*)::int, 1, 'region_manager A-Norte: puede cambiar la dirección de A2') from u;
select throws_ok(
  format($$update public.locations set status = 'inactive' where id = %L$$, :loc_a2),
  '42501', 'los managers solo pueden cambiar horario, dirección y zona horaria de un local',
  'region_manager A-Norte: no puede desactivar A2'
);
with u as (update public.locations set opening_hours = '{}' where id = :loc_a3 returning 1)
select is(count(*)::int, 0, 'region_manager A-Norte: no puede modificar A3') from u;
select throws_ok(
  format('update public.locations set region_id = %L where id = %L', :region_a_s, :loc_a2),
  '42501', null,
  'region_manager A-Norte: no puede mover un local de región'
);
select throws_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_a, 'nueva'),
  '42501', null,
  'region_manager: no puede crear regiones'
);

-- ---------------------------------------------------------------------------
-- Tras volver a superusuario: solo han cambiado los campos operativos
-- ---------------------------------------------------------------------------
reset role;
select is((select timezone from public.locations where id = :loc_a1), 'Atlantic/Canary', 'A1: zona horaria cambiada por su manager');
select is((select address from public.locations where id = :loc_a2), 'Calle Norte 2', 'A2: dirección cambiada por su region_manager');
select is((select count(*)::int from public.locations where status <> 'active'), 0, 'ningún local desactivado por un manager');
select is((select count(*)::int from public.locations where name = 'renombrado'), 0, 'ningún local renombrado');
select is((select region_id from public.locations where id = :loc_a1), :region_a_n::uuid, 'A1 sigue en A-Norte');
select is((select role from public.memberships where user_id = :a_loc1_mgr), 'location_manager', 'rol del location_manager intacto');

select * from finish();
rollback;
