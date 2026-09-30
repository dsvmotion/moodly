-- Garantías estructurales de RLS (MANUAL §4.4). Las consultas son genéricas
-- para que cualquier tabla, política o función nueva quede cubierta sola.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ---------------------------------------------------------------------------
-- RLS en todas las tablas
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Punto 3: toda política de INSERT/UPDATE/ALL lleva WITH CHECK explícito
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'ALL') and with_check is null),
  null,
  'toda política de INSERT/UPDATE de public tiene WITH CHECK'
);

-- ---------------------------------------------------------------------------
-- Tarea 3c-1: toda política exige sesión viva, como primera condición AND y
-- envuelta en (select …) para que se evalúe una vez por consulta (InitPlan).
-- Falla si falta, si va dentro de un OR o si se llama sin envolver.
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public'
     and qual is not null
     and qual not like '(( SELECT private.session_is_active() AS session_is_active) AND %'),
  null,
  'toda política (USING) de public empieza por (select private.session_is_active()) AND'
);

select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public'
     and with_check is not null
     and with_check not like '(( SELECT private.session_is_active() AS session_is_active) AND %'),
  null,
  'toda política (WITH CHECK) de public empieza por (select private.session_is_active()) AND'
);

-- ---------------------------------------------------------------------------
-- Punto 4: anon sin acceso
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(distinct table_name::text order by table_name::text)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  null,
  'anon no tiene privilegios sobre ninguna tabla de public'
);

select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public' and roles <> array['authenticated']::name[]),
  null,
  'todas las políticas de public son solo para authenticated (ninguna para anon ni public)'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon no tiene USAGE sobre el esquema private'
);

-- ---------------------------------------------------------------------------
-- Punto 5: funciones de private (security definer incluidas)
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosecdef
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  null,
  'todas las funciones security definer de public/private fijan search_path vacío'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  null,
  'todas las funciones de private fijan search_path vacío'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace
     and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon no puede ejecutar funciones de private'
);

select is(
  (select array_agg(distinct p.proname::text order by p.proname::text)
   from pg_proc p,
        aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where p.pronamespace = 'private'::regnamespace
     and a.grantee = 0  -- 0 = PUBLIC
     and a.privilege_type = 'EXECUTE'),
  null,
  'ninguna función de private tiene EXECUTE para PUBLIC'
);

-- ---------------------------------------------------------------------------
-- Punto 6: qué datos personales hay en public.users y que auth.users no se ve
-- (si se añade una columna, este test obliga a revisar su exposición).
-- ---------------------------------------------------------------------------
select columns_are(
  'public', 'users',
  array['id', 'full_name', 'locale', 'created_at', 'updated_at'],
  'public.users solo tiene id, full_name, locale y marcas de tiempo'
);

select ok(
  not has_table_privilege('authenticated', 'auth.users', 'select'),
  'authenticated no puede leer auth.users (email, teléfono, metadatos)'
);

select ok(
  not has_table_privilege('anon', 'auth.users', 'select'),
  'anon no puede leer auth.users'
);

-- ---------------------------------------------------------------------------
-- Punto 7: rendimiento
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public'
     and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                        'SELECT auth\.uid\(\)', '', 'gi') ~ 'auth\.uid\(\)'),
  null,
  'las políticas solo usan auth.uid() envuelto en (select ...)'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'private'::regnamespace
     and regexp_replace(p.prosrc, 'select auth\.uid\(\)', '', 'gi') ~ 'auth\.uid\(\)'),
  null,
  'los helpers de private solo usan auth.uid() envuelto en (select ...)'
);

-- Cada FK de public tiene un índice cuyas primeras columnas son las de la FK.
select is(
  (select array_agg(format('%s(%s)', c.conrelid::regclass, c.conkey::text) order by 1)
   from pg_constraint c
   where c.contype = 'f'
     and c.connamespace = 'public'::regnamespace
     and not exists (
       select 1 from pg_index i
       where i.indrelid = c.conrelid
         and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
         and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
     )),
  null,
  'todas las FK de public tienen índice'
);

select has_index(
  'public', 'memberships', 'memberships_user_id_organization_id_key',
  array['user_id', 'organization_id'],
  'memberships (user_id, organization_id): índice de la búsqueda de todos los helpers'
);

select * from finish();
rollback;
