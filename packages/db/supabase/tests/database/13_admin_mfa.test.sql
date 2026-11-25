-- MFA obligatorio para administrar (20261022120000_admin_mfa.sql): un org_admin
-- con sesión aal1 (solo contraseña) lee como siempre pero no cambia nada; con
-- aal2 (segundo factor verificado) sí. Los managers no lo necesitan para sus
-- locales. El equipo interno solo escribe en audit_logs con aal2.
begin;
\ir _fixtures/tenants.psql
select plan(26);

-- ===========================================================================
-- 1. Estructura: toda política de escritura que admite a un org_admin exige aal2
-- ===========================================================================
select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public'
     and cmd in ('INSERT', 'UPDATE', 'DELETE')
     and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%org_admin%'
     and not (coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%session_is_aal2()%')),
  null,
  'toda política de escritura que admite a un org_admin exige session_is_aal2()'
);
select is(
  (select array_agg(policyname::text order by policyname)
   from pg_policies
   where schemaname = 'public'
     and cmd in ('INSERT', 'UPDATE', 'DELETE')
     and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%is_platform_staff()%'
     and not (coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%session_is_aal2()%')),
  null,
  'toda política de escritura del equipo interno exige session_is_aal2()'
);

-- ===========================================================================
-- 2. org_admin con aal1: lee, pero no cambia nada
-- ===========================================================================
select pg_temp.login(:a_admin) as a_admin_aal1 \gset

select is((select count(*)::int from public.organizations), 1, 'org_admin aal1: sigue viendo su organización');
select is((select count(*)::int from public.locations), 3, 'org_admin aal1: sigue viendo sus locales');

with u as (update public.organizations set name = 'sin mfa' where id = :org_a returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no cambia la organización') from u;
select throws_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_a, 'sin mfa'),
  '42501', null, 'org_admin aal1: no crea regiones');
with u as (update public.regions set name = 'sin mfa' where id = :region_a_n returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no cambia regiones') from u;
select throws_ok(
  format('insert into public.locations (organization_id, name) values (%L, %L)', :org_a, 'sin mfa'),
  '42501', null, 'org_admin aal1: no crea locales');
with u as (update public.locations set name = 'sin mfa' where id = :loc_a1 returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no cambia locales') from u;
with u as (update public.memberships set scope_location_ids = array[:loc_a2]::uuid[] where user_id = :a_staff1 returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no cambia memberships') from u;
with d as (delete from public.memberships where user_id = :a_staff2 returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no da de baja a nadie') from d;
select throws_ok(
  format($$select public.create_invitation(%L, 'sin-mfa@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_a, :loc_a1),
  '42501', null, 'org_admin aal1: no invita');

-- Una invitación creada con MFA tampoco se puede revocar sin MFA.
reset role;
select pg_temp.login_mfa(:a_admin);
select public.create_invitation(:org_a, 'pendiente@test.local', 'staff', '{}', array[:loc_a1]::uuid[]) as tok \gset
reset role;
select pg_temp.act_as(:a_admin, :'a_admin_aal1');
select is((select count(*)::int from public.invitations where email = 'pendiente@test.local'), 1,
  'org_admin aal1: ve las invitaciones pendientes');
with u as (update public.invitations set revoked_at = now() where email = 'pendiente@test.local' returning 1)
select is(count(*)::int, 0, 'org_admin aal1: no revoca invitaciones') from u;

-- Un claim aal1 explícito tampoco vale.
select set_config('request.jwt.claims', json_build_object('sub', :a_admin, 'role', 'authenticated',
  'session_id', :'a_admin_aal1', 'aal', 'aal1')::text, true);
with u as (update public.organizations set name = 'sin mfa' where id = :org_a returning 1)
select is(count(*)::int, 0, 'org_admin con aal = aal1 explícito: no cambia la organización') from u;

-- ===========================================================================
-- 3. Con aal2 (misma persona, tras verificar el segundo factor): sí
-- ===========================================================================
reset role;
select pg_temp.login_mfa(:a_admin);
with u as (update public.organizations set name = 'con mfa' where id = :org_a returning 1)
select is(count(*)::int, 1, 'org_admin aal2: cambia la organización') from u;
select lives_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_a, 'con mfa'),
  'org_admin aal2: crea regiones');
with u as (update public.locations set name = 'con mfa' where id = :loc_a1 returning 1)
select is(count(*)::int, 1, 'org_admin aal2: cambia locales') from u;
with u as (update public.memberships set scope_location_ids = array[:loc_a2]::uuid[] where user_id = :a_staff1 returning 1)
select is(count(*)::int, 1, 'org_admin aal2: cambia memberships') from u;
with u as (update public.invitations set revoked_at = now() where email = 'pendiente@test.local' returning 1)
select is(count(*)::int, 1, 'org_admin aal2: revoca invitaciones') from u;

-- aal2 no salta el aislamiento: sigue sin poder tocar B.
with u as (update public.organizations set name = 'con mfa' where id = :org_b returning 1)
select is(count(*)::int, 0, 'org_admin A aal2: sigue sin poder cambiar la organización B') from u;

-- ===========================================================================
-- 4. Managers: sus locales, como antes (sin MFA)
-- ===========================================================================
reset role;
select pg_temp.login(:a_loc1_mgr);
with u as (update public.locations set opening_hours = '{"mon": ["09:00", "14:00"]}' where id = :loc_a1 returning 1)
select is(count(*)::int, 1, 'location_manager aal1: sigue cambiando su local') from u;
with u as (update public.locations set opening_hours = '{"mon": ["09:00", "14:00"]}' where id = :loc_a2 returning 1)
select is(count(*)::int, 0, 'location_manager aal1: no cambia un local ajeno') from u;
reset role;
select pg_temp.login(:a_region_mgr);
with u as (update public.locations set opening_hours = '{"tue": ["09:00", "14:00"]}' where region_id = :region_a_n returning 1)
select ok((select count(*)::int from u) > 0, 'region_manager aal1: sigue cambiando los locales de su región');

-- ===========================================================================
-- 5. Equipo interno: escribir en audit_logs exige aal2
-- ===========================================================================
reset role;
select pg_temp.login(:p_admin);
select throws_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('platform_staff', %L, 'prueba.sin_mfa')$$, :p_admin),
  '42501', null, 'equipo interno aal1: no escribe en audit_logs');
reset role;
select pg_temp.staff_login(:p_admin);
select lives_ok(
  format($$insert into public.audit_logs (actor_type, actor_id, action) values ('platform_staff', %L, 'prueba.con_mfa')$$, :p_admin),
  'equipo interno aal2: escribe en audit_logs');

select * from finish();
rollback;
