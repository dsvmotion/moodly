-- Aislamiento entre organizaciones (MANUAL §4.4): un usuario de A no puede
-- leer ni escribir datos de B, en ninguna de las tablas de tenants.
begin;
\ir _fixtures/tenants.psql
select plan(31);

-- ---------------------------------------------------------------------------
-- Lectura: el org_admin de A solo ve A
-- ---------------------------------------------------------------------------
select pg_temp.login(:a_admin);

select results_eq(
  'select id from public.organizations',
  format('values (%L::uuid)', :org_a),
  'org_admin A: solo ve su organización'
);
select is_empty(
  format('select 1 from public.regions where organization_id = %L', :org_b),
  'org_admin A: no ve regiones de B'
);
select is_empty(
  format('select 1 from public.locations where organization_id = %L', :org_b),
  'org_admin A: no ve locales de B'
);
select is_empty(
  format('select 1 from public.memberships where organization_id = %L', :org_b),
  'org_admin A: no ve memberships de B'
);
select is_empty(
  format('select 1 from public.users where id in (%L, %L)', :b_admin, :b_loc_mgr),
  'org_admin A: no ve perfiles de usuarios de B'
);

-- ---------------------------------------------------------------------------
-- Escritura: el org_admin de A no puede crear, modificar ni borrar en B
-- ---------------------------------------------------------------------------
select throws_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_b, 'intrusa'),
  '42501', null,
  'org_admin A: no puede crear regiones en B'
);
select throws_ok(
  format('insert into public.locations (organization_id, name) values (%L, %L)', :org_b, 'intruso'),
  '42501', null,
  'org_admin A: no puede crear locales en B'
);
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role) values (%L, %L, 'org_admin')$$, :a_admin, :org_b),
  '42501', null,
  'org_admin A: no puede darse de alta en B'
);

with u as (update public.organizations set name = 'hackeada' where id = :org_b returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede modificar la organización B') from u;

with u as (update public.locations set name = 'hackeado' where id = :loc_b1 returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede modificar locales de B') from u;

with u as (update public.memberships set role = 'staff' where organization_id = :org_b returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede modificar memberships de B') from u;

with u as (update public.users set full_name = 'hackeado' where id = :b_admin returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede modificar perfiles de B') from u;

with d as (delete from public.regions where organization_id = :org_b returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede borrar regiones de B') from d;

with d as (delete from public.locations where organization_id = :org_b returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede borrar locales de B') from d;

with d as (delete from public.memberships where organization_id = :org_b returning 1)
select is(count(*)::int, 0, 'org_admin A: no puede borrar memberships de B') from d;

-- Mover una fila propia a B también está prohibido (with check).
select throws_ok(
  format('update public.locations set organization_id = %L where id = %L', :org_b, :loc_a1),
  '42501', null,
  'org_admin A: no puede mover un local suyo a B'
);
-- Con un segundo org_admin en A para que no salte antes la guarda del último
-- admin; se da de baja justo después.
-- El segundo admin lo da de alta la plataforma (el org_admin ya no puede
-- crear memberships: 20261022090000_invitations); después se sigue con la
-- misma sesión del org_admin.
select current_setting('request.jwt.claims', true) as claims_admin \gset
reset role;
insert into public.memberships (user_id, organization_id, role) values (:outsider, :org_a, 'org_admin');
select set_config('request.jwt.claims', :'claims_admin', true), set_config('role', 'authenticated', true);
select throws_ok(
  format('update public.memberships set organization_id = %L where user_id = %L', :org_b, :outsider),
  '42501', null,
  'org_admin A: no puede mover una membership suya a B'
);
delete from public.memberships where user_id = :outsider;

-- ---------------------------------------------------------------------------
-- La otra dirección: el location_manager de B no ve nada de A
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login(:b_loc_mgr);

select results_eq(
  'select id from public.organizations',
  format('values (%L::uuid)', :org_b),
  'location_manager B: solo ve su organización'
);
select is_empty(
  format('select 1 from public.locations where organization_id = %L', :org_a),
  'location_manager B: no ve locales de A'
);
select is_empty(
  format('select 1 from public.memberships where organization_id = %L', :org_a),
  'location_manager B: no ve memberships de A'
);

-- ---------------------------------------------------------------------------
-- Sin membership y sin sesión: nada
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login(:outsider);

select is_empty('select 1 from public.organizations', 'usuario sin membership: no ve organizaciones');
select is_empty('select 1 from public.locations',     'usuario sin membership: no ve locales');
select results_eq(
  'select id from public.users',
  format('values (%L::uuid)', :outsider),
  'usuario sin membership: solo ve su propio perfil'
);

reset role;
set local role anon;
select throws_ok('select 1 from public.organizations', '42501', null, 'anon: sin acceso a organizations');
select throws_ok('select 1 from public.regions',       '42501', null, 'anon: sin acceso a regions');
select throws_ok('select 1 from public.locations',     '42501', null, 'anon: sin acceso a locations');
select throws_ok('select 1 from public.users',         '42501', null, 'anon: sin acceso a users');
select throws_ok('select 1 from public.memberships',   '42501', null, 'anon: sin acceso a memberships');
select throws_ok($$insert into public.organizations (name) values ('anon')$$, '42501', null, 'anon: no puede insertar');

-- ---------------------------------------------------------------------------
-- Comprobación final como superusuario: B sigue intacta
-- ---------------------------------------------------------------------------
reset role;
select is((select name from public.organizations where id = :org_b), 'Org B', 'B: nombre de organización intacto');
select is((select count(*)::int from public.memberships where organization_id = :org_b), 2, 'B: memberships intactas');

select * from finish();
rollback;
