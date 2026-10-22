-- Invitaciones con consentimiento (20261022090000_invitations.sql).
begin;
\ir _fixtures/tenants.psql
select plan(31);

-- Como pg_temp.login, pero con el email en el JWT (lo usa accept_invitation).
create function pg_temp.login_email(p_user uuid) returns void language plpgsql as $$
declare
  v_session uuid := gen_random_uuid();
begin
  insert into auth.sessions (id, user_id, created_at, updated_at, aal) values (v_session, p_user, now(), now(), 'aal1');
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'session_id', v_session,
    'email', (select email from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ===========================================================================
-- 1. Alta directa eliminada: ni el org_admin crea memberships
-- ===========================================================================
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$insert into public.memberships (user_id, organization_id, role, scope_location_ids)
           values (%L, %L, 'staff', array[%L]::uuid[])$$, :outsider, :org_a, :loc_a3),
  '42501', null,
  'org_admin A: ya no puede dar de alta directamente (solo por invitación)'
);

-- ===========================================================================
-- 2. Crear invitaciones: solo el org_admin de esa organización
-- ===========================================================================
select ok(length(public.create_invitation(:org_a, 'Outsider@Test.Local ', 'staff', '{}', array[:loc_a3]::uuid[])) >= 40,
  'org_admin A: crea una invitación y recibe un token largo');
select is((select email from public.invitations where organization_id = :org_a order by created_at desc limit 1),
  'outsider@test.local', 'el email se guarda normalizado');
select is((select count(*)::int from public.invitations where token_hash like '%-%' or length(token_hash) <> 64), 0,
  'del token solo se guarda el hash SHA-256');
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_b, :loc_b1),
  '42501', null, 'org_admin A: no puede invitar a la organización B');
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_a, :loc_b1),
  '23503', null, 'org_admin A: no puede invitar con un local de B en el alcance');
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', '{}')$$, :org_a),
  '23514', null, 'rol y alcance deben ser coherentes (staff sin local → rechazado)');
select throws_ok(
  format($$select public.create_invitation(%L, 'no-es-un-email', 'staff', '{}', array[%L]::uuid[])$$, :org_a, :loc_a1),
  '23514', null, 'un email sin @ se rechaza');

reset role;
select pg_temp.login(:a_staff1);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_a, :loc_a1),
  '42501', null, 'staff: no puede invitar');
select is_empty('select 1 from public.invitations', 'staff: no ve las invitaciones');
reset role;
select pg_temp.login(:a_region_mgr);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_a, :loc_a1),
  '42501', null, 'region_manager: no puede invitar');
reset role;
select pg_temp.login_mfa(:b_admin);
select is_empty('select 1 from public.invitations', 'org_admin B: no ve las invitaciones de A');

-- ===========================================================================
-- 3. Aceptar: solo la persona invitada, una vez, con la invitación vigente
-- ===========================================================================
reset role;
select pg_temp.login_mfa(:a_admin);
select public.create_invitation(:org_a, 'outsider@test.local', 'location_manager', '{}', array[:loc_a3]::uuid[]) as tok \gset
select public.create_invitation(:org_a, 'outsider@test.local', 'staff', '{}', array[:loc_a1]::uuid[]) as tok_revoked \gset
select public.create_invitation(:org_a, 'outsider@test.local', 'staff', '{}', array[:loc_a2]::uuid[]) as tok_expired \gset

reset role;
select pg_temp.login_email(:b_admin);
select throws_ok(format('select public.accept_invitation(%L)', :'tok'), 'P0002', null,
  'otra persona (otro email) no puede aceptarla');
reset role;
select pg_temp.login_email(:outsider);
select throws_ok('select public.accept_invitation(''token-inventado'')', 'P0002', null,
  'un token inventado da el mismo error');
select is(public.accept_invitation(:'tok'), :org_a::uuid, 'la persona invitada la acepta y entra en A');

reset role;
select is((select role || ':' || array_to_string(scope_location_ids, ',') from public.memberships where user_id = :outsider and organization_id = :org_a),
  'location_manager:' || :loc_a3, 'la membership tiene el rol y el alcance de la invitación');
select isnt((select accepted_at from public.invitations where token_hash = encode(extensions.digest(:'tok', 'sha256'), 'hex')), null,
  'la invitación queda marcada como aceptada');

select pg_temp.login_email(:outsider);
select throws_ok(format('select public.accept_invitation(%L)', :'tok'), 'P0002', null, 'no se puede usar dos veces');

reset role;
select pg_temp.login_mfa(:a_admin);
with u as (update public.invitations set revoked_at = now()
           where token_hash = encode(extensions.digest(:'tok_revoked', 'sha256'), 'hex') returning 1)
select is(count(*)::int, 1, 'org_admin A: puede revocar una invitación') from u;
select throws_ok(
  format($$update public.invitations set role = 'org_admin', scope_location_ids = '{}' where token_hash = %L$$,
         encode(extensions.digest(:'tok_expired', 'sha256'), 'hex')),
  '42501', null, 'org_admin A: no puede cambiar el rol de una invitación (solo revocarla)');
select throws_ok(
  format($$update public.invitations set email = 'otro@test.local', revoked_at = now() where token_hash = %L$$,
         encode(extensions.digest(:'tok_expired', 'sha256'), 'hex')),
  '42501', null, 'org_admin A: no puede cambiar el email al revocar');
select throws_ok(
  format($$delete from public.invitations where token_hash = %L$$, encode(extensions.digest(:'tok_expired', 'sha256'), 'hex')),
  '42501', null, 'nadie borra invitaciones (quedan como rastro)');

reset role;
update public.invitations set expires_at = now() - interval '1 minute'
 where token_hash = encode(extensions.digest(:'tok_expired', 'sha256'), 'hex');
-- La persona ya está en A por la primera invitación: para probar revocada y
-- caducada sin que salte antes «ya perteneces», se la saca de A.
delete from public.memberships where user_id = :outsider and organization_id = :org_a;

select pg_temp.login_email(:outsider);
select throws_ok(format('select public.accept_invitation(%L)', :'tok_revoked'), 'P0002', null, 'una invitación revocada no sirve');
select throws_ok(format('select public.accept_invitation(%L)', :'tok_expired'), 'P0002', null, 'una invitación caducada no sirve');
reset role;
select is((select count(*)::int from public.memberships where user_id = :outsider), 0,
  'tras los intentos fallidos, sigue sin membership');

-- Ya miembro: una segunda invitación vigente a la misma organización no duplica.
select pg_temp.login_mfa(:a_admin);
select public.create_invitation(:org_a, 'a_staff1@test.local', 'staff', '{}', array[:loc_a2]::uuid[]) as tok_member \gset
reset role;
select pg_temp.login_email(:a_staff1);
select throws_ok(format('select public.accept_invitation(%L)', :'tok_member'), '23505', null,
  'quien ya pertenece a la organización no puede aceptar otra invitación a ella');

-- Organización suspendida: ni se crean ni se aceptan invitaciones
-- (accept_invitation es SECURITY DEFINER: RLS no lo frena, lo comprueba ella).
reset role;
select pg_temp.login_mfa(:a_admin);
select public.create_invitation(:org_a, 'outsider@test.local', 'staff', '{}', array[:loc_a3]::uuid[]) as tok_suspended \gset
reset role;
update public.organizations set status = 'suspended' where id = :org_a;
select pg_temp.login_email(:outsider);
select throws_ok(format('select public.accept_invitation(%L)', :'tok_suspended'), 'P0002', null,
  'organización suspendida: una invitación vigente no sirve (mismo error)');
reset role;
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$select public.create_invitation(%L, 'y@test.local', 'staff', '{}', array[%L]::uuid[])$$, :org_a, :loc_a1),
  '42501', null, 'organización suspendida: el org_admin no puede invitar');
reset role;
update public.organizations set status = 'active' where id = :org_a;

-- ===========================================================================
-- 4. Sin sesión
-- ===========================================================================
reset role;
select ok(not has_function_privilege('anon', 'public.accept_invitation(text)', 'execute'), 'anon no puede aceptar invitaciones');
select ok(not has_function_privilege('anon', 'public.create_invitation(uuid, text, text, uuid[], uuid[])', 'execute'), 'anon no puede crear invitaciones');
select pg_temp.login_email(:outsider);
select set_config('request.jwt.claims', json_build_object('sub', :outsider, 'role', 'authenticated',
  'session_id', gen_random_uuid(), 'email', 'outsider@test.local')::text, true);
select throws_ok(format('select public.accept_invitation(%L)', :'tok_expired'), '42501', null,
  'con una sesión cerrada (session_id que no existe) no se acepta nada');

select * from finish();
rollback;
