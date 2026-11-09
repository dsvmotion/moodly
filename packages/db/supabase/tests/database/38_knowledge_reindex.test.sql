-- «Volver a indexar» (20261110090000, paso B20-3): desde la app, el único
-- cambio de estado de una fuente es de error a pending, lo hace quien puede
-- cambiarla (org_admin con aal2) y emite knowledge_source.pending.
begin;
\ir _fixtures/tenants.psql
select plan(14);

create temp view fixture_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b) and type = 'knowledge_source.pending';

select ok(has_column_privilege('authenticated', 'public.knowledge_sources', 'status', 'UPDATE'),
  'authenticated puede escribir el estado (lo acota la guarda)');
select ok(not has_column_privilege('anon', 'public.knowledge_sources', 'status', 'UPDATE'), 'anon no');

-- Una fuente de A que el worker dejó en error.
set local role service_role;
insert into public.knowledge_sources (organization_id, location_id, type, title, body, status)
values (:org_a, :loc_a1, 'faq', 'Tarifas', 'Primera visita: 40 €.', 'error')
returning id as src \gset
reset role;
select is((select count(*)::int from fixture_events where payload->>'source_id' = :'src'), 0,
  'el worker la deja en error sin evento');

-- ===========================================================================
-- 1. Quien no puede cambiarla, tampoco la reindexa
-- ===========================================================================
select pg_temp.login(:a_admin) as s \gset
with u as (update public.knowledge_sources set status = 'pending' where id = :'src' returning 1)
select is(count(*)::int, 0, 'sin aal2, el org_admin no la reindexa') from u;
reset role;

select pg_temp.login(:a_staff1) as s \gset
with u as (update public.knowledge_sources set status = 'pending' where id = :'src' returning 1)
select is(count(*)::int, 0, 'el equipo del local la ve pero no la reindexa') from u;
reset role;

select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.knowledge_sources set status = 'pending' where id = :'src' returning 1)
select is(count(*)::int, 0, 'ni el org_admin de otra organización') from u;
reset role;
select is((select status from public.knowledge_sources where id = :'src'), 'error', 'sigue en error');

-- ===========================================================================
-- 2. El org_admin con aal2 la reindexa
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
with u as (update public.knowledge_sources set status = 'pending' where id = :'src' returning status)
select coalesce((select status from u), 'sin fila') as reindexed \gset
reset role;
select is(:'reindexed'::text, 'pending'::text, 'el org_admin con aal2 la devuelve a pending');
select results_eq(
  format($$select organization_id, location_id, payload from fixture_events where payload->>'source_id' = %L$$, :'src'),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('source_id', %L::uuid))$$, :org_a, :loc_a1, :'src'),
  'y emite knowledge_source.pending con su organización y su local');

-- ===========================================================================
-- 3. Ningún otro cambio de estado desde la app
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(format($$update public.knowledge_sources set status = 'ready' where id = %L$$, :'src'),
  '42501', null, 'de pending a ready, no');
select throws_ok(format($$update public.knowledge_sources set status = 'error' where id = %L$$, :'src'),
  '42501', null, 'ni de pending a error');
reset role;

set local role service_role;
update public.knowledge_sources set status = 'ready' where id = :'src';
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(format($$update public.knowledge_sources set status = 'pending' where id = %L$$, :'src'),
  '42501', null, 'una fuente lista no se reindexa así (se reindexa cambiando su texto)');
select throws_ok(format($$update public.knowledge_sources set status = 'processing' where id = %L$$, :'src'),
  '42501', null, 'ni pasa a processing');
reset role;

-- El worker (service_role) sigue moviendo el estado como siempre.
set local role service_role;
select lives_ok(format($$update public.knowledge_sources set status = 'error' where id = %L$$, :'src'),
  'la plataforma no queda bloqueada por la guarda');
reset role;

select * from finish();
rollback;
