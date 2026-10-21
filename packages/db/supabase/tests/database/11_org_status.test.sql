-- Organizaciones suspendidas o archivadas (auditoría backend 2026-10-21, P0-2):
-- sus miembros no leen ni escriben datos de la organización. Solo conservan su
-- propio perfil y su propia membership, para que la app pueda avisar.
begin;
\ir _fixtures/tenants.psql
select plan(20);

-- Cuenta lo que ve el usuario actual en las 5 tablas de tenants.
create function pg_temp.visible_counts() returns int[] language sql as $$
  select array[
    (select count(*)::int from public.organizations),
    (select count(*)::int from public.regions),
    (select count(*)::int from public.locations),
    (select count(*)::int from public.users),
    (select count(*)::int from public.memberships)
  ];
$$;

-- ---------------------------------------------------------------------------
-- Línea base: con A activa, a_admin ve su organización
-- ---------------------------------------------------------------------------
select pg_temp.login(:a_admin) as a_admin_session \gset
select is(pg_temp.visible_counts(), array[1, 2, 3, 5, 5], 'A activa: org_admin ve 1 org, 2 regiones, 3 locales, 5 perfiles, 5 memberships');

-- ---------------------------------------------------------------------------
-- La plataforma suspende A
-- ---------------------------------------------------------------------------
reset role;
update public.organizations set status = 'suspended' where id = :org_a;

select pg_temp.act_as(:a_admin, :'a_admin_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 1, 1], 'A suspendida: org_admin solo ve su perfil y su membership');
select ok(not private.has_org_role(:org_a), 'A suspendida: has_org_role = false');
select ok(not private.can_access_location(:org_a, :loc_a1), 'A suspendida: can_access_location = false');
select ok(not private.can_access_region(:org_a, :region_a_n), 'A suspendida: can_access_region = false');

-- Escrituras: ninguna prospera
with u as (update public.organizations set name = 'suspendida' where id = :org_a returning 1)
select is(count(*)::int, 0, 'A suspendida: el org_admin no cambia la organización') from u;
with u as (update public.locations set opening_hours = '{"x": 1}' where organization_id = :org_a returning 1)
select is(count(*)::int, 0, 'A suspendida: el org_admin no cambia locales') from u;
with u as (update public.memberships set role = 'staff', scope_location_ids = array[:loc_a1]::uuid[] where user_id = :a_region_mgr returning 1)
select is(count(*)::int, 0, 'A suspendida: el org_admin no cambia memberships ajenas') from u;
with d as (delete from public.memberships where user_id = :a_staff1 returning 1)
select is(count(*)::int, 0, 'A suspendida: el org_admin no borra memberships') from d;
select throws_ok(
  format('insert into public.regions (organization_id, name) values (%L, %L)', :org_a, 'suspendida'),
  '42501', null,
  'A suspendida: el org_admin no crea regiones'
);
select throws_ok(
  format('insert into public.locations (organization_id, name) values (%L, %L)', :org_a, 'suspendida'),
  '42501', null,
  'A suspendida: el org_admin no crea locales'
);

-- Otros roles de A
reset role;
select pg_temp.login(:a_loc1_mgr) as a_loc1_session \gset
select is(pg_temp.visible_counts(), array[0, 0, 0, 1, 1], 'A suspendida: location_manager solo ve lo suyo');
with u as (update public.locations set opening_hours = '{"x": 1}' where id = :loc_a1 returning 1)
select is(count(*)::int, 0, 'A suspendida: location_manager no cambia su local') from u;

reset role;
select pg_temp.login(:a_staff1) as a_staff1_session \gset
select is(pg_temp.visible_counts(), array[0, 0, 0, 1, 1], 'A suspendida: staff solo ve lo suyo');

-- B no se ve afectada
reset role;
select pg_temp.login(:b_admin) as b_admin_session \gset
select is(pg_temp.visible_counts(), array[1, 1, 1, 2, 2], 'B activa: su org_admin sigue viendo su organización');
with u as (update public.locations set opening_hours = '{"ok": 1}' where id = :loc_b1 returning 1)
select is(count(*)::int, 1, 'B activa: su org_admin sigue pudiendo escribir') from u;

-- ---------------------------------------------------------------------------
-- Archivada: igual que suspendida
-- ---------------------------------------------------------------------------
reset role;
update public.organizations set status = 'archived' where id = :org_a;
select pg_temp.act_as(:a_admin, :'a_admin_session');
select is(pg_temp.visible_counts(), array[0, 0, 0, 1, 1], 'A archivada: org_admin solo ve su perfil y su membership');

-- El org_admin no puede reactivarla (status es de la plataforma)
reset role;
update public.organizations set status = 'suspended' where id = :org_a;
select pg_temp.act_as(:a_admin, :'a_admin_session');
with u as (update public.organizations set status = 'active' where id = :org_a returning 1)
select is(count(*)::int, 0, 'A suspendida: el org_admin no puede reactivarla') from u;

-- ---------------------------------------------------------------------------
-- La plataforma reactiva A: vuelve todo
-- ---------------------------------------------------------------------------
reset role;
update public.organizations set status = 'active' where id = :org_a;
select pg_temp.act_as(:a_admin, :'a_admin_session');
select is(pg_temp.visible_counts(), array[1, 2, 3, 5, 5], 'A reactivada: el org_admin vuelve a verlo todo');
with u as (update public.locations set opening_hours = '{"ok": 1}' where id = :loc_a1 returning 1)
select is(count(*)::int, 1, 'A reactivada: el org_admin vuelve a poder escribir') from u;

select * from finish();
rollback;
