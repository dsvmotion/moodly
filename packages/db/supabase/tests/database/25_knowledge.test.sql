-- Conocimiento (20261031120000, paso 3d, ADR 0037 sobre el 0025). Fuentes y
-- fragmentos con su alcance; la búsqueda solo devuelve lo de la organización,
-- lo de toda ella y lo de su local, del mismo modelo, listo y vigente; la app
-- gestiona fuentes (org_admin con aal2) pero no escribe fragmentos ni busca.
begin;
\ir _fixtures/tenants.psql
select plan(30);

-- ===========================================================================
-- 1. Datos (la plataforma, como la ingesta del worker)
-- ===========================================================================
insert into public.knowledge_sources (organization_id, type, title, status)
values (:org_a, 'faq', 'Horarios', 'ready') returning id as s_org \gset
insert into public.knowledge_sources (organization_id, location_id, type, title, status)
values (:org_a, :loc_a1, 'pricing', 'Precios Centro', 'ready') returning id as s_loc1 \gset
insert into public.knowledge_sources (organization_id, location_id, type, title, status)
values (:org_a, :loc_a2, 'policy', 'Cancelaciones Norte', 'ready') returning id as s_loc2 \gset
insert into public.knowledge_sources (organization_id, type, title)
values (:org_a, 'document', 'Borrador') returning id as s_pending \gset
insert into public.knowledge_sources (organization_id, type, title, status)
values (:org_b, 'faq', 'Horarios B', 'ready') returning id as s_b \gset

insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_a, :'s_org', 0, 'Opening hours: Monday to Friday from 9 to 20', '[1,0,0]', 'test-embed-3', 3)
returning id as c_org \gset
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_a, :'s_loc1', 0, 'Laser session price in Centro: 80 euros', '[0.6,0.8,0]', 'test-embed-3', 3)
returning id as c_loc1 \gset
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_a, :'s_loc2', 0, 'Cancellation policy in Norte: 24 hours notice', '[0.95,0.05,0]', 'test-embed-3', 3)
returning id as c_loc2 \gset
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_a, :'s_pending', 0, 'Opening hours draft', '[1,0,0]', 'test-embed-3', 3);
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_b, :'s_b', 0, 'Opening hours of org B', '[1,0,0]', 'test-embed-3', 3);
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_a, :'s_org', 0, 'Opening hours with another model', '[1,0,0,0]', 'other-embed-4', 4);
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim, valid_until)
values (:org_a, :'s_org', 1, 'Opening hours last summer', '[1,0,0]', 'test-embed-3', 3, now() - interval '1 day');

-- ===========================================================================
-- 2. search_knowledge
-- ===========================================================================
select results_eq(
  format($$select chunk_id from public.search_knowledge(%L, null, 'test-embed-3', '[1,0,0]', 'opening hours', 10)$$, :org_a),
  format($$values (%L::uuid)$$, :'c_org'),
  'un run de organización solo ve lo de toda la organización: ni locales, ni borradores, ni otra organización, ni otro modelo, ni lo caducado');
select set_eq(
  format($$select chunk_id from public.search_knowledge(%L, %L, 'test-embed-3', '[1,0,0]', 'hours', 10)$$, :org_a, :loc_a1),
  format($$values (%L::uuid), (%L::uuid)$$, :'c_org', :'c_loc1'),
  'uno de local ve eso y lo de su local, nunca lo de otro local');
select set_eq(
  format($$select chunk_id from public.search_knowledge(%L, %L, 'test-embed-3', '[1,0,0]', 'hours', 10)$$, :org_a, :loc_a2),
  format($$values (%L::uuid), (%L::uuid)$$, :'c_org', :'c_loc2'),
  'y al revés');
select results_eq(
  format($$select chunk_id from public.search_knowledge(%L, %L, 'test-embed-3', '[1,0,0]', 'laser price', 10)$$, :org_a, :loc_a1),
  format($$values (%L::uuid), (%L::uuid)$$, :'c_loc1', :'c_org'),
  'híbrida: lo que encaja por texto sube aunque el vector esté más lejos (RRF)');
select results_eq(
  format($$select chunk_id from public.search_knowledge(%L, %L, 'test-embed-3', '[1,0,0]', 'zzz', 10)$$, :org_a, :loc_a1),
  format($$values (%L::uuid), (%L::uuid)$$, :'c_org', :'c_loc1'),
  'sin coincidencias de texto, ordena por cercanía del vector');
select is(
  (select count(*)::int from public.search_knowledge(:org_a, :loc_a1, 'test-embed-3', '[1,0,0]', 'hours', 1)), 1,
  'devuelve como mucho k');
select results_eq(
  format($$select source_type, source_title from public.search_knowledge(%L, null, 'test-embed-3', '[1,0,0]', 'hours', 10)$$, :org_a),
  $$values ('faq', 'Horarios')$$,
  'con su fuente, para citarla');
select throws_ok(
  format($$select * from public.search_knowledge(%L, null, 'test-embed-3', '[1,0,0,0]', 'hours', 10)$$, :org_a),
  '22000', null, 'nunca compara vectores de dimensiones distintas: falla, no adivina');

-- ===========================================================================
-- 3. Integridad de fragmentos y fuentes
-- ===========================================================================
insert into public.knowledge_chunks (organization_id, source_id, location_id, ordinal, content, embedding, embedding_model, embedding_dim)
values (:org_a, :'s_loc1', null, 1, 'Otro precio', '[0,1,0]', 'test-embed-3', 3) returning id as c_copied \gset
select is((select location_id from public.knowledge_chunks where id = :'c_copied'), :loc_a1::uuid,
  'el alcance del fragmento lo copia la base de datos de su fuente, diga lo que diga quien inserta');
update public.knowledge_chunks set location_id = null where id = :'c_copied';
select is((select location_id from public.knowledge_chunks where id = :'c_copied'), :loc_a1::uuid,
  'tampoco se le quita al actualizar');
select throws_ok(
  format($$insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
           values (%L, %L, 9, 'x', '[1,0,0]', 'test-embed-3', 3)$$, :org_a, :'s_b'),
  '23503', null, 'un fragmento nunca es de la fuente de otra organización');
select throws_ok(
  format($$insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
           values (%L, %L, 9, 'x', '[1,0,0,0]', 'test-embed-3', 3)$$, :org_a, :'s_org'),
  '23514', null, 'la dimensión declarada es la del vector');
select throws_ok(
  format($$insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
           values (%L, %L, 9, 'x', '[1,0,0]', 'Modelo Con Espacios', 3)$$, :org_a, :'s_org'),
  '23514', null, 'el modelo tiene formato de identificador');
select throws_ok(
  format($$insert into public.knowledge_sources (organization_id, location_id, type, title) values (%L, %L, 'faq', 'X')$$, :org_a, :loc_b1),
  '23514', null, 'el local de una fuente es de su organización');
select throws_ok(
  format($$update public.knowledge_sources set location_id = %L where id = %L$$, :loc_a2, :'s_loc1'),
  '42501', null, 'y el alcance de una fuente no cambia (sus fragmentos lo copian)');
delete from public.knowledge_sources where id = :'s_pending';
select is((select count(*)::int from public.knowledge_chunks where source_id = :'s_pending'), 0,
  'al borrar una fuente se borran sus fragmentos');

-- ===========================================================================
-- 4. Desde la app
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select is((select count(*)::int from public.knowledge_sources), 3, 'el org_admin ve las fuentes de su organización');
select throws_ok(
  format($$select * from public.search_knowledge(%L, null, 'test-embed-3', '[1,0,0]', 'hours', 10)$$, :org_a),
  '42501', null, 'la app no busca directamente: la búsqueda es del runtime');
select throws_ok(
  format($$insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
           values (%L, %L, 7, 'x', '[1,0,0]', 'test-embed-3', 3)$$, :org_a, :'s_org'),
  '42501', null, 'ni escribe fragmentos: son de la ingesta');
select lives_ok(
  format($$insert into public.knowledge_sources (organization_id, type, title) values (%L, 'faq', 'Nueva')$$, :org_a),
  'el org_admin con aal2 añade una fuente');
select id as s_new from public.knowledge_sources where title = 'Nueva' \gset
select results_eq(
  $$select created_by, status from public.knowledge_sources where title = 'Nueva'$$,
  format($$values (%L::uuid, 'pending')$$, :a_admin),
  'con su autor y pendiente de ingesta, que pone la base de datos');
select throws_ok(
  format($$insert into public.knowledge_sources (organization_id, type, title, status) values (%L, 'faq', 'Lista', 'ready')$$, :org_a),
  '42501', null, 'la app no la marca como lista');
select throws_ok(
  $$update public.knowledge_sources set status = 'ready' where title = 'Nueva'$$,
  '42501', null, 'ni al cambiarla');
with u as (update public.knowledge_sources set title = 'Nueva (FAQ)' where title = 'Nueva' returning 1)
select is(count(*)::int, 1, 'pero sí le cambia el título') from u;
reset role;
select pg_temp.login(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.knowledge_sources (organization_id, type, title) values (%L, 'faq', 'Sin MFA')$$, :org_a),
  '42501', null, 'sin aal2 no añade fuentes');
reset role;
select pg_temp.login(:a_loc1_mgr) as s \gset
select set_eq(
  $$select id from public.knowledge_sources$$,
  format($$values (%L::uuid), (%L::uuid), (%L::uuid)$$, :'s_org', :'s_loc1', :'s_new'),
  'un location_manager ve lo de toda la organización y lo de su local');
select is((select count(*)::int from public.knowledge_chunks where location_id = :loc_a2), 0, 'nunca los fragmentos de otro local');
select throws_ok(
  format($$insert into public.knowledge_sources (organization_id, location_id, type, title) values (%L, %L, 'faq', 'X')$$, :org_a, :loc_a1),
  '42501', null, 'ni añade fuentes, ni siquiera de su local');
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
select is((select count(*)::int from public.knowledge_chunks), 1, 'el org_admin de otra organización solo ve lo suyo');
reset role;

-- ===========================================================================
-- 5. Muchos tenants (ADR 0025, verificación): 1.000 organizaciones con 20
-- fragmentos cada una; la de una organización devuelve solo lo suyo y los k.
-- ===========================================================================
insert into public.organizations (id, name)
select ('d0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Sintética ' || g from generate_series(1, 1000) g;
insert into public.knowledge_sources (id, organization_id, type, title, status)
select ('d1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       ('d0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'faq', 'FAQ ' || g, 'ready'
from generate_series(1, 1000) g;
insert into public.knowledge_chunks (organization_id, source_id, ordinal, content, embedding, embedding_model, embedding_dim)
select ('d0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       ('d1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       n, 'Respuesta ' || n || ' de la organización ' || g,
       ('[' || (random())::text || ',' || (random())::text || ',' || (random())::text || ']')::extensions.vector,
       'test-embed-3', 3
from generate_series(1, 1000) g, generate_series(0, 19) n;
select results_eq(
  $$select count(*)::int, count(*) filter (where c.organization_id <> 'd0000000-0000-4000-8000-000000000500')::int
    from public.search_knowledge('d0000000-0000-4000-8000-000000000500', null, 'test-embed-3', '[0.5,0.5,0.5]', 'respuesta', 10) r
    join public.knowledge_chunks c on c.id = r.chunk_id$$,
  $$values (10, 0)$$,
  'entre 1.000 organizaciones, la búsqueda de una devuelve los 10 pedidos y todos suyos');

select * from finish();
rollback;
