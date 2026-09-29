-- Revisión humana del PR #2:
--   1. organizations: el org_admin solo cambia name, vertical y default_locale.
--   2. organization_id inmutable en regions, locations y memberships; user_id
--      inmutable en memberships. Solo la plataforma mueve filas.
--   3. locations.status solo lo cambia el org_admin (los managers, en 02).
--   4. Mínimo privilegio: sin TRUNCATE, REFERENCES ni TRIGGER para
--      authenticated, y nada para anon.
begin;
\ir _fixtures/tenants.psql
select plan(21);

-- ===========================================================================
-- 1. Campos de la organización
-- ===========================================================================
select pg_temp.login(:a_admin);

with u as (
  update public.organizations set name = 'Org A S.L.', vertical = 'peluquería', default_locale = 'ca-ES'
  where id = :org_a returning 1
)
select is(count(*)::int, 1, 'org_admin: puede cambiar name, vertical y default_locale') from u;

select throws_ok(
  format($$update public.organizations set plan = 'enterprise' where id = %L$$, :org_a),
  '42501', 'desde la app solo se pueden cambiar name, vertical y default_locale de la organización',
  'org_admin: no puede cambiar plan'
);
select throws_ok(
  format($$update public.organizations set contract_type = 'enterprise' where id = %L$$, :org_a),
  '42501', 'desde la app solo se pueden cambiar name, vertical y default_locale de la organización',
  'org_admin: no puede cambiar contract_type'
);
select throws_ok(
  format($$update public.organizations set status = 'archived' where id = %L$$, :org_a),
  '42501', 'desde la app solo se pueden cambiar name, vertical y default_locale de la organización',
  'org_admin: no puede cambiar status'
);
select throws_ok(
  format($$update public.organizations set kind = 'personal' where id = %L$$, :org_a),
  '42501', 'desde la app solo se pueden cambiar name, vertical y default_locale de la organización',
  'org_admin: no puede cambiar kind'
);
select throws_ok(
  format($$update public.organizations set data_region = 'us' where id = %L$$, :org_a),
  '42501', 'desde la app solo se pueden cambiar name, vertical y default_locale de la organización',
  'org_admin: no puede cambiar data_region'
);
select throws_ok(
  format($$update public.organizations set created_at = now() - interval '1 year' where id = %L$$, :org_a),
  '42501', 'desde la app solo se pueden cambiar name, vertical y default_locale de la organización',
  'org_admin: no puede cambiar otras columnas (lista blanca)'
);

reset role;
with u as (update public.organizations set plan = 'enterprise', status = 'suspended' where id = :org_a returning 1)
select is(count(*)::int, 1, 'plataforma: puede cambiar plan y status') from u;
update public.organizations set status = 'active' where id = :org_a;

-- ===========================================================================
-- 2. organization_id y user_id inmutables desde la app
-- ===========================================================================
select pg_temp.login(:a_admin);

select throws_ok(
  format('update public.regions set organization_id = %L where id = %L', :org_b, :region_a_s),
  '42501', 'la columna regions.organization_id no se puede cambiar desde la app',
  'org_admin: no puede cambiar organization_id de una región'
);
select throws_ok(
  format('update public.locations set organization_id = %L, region_id = null where id = %L', :org_b, :loc_a3),
  '42501', 'la columna locations.organization_id no se puede cambiar desde la app',
  'org_admin: no puede cambiar organization_id de un local'
);
select throws_ok(
  format('update public.memberships set organization_id = %L where user_id = %L', :org_b, :a_staff1),
  '42501', 'la columna memberships.organization_id no se puede cambiar desde la app',
  'org_admin: no puede cambiar organization_id de una membership'
);
select throws_ok(
  format('update public.memberships set user_id = %L where user_id = %L', :outsider, :a_staff1),
  '42501', 'la columna memberships.user_id no se puede cambiar desde la app',
  'org_admin: no puede reasignar una membership a otra persona'
);

reset role;
select pg_temp.login(:a_loc1_mgr);
select throws_ok(
  format('update public.locations set organization_id = %L where id = %L', :org_b, :loc_a1),
  '42501', 'la columna locations.organization_id no se puede cambiar desde la app',
  'location_manager: no puede mover su local a B'
);

reset role;
insert into public.regions (id, organization_id, name)
values ('a1000000-0000-4000-8000-0000000000ee', :org_a, 'Para traspasar');
select lives_ok(
  format($$update public.regions set organization_id = %L where id = 'a1000000-0000-4000-8000-0000000000ee'$$, :org_b),
  'plataforma: puede mover una región entre organizaciones'
);
select lives_ok(
  format('update public.memberships set user_id = %L where user_id = %L', :outsider, :a_staff2),
  'plataforma: puede reasignar una membership'
);

-- ===========================================================================
-- 3. Activar o desactivar un local: solo org_admin
-- ===========================================================================
select pg_temp.login(:a_admin);
with u as (update public.locations set status = 'inactive' where id = :loc_a3 returning 1)
select is(count(*)::int, 1, 'org_admin: puede desactivar un local') from u;

-- ===========================================================================
-- 4. Mínimo privilegio
-- ===========================================================================
reset role;
select is(
  (select array_agg(c.relname || ':' || p order by c.relname, p)
   from pg_class c
   cross join unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and has_table_privilege('authenticated', c.oid, p)),
  null,
  'authenticated no tiene TRUNCATE, REFERENCES ni TRIGGER en ninguna tabla de public'
);
select is(
  (select array_agg(c.relname || ':' || p order by c.relname, p)
   from pg_class c
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and has_table_privilege('anon', c.oid, p)),
  null,
  'anon no tiene ningún privilegio en ninguna tabla de public'
);

-- TRUNCATE no pasa por RLS: sin el revoke, esto vaciaría todas las organizaciones.
select pg_temp.login(:outsider);
select throws_ok('truncate public.memberships', '42501', null, 'usuario sin membership: no puede truncar memberships');
reset role;
select pg_temp.login(:a_admin);
select throws_ok('truncate public.locations cascade', '42501', null, 'org_admin: no puede truncar locations');

reset role;
select is((select count(*)::int from public.memberships where organization_id = :org_b), 2, 'B conserva sus memberships');

select * from finish();
rollback;
