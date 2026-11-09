-- Las fuentes de conocimiento de texto (20261109180000, paso B20-1): el
-- org_admin con aal2 escribe el texto; cambiarlo la vuelve a poner pendiente;
-- crearla o volver a pendiente emite knowledge_source.pending con su
-- organización y su local, y nada más lo emite.
begin;
\ir _fixtures/tenants.psql
select plan(16);

create temp view fixture_events as
  select * from public.domain_events where organization_id in (:org_a, :org_b) and type = 'knowledge_source.pending';

select ok((select prosecdef from pg_proc where oid = 'private.emit_knowledge_source_event()'::regprocedure),
  'emit_knowledge_source_event es security definer (escribe el evento por quien no tiene privilegios)');
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) as r
   where has_function_privilege(r, 'private.emit_knowledge_source_event()', 'execute')),
  null, 'nadie de la app puede ejecutarla');

-- ===========================================================================
-- 1. El org_admin escribe el texto
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select lives_ok(
  format($$insert into public.knowledge_sources (organization_id, location_id, type, title, body)
           values (%L, %L, 'faq', 'Horario', 'De lunes a viernes de 9:00 a 20:00.')$$, :org_a, :loc_a1),
  'el org_admin con aal2 crea una fuente con su texto');
reset role;
select id as src from public.knowledge_sources where title = 'Horario' and organization_id = :org_a \gset
select results_eq(
  format($$select status, body from public.knowledge_sources where id = %L$$, :'src'),
  $$values ('pending'::text, 'De lunes a viernes de 9:00 a 20:00.'::text)$$,
  'pendiente de ingesta, con su texto');
select results_eq(
  format($$select organization_id, location_id, payload from fixture_events where payload->>'source_id' = %L$$, :'src'),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('source_id', %L::uuid))$$, :org_a, :loc_a1, :'src'),
  'y emite knowledge_source.pending con su organización y su local, solo con el id');

-- El worker la indexa: ready, sin evento.
set local role service_role;
update public.knowledge_sources set status = 'processing' where id = :'src';
update public.knowledge_sources set status = 'ready' where id = :'src';
reset role;
select is((select count(*)::int from fixture_events where payload->>'source_id' = :'src'), 1,
  'pasar a processing y a ready no emite nada');

-- ===========================================================================
-- 2. Cambiar el texto la reindexa; cambiar el título, no
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
update public.knowledge_sources set title = 'Horario del centro' where id = :'src';
reset role;
select results_eq(
  format($$select status, (select count(*)::int from fixture_events where payload->>'source_id' = %L)
           from public.knowledge_sources where id = %L$$, :'src', :'src'),
  $$values ('ready'::text, 1)$$,
  'cambiar solo el título no la vuelve a indexar');

select pg_temp.login_mfa(:a_admin) as s \gset
update public.knowledge_sources set body = 'De lunes a sábado de 9:00 a 21:00.' where id = :'src';
reset role;
select results_eq(
  format($$select status, (select count(*)::int from fixture_events where payload->>'source_id' = %L)
           from public.knowledge_sources where id = %L$$, :'src', :'src'),
  $$values ('pending'::text, 2)$$,
  'cambiar el texto la vuelve a poner pendiente y emite otro evento');

-- Mientras sigue pendiente, otro cambio del texto también avisa (la ingesta lee el último).
select pg_temp.login_mfa(:a_admin) as s \gset
update public.knowledge_sources set body = 'De lunes a sábado de 9:00 a 21:30.' where id = :'src';
reset role;
select is((select count(*)::int from fixture_events where payload->>'source_id' = :'src'), 3,
  'cada cambio del texto avisa, aunque ya estuviera pendiente');

-- ===========================================================================
-- 3. Lo que no se puede
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.knowledge_sources (organization_id, type, title, body) values (%L, 'faq', 'Vacía', '   ')$$, :org_a),
  '23514', null, 'un texto vacío no vale');
select throws_ok(
  format($$insert into public.knowledge_sources (organization_id, type, title, body) values (%L, 'faq', 'Enorme', %L)$$, :org_a, repeat('x', 20001)),
  '23514', null, 'ni uno de más de 20.000 caracteres');
select throws_ok(
  format($$update public.knowledge_sources set status = 'ready' where id = %L$$, :'src'),
  '42501', null, 'la app sigue sin tocar el estado');
reset role;

select pg_temp.login(:a_admin) as s \gset
with u as (update public.knowledge_sources set body = 'Sin MFA' where id = :'src' returning 1)
select is(count(*)::int, 0, 'sin aal2, el org_admin no cambia el texto') from u;
reset role;

select pg_temp.login(:a_staff1) as s \gset
with u as (update public.knowledge_sources set body = 'Del equipo' where id = :'src' returning 1)
select is(count(*)::int, 0, 'el equipo del local la ve pero no la cambia') from u;
reset role;

select pg_temp.login_mfa(:b_admin) as s \gset
with u as (update public.knowledge_sources set body = 'De otra organización' where id = :'src' returning 1)
select is(count(*)::int, 0, 'ni el org_admin de otra organización') from u;
reset role;
select is((select body from public.knowledge_sources where id = :'src'), 'De lunes a sábado de 9:00 a 21:30.',
  'el texto sigue siendo el del org_admin');

select * from finish();
rollback;
