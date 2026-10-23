-- Mínimo privilegio para authenticated (20261023130000_least_privilege_users_guard,
-- auditoría R-20) y guarda de columnas de public.users (R-35).
begin;
\ir _fixtures/tenants.psql
select plan(16);

-- ===========================================================================
-- 1. Estructura: ningún privilegio de authenticated sin una política que lo use
-- ===========================================================================
-- Supabase concede a authenticated todos los privilegios en cada tabla nueva de
-- public. Si una tabla nueva no los revoca, este test lo dice.
select is(
  (select array_agg(c.relname || ':' || p order by c.relname, p)
   from pg_class c
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and has_table_privilege('authenticated', c.oid, p)
     and not exists (
       select 1 from pg_policies pol
       where pol.schemaname = 'public' and pol.tablename = c.relname
         and pol.cmd in (p, 'ALL')
         and pol.roles && array['authenticated', 'public']::name[]
     )),
  null,
  'authenticated no tiene ningún privilegio sin una política que lo use'
);

select is(
  (select array_agg(table_name || ':' || privilege_type order by table_name, privilege_type)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name in ('organizations', 'regions', 'locations', 'users', 'memberships')),
  array[
    'locations:INSERT', 'locations:SELECT', 'locations:UPDATE',
    'memberships:DELETE', 'memberships:SELECT', 'memberships:UPDATE',
    'organizations:SELECT', 'organizations:UPDATE',
    'regions:INSERT', 'regions:SELECT', 'regions:UPDATE',
    'users:INSERT', 'users:SELECT', 'users:UPDATE'
  ]::text[],
  'tablas de tenants: authenticated solo tiene los privilegios que usan sus políticas'
);

-- ===========================================================================
-- 2. Lo revocado ya no llega a RLS: 42501 en vez de 0 filas
-- ===========================================================================
select pg_temp.login_mfa(:a_admin);
select throws_ok($$insert into public.organizations (name) values ('nueva')$$, '42501', null,
  'org_admin: no puede crear organizaciones');
select throws_ok(format('delete from public.organizations where id = %L', :org_a), '42501', null,
  'org_admin: no puede borrar su organización');
select throws_ok(format('delete from public.regions where id = %L', :region_a_s), '42501', null,
  'org_admin: no puede borrar regiones (se desactivan)');
select throws_ok(format('delete from public.locations where id = %L', :loc_a3), '42501', null,
  'org_admin: no puede borrar locales (se desactivan)');
select throws_ok(format('delete from public.users where id = %L', :a_admin), '42501', null,
  'org_admin: no puede borrar su perfil');
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role) values (%L, %L, 'staff')$$, :outsider, :org_a),
  '42501', null,
  'org_admin: no puede crear memberships (solo accept_invitation)'
);

-- ===========================================================================
-- 3. Guarda de public.users: solo full_name y locale
-- ===========================================================================
reset role;
select created_at as staff1_created_at from public.users where id = :a_staff1 \gset

select pg_temp.login(:a_staff1);
with u as (update public.users set full_name = 'Nombre nuevo' where id = :a_staff1 returning 1)
select is(count(*)::int, 1, 'staff: puede cambiar su nombre') from u;
with u as (update public.users set locale = 'en-GB' where id = :a_staff1 returning 1)
select is(count(*)::int, 1, 'staff: puede cambiar su idioma') from u;
select throws_ok(
  format($$update public.users set created_at = '2001-01-01' where id = %L$$, :a_staff1),
  '42501', 'desde la app solo se pueden cambiar full_name y locale del perfil',
  'staff: no puede cambiar su created_at'
);
select throws_ok(
  format('update public.users set id = gen_random_uuid() where id = %L', :a_staff1),
  '42501', null,
  'staff: no puede cambiar su id'
);
with u as (update public.users set full_name = 'Hackeado' where id = :a_staff2 returning 1)
select is(count(*)::int, 0, 'staff: no puede cambiar el perfil de otra persona') from u;

reset role;
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$update public.users set created_at = '2001-01-01' where id = %L$$, :a_admin),
  '42501', 'desde la app solo se pueden cambiar full_name y locale del perfil',
  'org_admin con MFA: tampoco puede cambiar su created_at'
);

reset role;
select is(
  (select created_at from public.users where id = :a_staff1),
  :'staff1_created_at'::timestamptz,
  'tras los intentos: created_at intacto'
);
-- La plataforma (aquí, el superusuario) no queda bloqueada por la guarda.
with u as (update public.users set created_at = '2001-01-01' where id = :a_staff1 returning 1)
select is(count(*)::int, 1, 'plataforma: puede cambiar created_at') from u;

select * from finish();
rollback;
