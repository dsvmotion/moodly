-- MFA también para leer (20261023090000_mfa_reads.sql, auditoría 2026-10-23
-- R-16): quien tiene un segundo factor verificado no ve nada con una sesión aal1
-- (solo contraseña), ni lee ni escribe ni acepta invitaciones; con aal2, todo
-- como antes. Quien no tiene factor (o lo tiene a medias) no cambia.
begin;
\ir _fixtures/tenants.psql
select plan(23);

-- Un factor TOTP verificado para a_admin, outsider y a_staff1; a_staff2 solo uno
-- sin verificar (alta a medias).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values
  (gen_random_uuid(), :a_admin,  'totp a_admin',  'totp', 'verified',   now(), now()),
  (gen_random_uuid(), :outsider, 'totp outsider', 'totp', 'verified',   now(), now()),
  (gen_random_uuid(), :a_staff1, 'totp staff1',   'totp', 'verified',   now(), now()),
  (gen_random_uuid(), :a_staff2, 'totp staff2',   'totp', 'unverified', now(), now());

-- Actúa con una sesión de nivel p_aal y el email en el JWT (accept_invitation lo lee).
create function pg_temp.login_as(p_user uuid, p_aal text, p_email text) returns uuid language plpgsql as $$
declare
  v_session uuid := gen_random_uuid();
begin
  insert into auth.sessions (id, user_id, created_at, updated_at, aal)
  values (v_session, p_user, now(), now(), p_aal::auth.aal_level);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', v_session,
                      'aal', p_aal, 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
  return v_session;
end;
$$;

-- ===========================================================================
-- 1. Estructura: session_is_active() mira el segundo factor
-- ===========================================================================
select ok(
  pg_get_functiondef('private.session_is_active()'::regprocedure) like '%mfa_factors%',
  'session_is_active() comprueba el segundo factor (auth.mfa_factors)'
);

-- ===========================================================================
-- 2. org_admin con factor verificado y sesión aal1: no ve nada
-- ===========================================================================
select pg_temp.login(:a_admin);
select is((select private.session_is_active()), false, 'con factor y aal1: la sesión no cuenta para los datos');
select is((select count(*)::int from public.organizations), 0, 'con factor y aal1: no ve su organización');
select is((select count(*)::int from public.regions), 0, 'con factor y aal1: no ve regiones');
select is((select count(*)::int from public.locations), 0, 'con factor y aal1: no ve locales');
select is((select count(*)::int from public.memberships), 0, 'con factor y aal1: no ve memberships');
select is((select count(*)::int from public.users), 0, 'con factor y aal1: no ve perfiles (tampoco el suyo)');
select is((select count(*)::int from public.invitations), 0, 'con factor y aal1: no ve invitaciones');
select is((select count(*)::int from public.audit_logs), 0, 'con factor y aal1: no ve la auditoría');
with u as (update public.locations set address = 'sin mfa' where id = :loc_a1 returning 1)
select is(count(*)::int, 0, 'con factor y aal1: no cambia nada') from u;

-- ===========================================================================
-- 3. El mismo org_admin con aal2: todo como antes
-- ===========================================================================
reset role;
select pg_temp.login_mfa(:a_admin);
select is((select private.session_is_active()), true, 'con factor y aal2: la sesión cuenta');
select is((select count(*)::int from public.organizations), 1, 'con factor y aal2: ve su organización');
select is((select count(*)::int from public.locations), 3, 'con factor y aal2: ve sus locales');
select ok((select count(*)::int from public.memberships) > 0, 'con factor y aal2: ve las memberships de su organización');
-- Para el paso 5: una invitación para outsider (que tiene MFA) a A1.
select public.create_invitation(:org_a, 'outsider@test.local', 'staff', '{}', array[:loc_a1]::uuid[]) as invite_token \gset

-- ===========================================================================
-- 4. Otros roles: con factor, depende del aal; sin factor o a medias, igual que antes
-- ===========================================================================
reset role;
select pg_temp.login(:a_staff1);
select is((select count(*)::int from public.locations), 0, 'staff con factor y aal1: no ve su local');
reset role;
select pg_temp.login_mfa(:a_staff1);
select is((select count(*)::int from public.locations), 1, 'staff con factor y aal2: ve su local');
reset role;
select pg_temp.login(:a_staff2);
select is((select count(*)::int from public.locations), 1, 'factor sin verificar: no cuenta, aal1 sigue viendo su local');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is((select count(*)::int from public.locations), 1, 'sin factor: aal1 sigue viendo su local');

-- ===========================================================================
-- 5. accept_invitation (SECURITY DEFINER) también exige aal2 a quien tiene factor
-- ===========================================================================
reset role;
select pg_temp.login_as(:outsider, 'aal1', 'outsider@test.local');
select throws_ok(
  format('select public.accept_invitation(%L)', :'invite_token'),
  '42501', null, 'con factor y aal1: no acepta invitaciones');
reset role;
select pg_temp.login_as(:outsider, 'aal2', 'outsider@test.local');
select is(
  (select public.accept_invitation(:'invite_token')),
  :org_a::uuid,
  'con factor y aal2: acepta la invitación');
select is((select count(*)::int from public.locations), 1, 'con factor y aal2: tras aceptar, ve el local de su alcance');

-- ===========================================================================
-- 6. Quitar el factor (desactivar el MFA) devuelve el acceso con aal1
-- ===========================================================================
reset role;
delete from auth.mfa_factors where user_id = :a_admin;
select pg_temp.login(:a_admin);
select is((select private.session_is_active()), true, 'sin factor ya: aal1 vuelve a contar');
select is((select count(*)::int from public.organizations), 1, 'sin factor ya: aal1 vuelve a ver su organización');

reset role;
select * from finish();
rollback;
