-- Garantías estructurales de RLS (MANUAL §4.4). Las consultas son genéricas
-- para que cualquier tabla nueva en public quede cubierta automáticamente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and not c.relrowsecurity),
  null,
  'todas las tablas de public tienen RLS activado'
);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and not c.relforcerowsecurity),
  null,
  'todas las tablas de public tienen RLS forzado'
);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  null,
  'todas las tablas de public tienen al menos una política'
);

select is(
  (select array_agg(distinct table_name::text order by table_name::text)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  null,
  'anon no tiene privilegios sobre ninguna tabla de public'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace
     and p.prosecdef
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  null,
  'las funciones security definer de private fijan search_path vacío'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace
     and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon no puede ejecutar funciones de private'
);

select * from finish();
rollback;
