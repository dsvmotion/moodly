-- El org_admin ve y gestiona toda su organización (MANUAL §4.4), y la
-- integridad impide colar alcances o regiones de otra organización.
begin;
\ir _fixtures/tenants.psql
select plan(21);

select pg_temp.login(:a_admin);

-- ---------------------------------------------------------------------------
-- Lectura de toda la organización
-- ---------------------------------------------------------------------------
select results_eq(
  'select id from public.regions order by id',
  format('values (%L::uuid), (%L::uuid)', :region_a_n, :region_a_s),
  'org_admin A: ve todas las regiones de A'
);
select results_eq(
  'select id from public.locations order by id',
  format('values (%L::uuid), (%L::uuid), (%L::uuid)', :loc_a1, :loc_a2, :loc_a3),
  'org_admin A: ve todos los locales de A'
);
select is(
  (select count(*)::int from public.memberships),
  5,
  'org_admin A: ve las 5 memberships de A'
);
select is(
  (select count(*)::int from public.users),
  5,
  'org_admin A: ve los 5 perfiles de A (y ninguno más)'
);

-- ---------------------------------------------------------------------------
-- Gestión dentro de su organización
-- ---------------------------------------------------------------------------
with u as (update public.organizations set name = 'Org A renombrada' where id = :org_a returning 1)
select is(count(*)::int, 1, 'org_admin A: puede renombrar su organización') from u;

select lives_ok(
  format('insert into public.locations (organization_id, region_id, name) values (%L, %L, %L)', :org_a, :region_a_s, 'Local A4'),
  'org_admin A: puede crear un local'
);
with u as (update public.locations set name = 'Local A1 bis' where id = :loc_a1 returning 1)
select is(count(*)::int, 1, 'org_admin A: puede modificar un local') from u;

select lives_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'staff', array[%L]::uuid[])$$, :outsider, :org_a, :loc_a3),
  'org_admin A: puede dar de alta a un usuario como staff de A3'
);
with u as (update public.memberships set scope_location_ids = array[:loc_a2]::uuid[] where user_id = :a_staff1 returning 1)
select is(count(*)::int, 1, 'org_admin A: puede cambiar el alcance de una membership') from u;

-- ---------------------------------------------------------------------------
-- Integridad: nada de alcances ni regiones de otra organización
-- ---------------------------------------------------------------------------
select throws_ok(
  format('update public.memberships set scope_location_ids = array[%L]::uuid[] where user_id = %L', :loc_b1, :a_staff1),
  '23503', null,
  'org_admin A: no puede asignar un local de B a un alcance de A'
);
select throws_ok(
  format('update public.memberships set scope_region_ids = array[%L]::uuid[] where user_id = %L', :region_b_c, :a_region_mgr),
  '23503', null,
  'org_admin A: no puede asignar una región de B a un alcance de A'
);
select throws_ok(
  format('insert into public.locations (organization_id, region_id, name) values (%L, %L, %L)', :org_a, :region_b_c, 'cruzado'),
  '23503', null,
  'org_admin A: no puede colgar un local de A de una región de B'
);
select throws_ok(
  format($$update public.memberships set role = 'location_manager' where user_id = %L$$, :a_region_mgr),
  '23514', null,
  'rol y alcance deben ser coherentes (region_manager sin locales → location_manager rechazado)'
);

-- ---------------------------------------------------------------------------
-- Regiones y locales no se borran desde la app: se desactivan
-- ---------------------------------------------------------------------------
with d as (delete from public.locations where id = :loc_a3 returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede borrar locales (se desactivan)') from d;
with d as (delete from public.regions where id = :region_a_s returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede borrar regiones') from d;

-- El usuario dado de alta ya ve lo que le toca.
reset role;
select pg_temp.login(:outsider);
select results_eq(
  'select id from public.locations',
  format('values (%L::uuid)', :loc_a3),
  'el usuario dado de alta como staff de A3 ve solo A3'
);

-- ---------------------------------------------------------------------------
-- La organización nunca se queda sin org_admin
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login(:a_admin);

select throws_ok(
  format($$update public.memberships set role = 'staff', scope_location_ids = array[%L]::uuid[] where user_id = %L$$, :loc_a1, :a_admin),
  '23514', null,
  'último org_admin: no puede degradarse'
);
select throws_ok(
  format('delete from public.memberships where user_id = %L', :a_admin),
  '23514', null,
  'último org_admin: no puede borrar su membership'
);

-- Con un segundo org_admin, ya puede.
with u as (
  update public.memberships set role = 'org_admin', scope_location_ids = '{}'
  where user_id = :outsider returning 1
)
select is(count(*)::int, 1, 'org_admin A: puede nombrar a otro org_admin') from u;
with u as (
  update public.memberships set role = 'staff', scope_location_ids = array[:loc_a1]::uuid[]
  where user_id = :a_admin returning 1
)
select is(count(*)::int, 1, 'con otro org_admin, el primero sí puede degradarse') from u;

-- La plataforma (fuera del rol authenticated) no queda bloqueada.
reset role;
select lives_ok(
  format($$delete from public.memberships where organization_id = %L and role = 'org_admin'$$, :org_a),
  'plataforma: puede retirar al último org_admin'
);

select * from finish();
rollback;
