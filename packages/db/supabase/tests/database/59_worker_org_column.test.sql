-- Control 3.2: el worker filtra cada consulta por organization_id, además de
-- RLS (CLAUDE.md; apps/worker/src/tenant-sql-org.test.ts lo vigila en el
-- código). Filtrar por una columna exige poder leerla: sin SELECT sobre
-- organization_id, la consulta falla con 42501 como moodly_worker aunque los
-- tests sin RLS pasen (le pasó a V8 en ingress/, 20261114100000). Por eso: en
-- toda tabla de public con organization_id en la que moodly_worker puede leer
-- alguna columna, también puede leer organization_id. Vale para las tablas
-- que lleguen después.
begin;
select plan(2);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   -- La columna por su número (attnum): has_column_privilege por nombre falla en una tabla que no la tiene,
   -- y SQL no garantiza el orden de un AND.
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
     and has_any_column_privilege('moodly_worker', c.oid, 'select')
     and not has_column_privilege('moodly_worker', c.oid, a.attnum, 'select')),
  null,
  'moodly_worker puede leer organization_id en toda tabla en la que lee algo: filtrar por ella no falla con 42501');

-- Que el test mire algo: hay tablas en las que el worker lee (las del turno, como mínimo).
select cmp_ok(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
     and has_any_column_privilege('moodly_worker', c.oid, 'select')),
  '>=', 10, 'el worker lee en al menos diez tablas de public (el test no pasa por no mirar ninguna)');

select * from finish();
rollback;
