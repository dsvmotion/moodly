-- Acceso del equipo interno con permiso temporal + MFA (migración
-- 20261006180000_support_grants, auditoría backend 2026-10-21, P0-3).
begin;
\ir _fixtures/tenants.psql
select plan(26);

create function pg_temp.try_sql(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

-- Lo que ve el interno de las organizaciones A y B.
create function pg_temp.fixture_view() returns int[] language sql as $$
  select array[
    (select count(*)::int from public.organizations where id in ('a0000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000000')),
    (select count(*)::int from public.locations   where organization_id = 'a0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.locations   where organization_id = 'b0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.memberships where organization_id = 'a0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.memberships where organization_id = 'b0000000-0000-4000-8000-000000000000')
  ];
$$;

-- Sesión de un interno con MFA (aal2) y sin ningún permiso.
create function pg_temp.staff_session(p_user uuid, p_aal text) returns uuid language plpgsql as $$
declare
  v_session uuid := gen_random_uuid();
begin
  execute 'reset role';
  insert into auth.sessions (id, user_id, created_at, updated_at, aal) values (v_session, p_user, now(), now(), p_aal::auth.aal_level);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', v_session, 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
  return v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Sin permiso no se ve nada, aunque haya MFA
-- ---------------------------------------------------------------------------
select pg_temp.staff_session(:p_operator, 'aal2');
select is(pg_temp.fixture_view(), array[0, 0, 0, 0, 0], 'operator con MFA y sin permiso: no ve ningún cliente');
select ok(not private.staff_can_read(:org_a), 'staff_can_read(A) = false sin permiso');

-- ---------------------------------------------------------------------------
-- 2. Conceder: solo platform_admin con MFA
-- ---------------------------------------------------------------------------
select is(
  pg_temp.try_sql(format($q$insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, expires_at)
    values (%L, %L, 'Incidencia 123 del cliente A', %L, now() + interval '1 hour')$q$, :p_operator, :org_a, :p_operator)),
  '42501', 'el operator no puede concederse un permiso');

select pg_temp.staff_session(:p_admin, 'aal1');
select is(
  pg_temp.try_sql(format($q$insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, expires_at)
    values (%L, %L, 'Incidencia 123 del cliente A', %L, now() + interval '1 hour')$q$, :p_operator, :org_a, :p_admin)),
  '42501', 'el platform_admin sin MFA no puede conceder');

select pg_temp.staff_session(:p_admin, 'aal2') as admin_session \gset
select is(
  pg_temp.try_sql(format($q$insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, expires_at)
    values (%L, %L, 'corto', %L, now() + interval '1 hour')$q$, :p_operator, :org_a, :p_admin)),
  '23514', 'el motivo es obligatorio (al menos 10 caracteres)');
select is(
  pg_temp.try_sql(format($q$insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, expires_at)
    values (%L, %L, 'Incidencia 123 del cliente A', %L, now() + interval '9 hours')$q$, :p_operator, :org_a, :p_admin)),
  '23514', 'un permiso dura 8 h como máximo');
select is(
  pg_temp.try_sql(format($q$insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, expires_at)
    values (%L, %L, 'Incidencia 123 del cliente A', %L, now() + interval '1 hour')$q$, :p_revoked, :org_a, :p_admin)),
  '42501', 'no se concede a un interno revocado');
select is(
  pg_temp.try_sql(format($q$insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, expires_at)
    values (%L, %L, 'Incidencia 123 del cliente A', %L, now() + interval '1 hour')$q$, :p_operator, :org_a, :b_admin)),
  'ok', 'el platform_admin con MFA concede un permiso para A');

reset role;
select is(
  (select granted_by from public.support_grants where staff_user_id = :p_operator and organization_id = :org_a),
  :p_admin::uuid, 'granted_by lo fija la base de datos (el que concede), no lo que se envía');
select is(
  (select count(*)::int from public.audit_logs
    where action = 'support_grant.created' and actor_type = 'platform_staff' and actor_id = :p_admin and organization_id = :org_a),
  1, 'conceder deja una fila de auditoría en la misma transacción');
select ok(
  (select metadata ->> 'reason' = 'Incidencia 123 del cliente A' from public.audit_logs where action = 'support_grant.created'),
  'la auditoría guarda el motivo');

-- ---------------------------------------------------------------------------
-- 3. Con permiso para A: ve A, no B; sin MFA no ve nada
-- ---------------------------------------------------------------------------
select pg_temp.staff_session(:p_operator, 'aal2') as op_session \gset
select is(pg_temp.fixture_view(), array[1, 3, 0, 5, 0], 'operator con permiso para A: ve A y nada de B');
select is(
  pg_temp.try_sql(format('update public.locations set name = %L where organization_id = %L', 'x', :org_a)),
  'ok', 'el permiso es de solo lectura: el UPDATE no falla pero no toca nada');
reset role;
select is((select count(*)::int from public.locations where name = 'x'), 0, 'ningún local cambiado por el interno');

select pg_temp.staff_session(:p_operator, 'aal1');
select is(pg_temp.fixture_view(), array[0, 0, 0, 0, 0], 'el mismo operator sin MFA en la sesión: no ve nada');

-- ---------------------------------------------------------------------------
-- 4. Ver permisos
-- ---------------------------------------------------------------------------
select pg_temp.staff_session(:p_operator, 'aal2');
select is((select count(*)::int from public.support_grants), 1, 'el operator ve su propio permiso');
select pg_temp.staff_session(:a_admin, 'aal2');
select is((select count(*)::int from public.support_grants), 0, 'un usuario de cliente no ve permisos de soporte');
select is((select count(*)::int from public.audit_logs where actor_type = 'platform_staff'), 1,
  'el org_admin de A sí ve en su auditoría que se concedió acceso a su organización');

-- ---------------------------------------------------------------------------
-- 5. Revocar: solo revoked_at, una vez, y queda auditado
-- ---------------------------------------------------------------------------
select pg_temp.staff_session(:p_admin, 'aal2');
select is(
  pg_temp.try_sql(format('update public.support_grants set expires_at = now() + interval %L where staff_user_id = %L', '7 hours', :p_operator)),
  '42501', 'no se puede alargar un permiso (solo revocar)');
select is(
  pg_temp.try_sql(format('update public.support_grants set revoked_at = now() where staff_user_id = %L', :p_operator)),
  'ok', 'el platform_admin revoca el permiso');
select is(
  pg_temp.try_sql(format('update public.support_grants set revoked_at = now() + interval %L where staff_user_id = %L', '1 day', :p_operator)),
  '42501', 'un permiso revocado no se vuelve a tocar');
select is(
  pg_temp.try_sql(format('delete from public.support_grants where staff_user_id = %L', :p_operator)),
  '42501', 'los permisos no se borran (quedan como historial)');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'support_grant.revoked'), 1, 'revocar deja una fila de auditoría');

select pg_temp.staff_session(:p_operator, 'aal2');
select is(pg_temp.fixture_view(), array[0, 0, 0, 0, 0], 'con el permiso revocado: no ve nada');

-- ---------------------------------------------------------------------------
-- 6. Caducado
-- ---------------------------------------------------------------------------
reset role;
insert into public.support_grants (staff_user_id, organization_id, reason, granted_by, created_at, expires_at)
values (:p_operator, :org_b, 'Permiso antiguo ya caducado', :p_admin, now() - interval '3 hours', now() - interval '1 hour');
select pg_temp.staff_session(:p_operator, 'aal2');
select is(pg_temp.fixture_view(), array[0, 0, 0, 0, 0], 'con el permiso caducado: no ve nada');

-- ---------------------------------------------------------------------------
-- 7. La auditoría completa exige MFA
-- ---------------------------------------------------------------------------
select pg_temp.staff_session(:p_admin, 'aal1');
select is((select count(*)::int from public.audit_logs), 0, 'el platform_admin sin MFA no lee la auditoría');

select * from finish();
rollback;
