-- Esquema de DBOS (20261023200000_dbos_system_schema) y rol del worker
-- (20261023200100_dbos_worker_role): ADR 0027, regla 6.
begin;
select plan(14);

-- ===========================================================================
-- 1. El esquema está y en la versión que pide el worker
-- ===========================================================================
select has_schema('dbos', 'existe el esquema de DBOS');

-- DBOS 5.3.0 exige la 123 (la misma que la 5.2.11: no trae migraciones
-- nuevas): con menos, el worker no arranca. Al subir de versión, la migración
-- nueva y este número cambian en el mismo PR.
select is((select max(version) from dbos.dbos_migrations), 123::bigint,
  'el esquema de DBOS está en la versión 123 (la de @dbos-inc/dbos-sdk 5.3.0)');

-- ===========================================================================
-- 2. Nadie de la app ni de la API llega al esquema
-- ===========================================================================
select is(
  (select array_agg(r order by r) from unnest(array['public', 'anon', 'authenticated', 'service_role']) as r
   where (r = 'public' and exists (
            select 1 from pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
            where n.nspname = 'dbos' and a.grantee = 0))
      or (r <> 'public' and has_schema_privilege(r, 'dbos', 'USAGE'))),
  null,
  'ni PUBLIC, ni anon, ni authenticated, ni service_role usan el esquema dbos');

select is(
  (select array_agg(c.relname || ':' || g.grantee order by c.relname, g.grantee)
   from pg_class c
   cross join lateral (
     select coalesce(r.rolname, 'PUBLIC') as grantee
     from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     left join pg_roles r on r.oid = a.grantee
     where a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role')
   ) g
   where c.relnamespace = 'dbos'::regnamespace and c.relkind in ('r', 'p', 'S', 'v')),
  null,
  'ninguna tabla ni secuencia de dbos da privilegios a PUBLIC, anon, authenticated ni service_role');

select is(
  (select array_agg(p.proname || ':' || coalesce(r.rolname, 'PUBLIC') order by p.proname)
   from pg_proc p
   cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   left join pg_roles r on r.oid = a.grantee
   where p.pronamespace = 'dbos'::regnamespace
     and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))),
  null,
  'ninguna función de dbos se puede ejecutar como PUBLIC, anon, authenticated ni service_role');

select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'dbos'::regnamespace and p.prosecdef),
  0,
  'ninguna función de dbos es SECURITY DEFINER');

-- Las funciones que lleguen en próximas migraciones de DBOS tampoco nacen
-- ejecutables por PUBLIC.
select ok(
  exists (
    select 1 from pg_default_acl d
    where d.defaclnamespace = 'dbos'::regnamespace and d.defaclobjtype = 'f'
      and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)),
  'privilegios por defecto en dbos: las funciones nuevas no son de PUBLIC');

-- ===========================================================================
-- 3. El rol del worker: lo justo en dbos y nada fuera
-- ===========================================================================
select is(
  (select array[rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolinherit, rolreplication]
   from pg_roles where rolname = 'dbos_worker'),
  array[false, false, false, false, false, false],
  'dbos_worker: sin superusuario, sin crear roles ni bases de datos, sin saltarse RLS, sin heredar ni replicar');

select is(
  (select count(*)::int from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = 'dbos_worker'),
  0,
  'dbos_worker no es miembro de ningún rol');

select is(
  (select array_agg(s order by s) from unnest(array['dbos', 'public', 'private']) as s
   where has_schema_privilege('dbos_worker', s, 'CREATE')),
  null,
  'dbos_worker no crea nada (sin CREATE en dbos, public ni private)');

select is(
  (select array_agg(c.relname || ':' || p order by c.relname, p)
   from pg_class c
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
   where c.relnamespace = 'dbos'::regnamespace and c.relkind in ('r', 'p')
     and not has_table_privilege('dbos_worker', c.oid, p)),
  null,
  'dbos_worker lee y escribe todas las tablas de dbos');

select is(
  (select array_agg(c.relname || ':' || p order by c.relname, p)
   from pg_class c
   cross join unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where c.relnamespace = 'dbos'::regnamespace and c.relkind in ('r', 'p')
     and has_table_privilege('dbos_worker', c.oid, p)),
  null,
  'dbos_worker no tiene TRUNCATE, REFERENCES ni TRIGGER en dbos');

select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p
   where p.pronamespace = 'dbos'::regnamespace
     and not has_function_privilege('dbos_worker', p.oid, 'EXECUTE')),
  null,
  'dbos_worker ejecuta todas las funciones de dbos');

select is(
  (select array_agg(n.nspname || '.' || c.relname order by n.nspname, c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private', 'auth', 'storage') and c.relkind in ('r', 'p', 'v')
     and (has_table_privilege('dbos_worker', c.oid, 'SELECT')
       or has_table_privilege('dbos_worker', c.oid, 'INSERT')
       or has_table_privilege('dbos_worker', c.oid, 'UPDATE')
       or has_table_privilege('dbos_worker', c.oid, 'DELETE'))),
  null,
  'dbos_worker no lee ni escribe ninguna tabla de public, private, auth ni storage');

select * from finish();
rollback;
