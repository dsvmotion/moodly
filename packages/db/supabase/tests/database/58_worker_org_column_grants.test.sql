-- 3.2 (20261114100000): moodly_worker lee organization_id de contact_identities,
-- domain_events y contacts, para filtrar por la organización explícita. Solo esa
-- columna: lo demás que no leía sigue sin leerlo, y RLS sigue dejando fuera las
-- filas de otras organizaciones aunque la consulta pida las suyas.
begin;
\ir _fixtures/tenants.psql
select plan(12);

insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_a \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Berta') returning id as c_b \gset
insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (:org_a, :'c_a', 'webchat', 'v57-a');
insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (:org_b, :'c_b', 'webchat', 'v57-b');
insert into public.domain_events (organization_id, type, payload) values (:org_b, 'invitation.created', '{"v57": true}');

-- La columna, en las tres.
select ok(has_column_privilege('moodly_worker', 'public.contact_identities', 'organization_id', 'SELECT'),
  'lee organization_id de contact_identities');
select ok(has_column_privilege('moodly_worker', 'public.domain_events', 'organization_id', 'SELECT'),
  'lee organization_id de domain_events');
select ok(has_column_privilege('moodly_worker', 'public.contacts', 'organization_id', 'SELECT'),
  'lee organization_id de contacts');

-- Y nada más de lo que no leía.
select ok(not has_column_privilege('moodly_worker', 'public.contacts', 'display_name', 'SELECT'), 'sigue sin leer el nombre del contacto');
select ok(not has_column_privilege('moodly_worker', 'public.contacts', 'consents', 'SELECT'), 'ni sus consentimientos');
select ok(not has_column_privilege('moodly_worker', 'public.contact_identities', 'created_at', 'SELECT'), 'ni cuándo se creó una identidad');
select ok(not has_column_privilege('moodly_worker', 'public.domain_events', 'source_run_id', 'SELECT'), 'ni el run de un evento');
select ok(not has_column_privilege('moodly_worker', 'public.domain_events', 'published_at', 'SELECT'), 'ni cuándo se publicó');
select ok(not has_table_privilege('moodly_worker', 'public.contacts', 'select'), 'sin SELECT de tabla entera en contacts');

-- RLS sigue mandando: pidiendo las filas de la otra organización, ninguna.
-- Como moodly_worker, con A fijada (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select is((select count(*)::int from public.contact_identities where organization_id = :org_b), 0,
  'las identidades de otra organización no se ven aunque se pidan');
select is((select count(*)::int from public.domain_events where organization_id = :org_b), 0,
  'los eventos de otra organización tampoco');
select is((select count(*)::int from public.contacts where organization_id = :org_b), 0,
  'ni sus contactos');
reset role;

select * from finish();
rollback;
