-- OA04, el agente dice el precio: el worker (moodly_worker, ADR 0049) lee el
-- precio y la moneda de los servicios de su organización para el prompt, y no
-- puede escribirlos. Sin migración propia: el SELECT de tabla entera de
-- 20261112040500_worker_role cubre las columnas que añadió
-- 20261113140000_business_setup. Este test lo fija: si alguien lo cambia a
-- privilegios por columna y olvida el precio, falla aquí.
begin;
\ir _fixtures/tenants.psql
select plan(9);

-- ===========================================================================
-- 1. Privilegios
-- ===========================================================================
select ok(has_column_privilege('moodly_worker', 'public.services', 'price_cents', 'select'), 'moodly_worker lee price_cents');
select ok(has_column_privilege('moodly_worker', 'public.services', 'currency', 'select'), 'y currency');
select ok(
  not has_column_privilege('moodly_worker', 'public.services', 'price_cents', 'update')
  and not has_column_privilege('moodly_worker', 'public.services', 'currency', 'update'),
  'no puede cambiarlos');
select ok(
  not has_table_privilege('moodly_worker', 'public.services', 'insert')
  and not has_table_privilege('moodly_worker', 'public.services', 'delete'),
  'ni crear ni borrar servicios');

-- ===========================================================================
-- 2. Datos (como la plataforma): un servicio con precio en A y otro en B
-- ===========================================================================
insert into public.services (organization_id, name, duration_minutes, price_cents, currency)
values (:org_a, 'Láser', 30, 4500, 'EUR') returning id as svc_a \gset
insert into public.services (organization_id, name, duration_minutes, price_cents, currency)
values (:org_b, 'Corte', 45, 2000, 'GBP') returning id as svc_b \gset

-- Como en 42_worker_role: postgres actúa como el rol solo dentro de este test.
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

-- ===========================================================================
-- 3. Con A fijada: el precio de A, nada de B
-- ===========================================================================
select results_eq(
  format('select price_cents, currency from public.services where id = %L', :'svc_a'),
  $$values (4500, 'EUR')$$,
  'con A fijada lee el precio y la moneda del servicio de A');
select is(
  (select count(*)::int from public.services where id = :'svc_b'),
  0, 'y no ve el servicio de B, ni su precio');

-- ===========================================================================
-- 4. En negativo: no escribe el precio
-- ===========================================================================
select throws_ok(
  format('update public.services set price_cents = 1 where id = %L', :'svc_a'),
  '42501', null, 'cambiar el precio de un servicio de A: permiso denegado');
select throws_ok(
  format('update public.services set currency = %L where id = %L', 'USD', :'svc_a'),
  '42501', null, 'cambiar la moneda: permiso denegado');

reset role;
select results_eq(
  format('select price_cents, currency from public.services where id = %L', :'svc_a'),
  $$values (4500, 'EUR')$$,
  'el precio sigue como estaba');

select * from finish();
rollback;
