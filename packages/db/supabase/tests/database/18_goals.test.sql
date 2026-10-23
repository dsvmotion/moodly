-- Objetivos del negocio (20261023190000_goals, MANUAL §6.3): integridad del
-- alcance y de la persona responsable, quién los lee según su alcance, quién
-- los gestiona (managers en lo suyo, org_admin con aal2 en todo), guardas y
-- progreso de solo lectura para la app.
begin;
\ir _fixtures/tenants.psql
select plan(46);

\set g_org_a  '''90a10000-0000-4000-8000-000000000001'''
\set g_reg_an '''90a10000-0000-4000-8000-000000000002'''
\set g_reg_as '''90a10000-0000-4000-8000-000000000003'''
\set g_loc_a1 '''90a10000-0000-4000-8000-000000000004'''
\set g_loc_a3 '''90a10000-0000-4000-8000-000000000005'''
\set g_loc_b1 '''90b10000-0000-4000-8000-000000000001'''

-- Como plataforma: un objetivo en cada alcance de A y uno en B, con progreso.
insert into public.goals (id, organization_id, scope, scope_id, title, metric_key, target_value, period, owner_user_id) values
  (:g_org_a,  :org_a, 'organization', :org_a,      'Citas al mes',          'appointments.booked', 400, 'month', :a_admin),
  (:g_reg_an, :org_a, 'region',       :region_a_n, 'Leads en el norte',     'leads.qualified',     80,  'month', :a_region_mgr),
  (:g_reg_as, :org_a, 'region',       :region_a_s, 'Leads en el sur',       'leads.qualified',     60,  'month', null),
  (:g_loc_a1, :org_a, 'location',     :loc_a1,     'Respuesta en A1',       'response.time_p50',   120, 'week',  :a_loc1_mgr),
  (:g_loc_a3, :org_a, 'location',     :loc_a3,     'Citas en A3',           'appointments.booked', 90,  'month', null),
  (:g_loc_b1, :org_b, 'location',     :loc_b1,     'Citas en B1',           'appointments.booked', 50,  'month', :b_loc_mgr);
update public.goals set direction = 'at_most' where id = :g_loc_a1;

insert into public.goal_progress (goal_id, organization_id, value, source) values
  (:g_loc_a1, :org_a, 140, 'internal'),
  (:g_loc_b1, :org_b, 12,  'integration');

-- ===========================================================================
-- 1. Integridad (también para la plataforma)
-- ===========================================================================
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'region', %L, 'x', 'leads.qualified', 1, 'month')$$, :org_a, :region_b_c),
  '23514', null, 'una región de otra organización no vale como alcance');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'location', %L, 'x', 'leads.qualified', 1, 'month')$$, :org_a, :loc_b1),
  '23514', null, 'un local de otra organización no vale como alcance');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period, owner_user_id)
           values (%L, 'organization', %L, 'x', 'leads.qualified', 1, 'month', %L)$$, :org_a, :org_a, :b_admin),
  '23514', null, 'la persona responsable tiene que ser de la organización');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'organization', %L, 'x', 'leads.qualified', 1, 'month')$$, :org_a, :org_b),
  '23514', null, 'el alcance de organización es la propia organización');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'organization', %L, 'x', 'leads.qualified', 1, 'once')$$, :org_a, :org_a),
  '23514', null, 'un objetivo de una vez necesita fecha límite');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period, due_date)
           values (%L, 'organization', %L, 'x', 'leads.qualified', 1, 'month', current_date + 30)$$, :org_a, :org_a),
  '23514', null, 'uno recurrente no lleva fecha límite');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'organization', %L, 'x', 'Leads; drop', 1, 'month')$$, :org_a, :org_a),
  '23514', null, 'la clave de la métrica tiene un formato fijo');
select throws_ok(
  format($$insert into public.goal_progress (goal_id, organization_id, value, source) values (%L, %L, 1, 'internal')$$, :g_loc_a1, :org_b),
  '23514', null, 'una medición es de la organización de su objetivo');

-- ===========================================================================
-- 2. Lectura por alcance
-- ===========================================================================
create function pg_temp.visible_goals() returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.goals;
$$;

select pg_temp.login(:a_admin);
select is(pg_temp.visible_goals(),
  array['Citas al mes', 'Citas en A3', 'Leads en el norte', 'Leads en el sur', 'Respuesta en A1'],
  'org_admin: todos los objetivos de su organización, ninguno de otra');
reset role;
select pg_temp.login(:a_region_mgr);
select is(pg_temp.visible_goals(), array['Citas al mes', 'Leads en el norte', 'Respuesta en A1'],
  'region_manager: los de la organización, su región y sus locales');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is(pg_temp.visible_goals(), array['Citas al mes', 'Leads en el norte', 'Respuesta en A1'],
  'location_manager: los de la organización, la región de su local y su local');
reset role;
select pg_temp.login(:a_staff2);
select is(pg_temp.visible_goals(), array['Citas al mes', 'Leads en el norte'],
  'staff de A2: no ve los objetivos de otro local');
select is((select count(*)::int from public.goal_progress), 0, 'staff de A2: ni su progreso');
reset role;
select pg_temp.login(:a_staff1);
select is((select array_agg(value::int) from public.goal_progress), array[140], 'staff de A1: ve el progreso de los objetivos que ve');
reset role;
select pg_temp.login(:b_admin);
select is(pg_temp.visible_goals(), array['Citas en B1'], 'org_admin de B: solo los de B');
select is((select array_agg(value::int) from public.goal_progress), array[12], 'org_admin de B: solo el progreso de B');
reset role;
select pg_temp.login(:outsider);
select is(pg_temp.visible_goals(), '{}'::text[], 'sin organización no se ve ningún objetivo');
reset role;
select pg_temp.login(:p_operator);
select is(pg_temp.visible_goals(), '{}'::text[], 'equipo interno sin permiso de soporte: nada');
reset role;
select pg_temp.staff_login(:p_operator);
select is(array_length(pg_temp.visible_goals(), 1), 6, 'equipo interno con permiso de soporte: lee los de las organizaciones con permiso');
reset role;

-- ===========================================================================
-- 3. location_manager: solo los de su local
-- ===========================================================================
select pg_temp.login(:a_loc1_mgr);
select lives_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'location', %L, 'Reseñas en A1', 'reviews.count', 20, 'month')$$, :org_a, :loc_a1),
  'location_manager: crea un objetivo de su local');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'location', %L, 'x', 'reviews.count', 1, 'month')$$, :org_a, :loc_a2),
  '42501', null, 'location_manager: no en otro local');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'region', %L, 'x', 'reviews.count', 1, 'month')$$, :org_a, :region_a_n),
  '42501', null, 'location_manager: no en su región');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'organization', %L, 'x', 'reviews.count', 1, 'month')$$, :org_a, :org_a),
  '42501', null, 'location_manager: no en la organización');
with u as (update public.goals set target_value = 100 where id = :g_loc_a1 returning 1)
select is(count(*)::int, 1, 'location_manager: cambia un objetivo de su local') from u;
with u as (update public.goals set target_value = 1 where id = :g_reg_an returning 1)
select is(count(*)::int, 0, 'location_manager: no cambia el de su región') from u;
select throws_ok(
  format($$update public.goals set scope_id = %L where id = %L$$, :loc_a2, :g_loc_a1),
  '42501', null, 'guarda: un objetivo no cambia de alcance desde la app');
reset role;

-- ===========================================================================
-- 4. region_manager: su región y sus locales
-- ===========================================================================
select pg_temp.login(:a_region_mgr);
select lives_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'region', %L, 'Ventas norte', 'sales.amount', 1000, 'quarter')$$, :org_a, :region_a_n),
  'region_manager: crea un objetivo de su región');
select lives_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'location', %L, 'Citas A2', 'appointments.booked', 30, 'month')$$, :org_a, :loc_a2),
  'region_manager: y de un local de su región');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'region', %L, 'x', 'sales.amount', 1, 'month')$$, :org_a, :region_a_s),
  '42501', null, 'region_manager: no en otra región');
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'location', %L, 'x', 'sales.amount', 1, 'month')$$, :org_a, :loc_a3),
  '42501', null, 'region_manager: ni en un local de otra región');
with d as (delete from public.goals where id = :g_reg_as returning 1)
select is(count(*)::int, 0, 'region_manager: no borra el de otra región') from d;
reset role;

-- ===========================================================================
-- 5. staff: solo lee
-- ===========================================================================
select pg_temp.login(:a_staff1);
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'location', %L, 'x', 'reviews.count', 1, 'month')$$, :org_a, :loc_a1),
  '42501', null, 'staff: no crea objetivos ni en su local');
with u as (update public.goals set target_value = 1 where id = :g_loc_a1 returning 1)
select is(count(*)::int, 0, 'staff: no cambia objetivos') from u;
reset role;

-- ===========================================================================
-- 6. org_admin: todo, pero con aal2
-- ===========================================================================
select pg_temp.login(:a_admin);
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'organization', %L, 'x', 'sales.amount', 1, 'month')$$, :org_a, :org_a),
  '42501', null, 'org_admin aal1: no crea objetivos');
with u as (update public.goals set target_value = 1 where id = :g_org_a returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no los cambia') from u;
reset role;
select pg_temp.login_mfa(:a_admin);
select lives_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period, due_date)
           values (%L, 'organization', %L, 'Abrir la tercera sede', 'locations.opened', 1, 'once', current_date + 90)$$, :org_a, :org_a),
  'org_admin aal2: crea un objetivo de la organización');
with u as (update public.goals set status = 'paused' where id = :g_reg_as returning 1)
select is(count(*)::int, 1, 'org_admin aal2: cambia uno de cualquier región') from u;
with d as (delete from public.goals where id = :g_loc_a3 returning 1)
select is(count(*)::int, 1, 'org_admin aal2: borra uno de cualquier local') from d;
select throws_ok(
  format($$update public.goals set organization_id = %L where id = %L$$, :org_b, :g_org_a),
  '42501', null, 'guarda: un objetivo no cambia de organización');
select throws_ok(
  format($$insert into public.goal_progress (goal_id, organization_id, value, source) values (%L, %L, 1, 'manual')$$, :g_org_a, :org_a),
  '42501', null, 'el progreso no se escribe desde la app');
reset role;
select pg_temp.login_mfa(:b_admin);
with u as (update public.goals set target_value = 1 where id = :g_org_a returning 1)
select is(count(*)::int, 0, 'org_admin de B: no cambia objetivos de A') from u;
select throws_ok(
  format($$insert into public.goals (organization_id, scope, scope_id, title, metric_key, target_value, period)
           values (%L, 'organization', %L, 'x', 'sales.amount', 1, 'month')$$, :org_a, :org_a),
  '42501', null, 'org_admin de B: no crea objetivos en A');
reset role;

-- ===========================================================================
-- 7. Privilegios y estructura
-- ===========================================================================
select ok(not has_table_privilege('anon', 'public.goals', 'select'), 'anon no lee objetivos');
select ok(not has_table_privilege('authenticated', 'public.goal_progress', 'insert')
          and not has_table_privilege('authenticated', 'public.goal_progress', 'update')
          and not has_table_privilege('authenticated', 'public.goal_progress', 'delete'),
  'authenticated solo lee goal_progress');
select is(
  (select count(*)::int from public.goals where organization_id = :org_a),
  8, 'como plataforma: los objetivos de A tras los cambios (5, más 4 creados y 1 borrado)');
select is(
  (select target_value::int from public.goals where id = :g_loc_a1),
  100, 'el cambio del location_manager en su local se guardó');

select * from finish();
rollback;
