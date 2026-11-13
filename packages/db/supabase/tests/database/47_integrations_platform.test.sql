-- Integraciones de plataforma (20261112210000, O-02, ADR 0053): kind
-- 'platform' con el id de la conexión en Nango; el org_admin con MFA empieza a
-- conectar, reconecta y desconecta, y nada más (guard_integration_write); el
-- worker pone activa la conexión, solo en su organización; y una organización
-- no ve ni toca las conexiones de otra.
begin;
\ir _fixtures/tenants.psql
select plan(46);

create function pg_temp.status_of(p_id uuid) returns text language sql as $$
  select status from public.integrations where id = p_id;
$$;

-- ===========================================================================
-- 1. Forma de una integración de plataforma (como la plataforma)
-- ===========================================================================
select lives_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'probe-platform', 'platform')$$, :org_b),
  'kind admite platform');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, server_version) values (%L, 'p2', 'platform', '1.0')$$, :org_b),
  '23514', null, 'una de plataforma no tiene versión de servidor');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, status) values (%L, 'p3', 'platform', 'active')$$, :org_b),
  '23514', null, 'activa sin id de conexión, no');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, external_connection_id) values (%L, 'n1', 'native', 'conn-x')$$, :org_b),
  '23514', null, 'solo las de plataforma tienen id externo');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, external_connection_id) values (%L, 'p4', 'platform', 'conn con espacio')$$, :org_b),
  '23514', null, 'el id externo tiene un formato acotado');
insert into public.integrations (organization_id, provider, kind, status, external_connection_id)
values (:org_b, 'google-calendar', 'platform', 'active', 'conn-b') returning id as int_b \gset
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, external_connection_id) values (%L, 'otro', 'platform', 'conn-b')$$, :org_a),
  '23505', null, 'dos organizaciones nunca apuntan a la misma conexión');
delete from public.integrations where provider = 'probe-platform';

-- ===========================================================================
-- 2. El org_admin con MFA empieza a conectar
-- ===========================================================================
select pg_temp.login(:a_admin) as s_aal1 \gset
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'google-calendar', 'platform')$$, :org_a),
  '42501', null, 'sin el segundo factor (aal1), el org_admin no conecta nada');
reset role;
select pg_temp.login_mfa(:a_staff1) as s_staff \gset
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'google-calendar', 'platform')$$, :org_a),
  '42501', null, 'una persona del equipo que no es org_admin, tampoco');
reset role;
select pg_temp.login_mfa(:a_admin) as s_admin \gset
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'google-calendar', 'platform')$$, :org_b),
  '23514', null, 'ni en otra organización (la para validate_integration: quien la conecta no es de B; y RLS después)');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, status) values (%L, 'google-calendar', 'platform', 'active')$$, :org_a),
  '42501', null, 'no la crea activa');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, external_connection_id) values (%L, 'google-calendar', 'platform', 'conn-falsa')$$, :org_a),
  '42501', null, 'ni con un id de conexión');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'otra', 'native')$$, :org_a),
  '42501', null, 'ni una que no sea de plataforma');
select lives_ok(
  format($$insert into public.integrations (organization_id, provider, kind, connected_by) values (%L, 'google-calendar', 'platform', %L)$$, :org_a, :a_staff1),
  'el org_admin con MFA crea la conexión pendiente');
reset role;
select id as int_a from public.integrations where organization_id = :org_a and provider = 'google-calendar' \gset
select results_eq(
  format($$select status, connected_by, external_connection_id from public.integrations where id = %L$$, :'int_a'),
  format($$values ('pending'::text, %L::uuid, null::text)$$, :a_admin),
  'pendiente, sin id, y a nombre de quien la conectó (aunque pidiera otro)');

-- ===========================================================================
-- 3. Lo que no puede cambiar (lista blanca)
-- ===========================================================================
select pg_temp.act_as_mfa(:a_admin, :'s_admin');
select throws_ok(format($$update public.integrations set status = 'active' where id = %L$$, :'int_a'),
  '42501', null, 'no la pone activa');
select throws_ok(format($$update public.integrations set status = 'error' where id = %L$$, :'int_a'),
  '42501', null, 'ni en error');
select throws_ok(format($$update public.integrations set external_connection_id = 'conn-falsa' where id = %L$$, :'int_a'),
  '42501', null, 'ni le da un id de conexión');
select throws_ok(format($$update public.integrations set scopes = '{x}' where id = %L$$, :'int_a'),
  '42501', null, 'ni cambia los permisos');
select throws_ok(format($$update public.integrations set provider = 'gmail' where id = %L$$, :'int_a'),
  '42501', null, 'ni el proveedor');
select throws_ok(format($$update public.integrations set last_health_check = now() where id = %L$$, :'int_a'),
  '42501', null, 'ni la última comprobación de salud');
reset role;

-- ===========================================================================
-- 4. Aislamiento: B no ve ni toca la de A
-- ===========================================================================
select pg_temp.login_mfa(:b_admin) as s_b \gset
select is((select count(*)::int from public.integrations where id = :'int_a'), 0, 'el org_admin de B no ve la conexión de A');
select is((select array_agg(provider) from public.integrations), array['google-calendar'], 'solo ve la suya');
update public.integrations set status = 'disconnected' where id = :'int_a';
reset role;
select is(pg_temp.status_of(:'int_a'), 'pending', 'y no puede desconectar la de A (no la alcanza)');
select pg_temp.login_mfa(:a_staff1) as s_staff2 \gset
select is((select count(*)::int from public.integrations), 0, 'una persona del equipo que no es org_admin no ve las conexiones');
reset role;

-- ===========================================================================
-- 5. El worker la activa, solo en su organización
-- ===========================================================================
insert into public.integrations (organization_id, provider, kind) values (:org_a, 'otra-nativa', 'native') returning id as int_native \gset
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select is((select count(*)::int from public.integrations), 0, 'sin organización fijada, el worker no ve ninguna');
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select is((select array_agg(id order by id) from public.integrations where kind = 'platform'), array[:'int_a'::uuid], 'con A fijada ve solo la de plataforma de A');
update public.integrations set status = 'active', external_connection_id = 'conn-intrusa' where id = :'int_b';
select lives_ok(
  format($$update public.integrations set status = 'active', external_connection_id = 'conn-a', last_health_check = now() where id = %L$$, :'int_a'),
  'y la pone activa con su id de conexión');
select throws_ok(format($$update public.integrations set provider = 'gmail' where id = %L$$, :'int_a'),
  '42501', null, 'pero no cambia otras columnas');
select throws_ok(format($$update public.integrations set status = 'pending' where id = %L$$, :'int_a'),
  '42501', null, 'guard_worker_integration: el worker no la pasa a pendiente');
select throws_ok(format($$update public.integrations set status = 'disconnected', external_connection_id = null where id = %L$$, :'int_a'),
  '42501', null, 'ni a desconectada (eso lo decide una persona)');
select throws_ok(format($$update public.integrations set status = 'error', external_connection_id = 'conn-z' where id = %L$$, :'int_a'),
  '42501', null, 'ni cambia el id de la conexión sin activarla');
select throws_ok(format($$update public.integrations set status = 'error' where id = %L$$, :'int_native'),
  '42501', null, 'guard_worker_integration: el worker no toca una integración que no es de plataforma');
select throws_ok(format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'x', 'platform')$$, :org_a),
  '42501', null, 'ni crea integraciones');
select throws_ok(format($$delete from public.integrations where id = %L$$, :'int_a'),
  '42501', null, 'ni las borra');
reset role;
select results_eq(
  format($$select status, external_connection_id from public.integrations where id = %L$$, :'int_b'),
  $$values ('active'::text, 'conn-b'::text)$$,
  'con A fijada no alcanzó la de B');
select results_eq(
  format($$select status, external_connection_id from public.integrations where id = %L$$, :'int_a'),
  $$values ('active'::text, 'conn-a'::text)$$,
  'la de A quedó activa con su id');

-- ===========================================================================
-- 6. El org_admin desconecta y reconecta
-- ===========================================================================
select pg_temp.act_as_mfa(:a_admin, :'s_admin');
select is((select external_connection_id from public.integrations where id = :'int_a'), 'conn-a',
  'el org_admin lee el id de su conexión (para borrarla en Nango)');
select throws_ok(format($$update public.integrations set status = 'disconnected', external_connection_id = 'conn-otra' where id = %L$$, :'int_a'),
  '42501', null, 'al desconectar, el id solo puede pasar a null');
select throws_ok(format($$update public.integrations set status = 'disconnected', connected_by = %L where id = %L$$, :a_staff1, :'int_a'),
  '42501', null, 'ni cambia quién la conectó');
select lives_ok(format($$update public.integrations set status = 'disconnected', external_connection_id = null where id = %L$$, :'int_a'),
  'la desconecta');
reset role;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org2 \gset
select throws_ok(format($$update public.integrations set status = 'active', external_connection_id = 'conn-tarde' where id = %L$$, :'int_a'),
  '42501', null, 'guard_worker_integration: el worker no reactiva una que una persona desconectó');
select throws_ok(format($$update public.integrations set status = 'error' where id = %L$$, :'int_a'),
  '42501', null, 'ni la pone en error');
reset role;
select pg_temp.act_as_mfa(:a_admin, :'s_admin');
select lives_ok(format($$update public.integrations set status = 'pending' where id = %L$$, :'int_a'),
  'y la vuelve a conectar (pendiente)');
reset role;
select results_eq(
  format($$select status, external_connection_id, connected_by from public.integrations where id = %L$$, :'int_a'),
  format($$values ('pending'::text, null::text, %L::uuid)$$, :a_admin),
  'pendiente otra vez, sin id, a su nombre');
-- Sin DELETE: una integración se desconecta, no se borra.
select pg_temp.act_as_mfa(:a_admin, :'s_admin');
select throws_ok(format($$delete from public.integrations where id = %L$$, :'int_a'), '42501', null, 'el org_admin no la borra');
reset role;
select is(pg_temp.status_of(:'int_a'), 'pending', 'y sigue ahí');

select * from finish();
rollback;
