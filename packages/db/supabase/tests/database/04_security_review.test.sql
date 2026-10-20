-- Revisión de seguridad previa al merge del PR #2:
--   1. Escalada de rol y de alcance por parte de roles no admin.
--   2. Alcance cruzado entre organizaciones (integridad + defensa en SELECT).
--   3. WITH CHECK (aislado de las guardas): no se crean ni mueven filas a otra organización.
begin;
\ir _fixtures/tenants.psql
select plan(32);

-- ===========================================================================
-- 1. Escalada: staff, location_manager y region_manager
--    (el location_manager tiene además sus casos en 02_location_scope)
-- ===========================================================================
select pg_temp.login(:a_staff1);

with u as (
  update public.memberships set scope_location_ids = array[:loc_a1, :loc_a2]::uuid[]
  where user_id = :a_staff1 returning 1
)
select is(count(*)::int, 0, 'staff: no puede ampliar su alcance') from u;
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'staff', array[%L]::uuid[])$$, :outsider, :org_a, :loc_a1),
  '42501', null,
  'staff: no puede crear memberships'
);
with d as (delete from public.memberships where user_id = :a_loc1_mgr returning 1)
select is(count(*)::int, 0, 'staff: no puede borrar la membership de su manager') from d;
-- El cambio de rol va el último: si fallara, no contamina los intentos anteriores.
with u as (
  update public.memberships set role = 'org_admin', scope_location_ids = '{}'
  where user_id = :a_staff1 returning 1
)
select is(count(*)::int, 0, 'staff: no puede cambiar su rol') from u;

reset role;
select pg_temp.login(:a_region_mgr);

with u as (
  update public.memberships set scope_region_ids = array[:region_a_n, :region_a_s]::uuid[]
  where user_id = :a_region_mgr returning 1
)
select is(count(*)::int, 0, 'region_manager: no puede ampliar su alcance de regiones') from u;
with u as (
  update public.memberships set scope_location_ids = array[:loc_a1, :loc_a2]::uuid[]
  where user_id = :a_staff1 returning 1
)
select is(count(*)::int, 0, 'region_manager: no puede cambiar el alcance del staff de su región') from u;
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'location_manager', array[%L]::uuid[])$$, :outsider, :org_a, :loc_a2),
  '42501', null,
  'region_manager: no puede crear memberships'
);
with u as (
  update public.memberships set role = 'org_admin', scope_region_ids = '{}'
  where user_id = :a_region_mgr returning 1
)
select is(count(*)::int, 0, 'region_manager: no puede cambiar su rol') from u;

reset role;
select pg_temp.login(:outsider);
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role) values (%L, %L, 'org_admin')$$, :outsider, :org_a),
  '42501', null,
  'usuario sin membership: no puede darse de alta como org_admin'
);

reset role;
select is(
  (select array_agg(role || ':' || cardinality(scope_region_ids) || ':' || cardinality(scope_location_ids) order by user_id)
   from public.memberships where organization_id = :org_a),
  array['org_admin:0:0', 'region_manager:1:0', 'location_manager:0:1', 'staff:0:1', 'staff:0:1'],
  'tras los intentos: roles y alcances de A intactos'
);

-- ===========================================================================
-- 2a. Integridad: el alcance de una membership de A no puede apuntar a B
--     (trigger validate_scope), ni en alta ni en modificación.
-- ===========================================================================
select pg_temp.login(:a_admin);

select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'location_manager', array[%L, %L]::uuid[])$$, :outsider, :org_a, :loc_a1, :loc_b1),
  '23503', null,
  'org_admin A: alta con un local de B en el alcance → rechazada'
);
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_region_ids)
           values (%L, %L, 'region_manager', array[%L]::uuid[])$$, :outsider, :org_a, :region_b_c),
  '23503', null,
  'org_admin A: alta con una región de B en el alcance → rechazada'
);
select throws_ok(
  format('update public.memberships set scope_location_ids = array[%L]::uuid[] where user_id = %L', :loc_b1, :a_staff1),
  '23503', null,
  'org_admin A: modificar alcance a un local de B → rechazado'
);
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'staff', array[%L]::uuid[])$$, :outsider, :org_a, gen_random_uuid()),
  '23503', null,
  'org_admin A: alta con un local inexistente en el alcance → rechazada'
);

-- ===========================================================================
-- 2b. Defensa en profundidad: aunque el dato existiera (trigger desactivado
--     a propósito como superusuario), las políticas no dan acceso a B.
-- ===========================================================================
reset role;
insert into auth.users (id, email, aud, role) values
  ('d3000000-0000-4000-8000-000000000001', 'x_loc@test.local',    'authenticated', 'authenticated'),
  ('d3000000-0000-4000-8000-000000000002', 'x_region@test.local', 'authenticated', 'authenticated');
insert into public.users (id) values
  ('d3000000-0000-4000-8000-000000000001'),
  ('d3000000-0000-4000-8000-000000000002');

alter table public.memberships disable trigger validate_scope;
insert into public.memberships (user_id, organization_id, role, scope_region_ids, scope_location_ids) values
  ('d3000000-0000-4000-8000-000000000001', :org_a, 'location_manager', '{}', array[:loc_b1]::uuid[]),
  ('d3000000-0000-4000-8000-000000000002', :org_a, 'region_manager', array[:region_b_c]::uuid[], '{}');
alter table public.memberships enable trigger validate_scope;

select pg_temp.login('d3000000-0000-4000-8000-000000000001');
select is_empty('select 1 from public.locations', 'alcance corrupto → local de B: no ve ningún local');
select is_empty(format('select 1 from public.regions where id = %L', :region_b_c), 'alcance corrupto → local de B: no ve la región de B');
with u as (update public.locations set opening_hours = '{}' where id = :loc_b1 returning 1)
select is(count(*)::int, 0, 'alcance corrupto → local de B: no puede modificarlo') from u;
select is_empty(
  format('select 1 from public.memberships where organization_id = %L', :org_b),
  'alcance corrupto → local de B: no ve memberships de B'
);
select is_empty(
  format('select 1 from public.users where id in (%L, %L)', :b_admin, :b_loc_mgr),
  'alcance corrupto → local de B: no ve perfiles de B'
);

reset role;
select pg_temp.login('d3000000-0000-4000-8000-000000000002');
select is_empty('select 1 from public.regions',   'alcance corrupto → región de B: no ve ninguna región');
select is_empty('select 1 from public.locations', 'alcance corrupto → región de B: no ve ningún local');
with u as (update public.locations set status = 'inactive' where id = :loc_b1 returning 1)
select is(count(*)::int, 0, 'alcance corrupto → región de B: no puede modificar B1') from u;

-- ===========================================================================
-- 3. WITH CHECK, aislado: las guardas de columnas inmutables
--    (05_review_guards) frenan antes cualquier cambio de organization_id, así
--    que aquí se desactivan a propósito para probar que el WITH CHECK de cada
--    política, por sí solo, tampoco deja crear ni mover filas a B. Se comprueba
--    el mensaje para saber qué capa ha frenado.
-- ===========================================================================
reset role;
alter table public.organizations disable trigger guard_fields;
alter table public.regions       disable trigger guard_immutable;
alter table public.locations     disable trigger guard_immutable;
alter table public.memberships   disable trigger guard_immutable;
insert into public.regions (id, organization_id, name)
values ('a1000000-0000-4000-8000-0000000000ff', :org_a, 'Temporal');

select pg_temp.login(:a_admin);

select throws_like(
  format($$update public.regions set organization_id = %L where id = 'a1000000-0000-4000-8000-0000000000ff'$$, :org_b),
  '%row-level security%',
  'WITH CHECK: org_admin A no puede mover una región a B'
);
select throws_like(
  format('insert into public.locations (organization_id, name) values (%L, %L)', :org_b, 'fuera'),
  '%row-level security%',
  'WITH CHECK: org_admin A no puede crear un local en B'
);
select throws_like(
  'update public.organizations set id = gen_random_uuid()',
  '%row-level security%',
  'WITH CHECK: UPDATE sin WHERE no cambia el id de su organización'
);

-- Sin WHERE, la política de SELECT no se aplica a la fila nueva: el WITH CHECK
-- es la única barrera contra mover toda la organización a B.
select throws_like(
  format('update public.locations set organization_id = %L, region_id = null', :org_b),
  '%row-level security%',
  'WITH CHECK: UPDATE sin WHERE no mueve los locales de A a B'
);
select throws_like(
  format('update public.regions set organization_id = %L', :org_b),
  '%row-level security%',
  'WITH CHECK: UPDATE sin WHERE no mueve las regiones de A a B'
);
-- Su propia membership la ve también en B (política de SELECT), así que aquí
-- solo frena el WITH CHECK. Hace falta un segundo admin para que no salte
-- antes la guarda del último admin.
-- El segundo admin lo da de alta la plataforma (el org_admin ya no puede
-- crear memberships: 20261021110000_invitations); después se sigue con la
-- misma sesión del org_admin.
select current_setting('request.jwt.claims', true) as claims_admin \gset
reset role;
insert into public.memberships (user_id, organization_id, role) values (:outsider, :org_a, 'org_admin');
select set_config('request.jwt.claims', :'claims_admin', true), set_config('role', 'authenticated', true);
select throws_like(
  format('update public.memberships set organization_id = %L where user_id = %L', :org_b, :a_admin),
  '%row-level security%',
  'WITH CHECK: org_admin A no puede mover su propia membership a B'
);
delete from public.memberships where user_id = :outsider;

reset role;
alter table public.organizations enable trigger guard_fields;
alter table public.regions       enable trigger guard_immutable;
alter table public.locations     enable trigger guard_immutable;
alter table public.memberships   enable trigger guard_immutable;

select pg_temp.login(:outsider);
select throws_like(
  format('update public.users set id = %L where id = %L', gen_random_uuid(), :outsider),
  '%row-level security%',
  'WITH CHECK: un usuario no puede cambiar el id de su perfil'
);
select throws_like(
  format('insert into public.users (id, full_name) values (%L, %L)', :b_admin, 'suplantado'),
  '%row-level security%',
  'WITH CHECK: un usuario no puede crear el perfil de otro'
);

reset role;
select is(
  (select count(*)::int from public.locations where organization_id = :org_b),
  1,
  'B sigue con un solo local'
);
select is(
  (select count(*)::int from public.regions where organization_id = :org_b),
  1,
  'B sigue con una sola región'
);

select * from finish();
rollback;
