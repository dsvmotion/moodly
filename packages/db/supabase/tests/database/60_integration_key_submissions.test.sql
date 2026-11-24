-- Alta de la clave de una integración nativa (20261114110000, int-koibox;
-- ADR 0055): la app solo inserta el envío cifrado, solo el org_admin con MFA y
-- solo en su organización; el evento sale con el envío; al desconectar sale el
-- evento con el secreto anterior; y lo que puede y no puede hacer moodly_worker
-- con los envíos, los secretos y las integraciones nativas (sección 3, en
-- negativo). La lista blanca de la app para crear la integración nativa, también.
begin;
\ir _fixtures/tenants.psql
select plan(105);

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres: las guardas no actúan)
-- ---------------------------------------------------------------------------
\set kname_a1 '''koibox.a2000000-0000-4000-8000-000000000001'''
\set kname_a2 '''koibox.a2000000-0000-4000-8000-000000000002'''
\set kname_a3 '''koibox.a2000000-0000-4000-8000-000000000003'''

insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'integration', 'koibox.api_key', 'local:v1', 'QUFB', 'QUFB') returning id as sec_act \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'integration', :kname_a3, 'local:v1', 'QkJC', 'QkJC') returning id as sec_disc \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_b, 'integration', 'koibox.api_key', 'local:v1', 'Q0ND', 'Q0ND') returning id as sec_b \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'model_provider', 'anthropic', 'local:v1', 'TU1N', 'TU1N') returning id as sec_model \gset

-- A1: pendiente, sin secreto. Toda A: activa, con su secreto. A2: en error. A3: desconectada, con secreto.
insert into public.integrations (organization_id, location_id, provider, kind, status)
values (:org_a, :loc_a1, 'koibox', 'native', 'pending') returning id as int_pend \gset
insert into public.integrations (organization_id, provider, kind, status, secret_id)
values (:org_a, 'koibox', 'native', 'active', :'sec_act') returning id as int_act \gset
insert into public.integrations (organization_id, location_id, provider, kind, status)
values (:org_a, :loc_a2, 'koibox', 'native', 'error') returning id as int_err \gset
insert into public.integrations (organization_id, location_id, provider, kind, status, secret_id)
values (:org_a, :loc_a3, 'koibox', 'native', 'disconnected', :'sec_disc') returning id as int_disc \gset
insert into public.integrations (organization_id, provider, kind, status)
values (:org_b, 'koibox', 'native', 'pending') returning id as int_b \gset
insert into public.integrations (organization_id, provider, kind, status, external_connection_id)
values (:org_a, 'google-calendar', 'platform', 'active', 'conn-57-a') returning id as plat_a \gset

select gen_random_uuid() as sub1 \gset
select gen_random_uuid() as sub2 \gset
select gen_random_uuid() as sub3 \gset
select gen_random_uuid() as sub_x \gset

-- Un envío de B, para los negativos del worker.
insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
values (gen_random_uuid(), :org_b, :'int_b', 'koibox', 'local:v1', 'ZGVr', 'Y2lw') returning id as sub_b \gset

-- ===========================================================================
-- 1. Estructura y privilegios, exactos
-- ===========================================================================
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'authenticated' and table_name = 'integration_secret_submissions' and privilege_type = 'INSERT'),
  'ciphertext, encrypted_data_key, id, integration_id, key_ref, organization_id, provider',
  'la app inserta solo estas columnas (ni submitted_by ni created_at)');
select is(
  (select count(*)::int from information_schema.column_privileges
   where grantee = 'authenticated' and table_name = 'integration_secret_submissions' and privilege_type <> 'INSERT'),
  0, 'y nada más: ni SELECT ni UPDATE por columna');
select ok(not has_table_privilege('authenticated', 'public.integration_secret_submissions', 'select,update,delete,truncate'),
  'ni SELECT, UPDATE, DELETE ni TRUNCATE de la tabla');
select ok(not has_table_privilege('anon', 'public.integration_secret_submissions', 'select,insert,update,delete,truncate')
          and not has_any_column_privilege('anon', 'public.integration_secret_submissions', 'select,insert,update'),
  'anon: nada');
select ok(not has_table_privilege('service_role', 'public.integration_secret_submissions', 'select,insert,update,delete,truncate')
          and not has_any_column_privilege('service_role', 'public.integration_secret_submissions', 'select,insert,update'),
  'service_role: nada (solo el worker abre los envíos)');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.integration_secret_submissions'::regclass),
  'RLS activado y forzado');
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integration_secret_submissions' and privilege_type = 'SELECT'),
  'ciphertext, created_at, encrypted_data_key, id, integration_id, key_ref, organization_id, provider',
  'el worker lee solo lo que necesita (no submitted_by)');
select is(
  (select count(*)::int from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integration_secret_submissions' and privilege_type <> 'SELECT'),
  0, 'y no inserta ni cambia ninguna columna');
select is(
  (select string_agg(privilege_type::text, ', ') from information_schema.role_table_grants
   where grantee = 'moodly_worker' and table_name = 'integration_secret_submissions'),
  'DELETE', 'de tabla entera, solo DELETE');
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integration_secrets' and privilege_type = 'INSERT'),
  'ciphertext, encrypted_data_key, key_ref, kind, name, organization_id',
  'el worker inserta en integration_secrets solo estas columnas');
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integration_secrets' and privilege_type = 'UPDATE'),
  'ciphertext, encrypted_data_key, key_ref, rotated_at',
  'y al rotar cambia solo la clave (ni la organización, ni el tipo, ni el nombre)');
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integrations' and privilege_type = 'UPDATE'
     and column_name in ('secret_id', 'last_submission_at', 'last_submission_id')),
  'last_submission_at, last_submission_id, secret_id',
  'en integrations, además, el secreto y la marca del último envío');
select ok(not has_column_privilege('authenticated', 'public.integrations', 'last_submission_at', 'update')
          and not has_column_privilege('authenticated', 'public.integrations', 'last_submission_id', 'update')
          and not has_column_privilege('authenticated', 'public.integrations', 'secret_id', 'update'),
  'la app no cambia ni el secreto ni la marca de una integración');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'private'::regnamespace and p.prosecdef
     and p.proname in ('emit_integration_key_submitted', 'emit_integration_disconnected', 'guard_secret_submission',
                       'guard_worker_integration', 'guard_worker_integration_secret', 'guard_integration_write')),
  array['emit_integration_disconnected', 'emit_integration_key_submitted'],
  'solo los dos emisores de eventos son security definer; las guardas son invoker');
select is(
  (select array_agg(format('%s:%s', r, f) order by 1)
   from unnest(array['anon', 'authenticated', 'service_role', 'moodly_worker']) as r,
        unnest(array['private.emit_integration_key_submitted()', 'private.emit_integration_disconnected()']) as f
   where has_function_privilege(r, f, 'execute')),
  null, 'nadie de la app ni el worker puede llamar a los emisores');
select ok(not has_table_privilege('moodly_worker', 'public.domain_events', 'insert')
          and not has_table_privilege('authenticated', 'public.domain_events', 'insert'),
  'ni el worker ni la app insertan en domain_events: no pueden fabricar un envío');

-- ===========================================================================
-- 2. La app crea la integración nativa (lista blanca, guard_integration_write)
-- ===========================================================================
select pg_temp.login_mfa(:b_admin) as s_b \gset
select lives_ok(format($$insert into public.integrations (organization_id, location_id, provider, kind, status)
  values (%L, %L, 'koibox', 'native', 'pending')$$, :org_b, :loc_b1),
  'el org_admin con MFA crea una integración de Koibox pendiente');
select throws_ok(format($$insert into public.integrations (organization_id, provider, kind, status)
  values (%L, 'otra-nativa', 'native', 'pending')$$, :org_b),
  '42501', null, 'pero no otra nativa que no es de clave del cliente');
select throws_ok(format($$insert into public.integrations (organization_id, location_id, provider, kind, status)
  values (%L, %L, 'koibox', 'native', 'active')$$, :org_b, :loc_b1),
  '42501', null, 'ni la crea activa');
reset role;
select is((select connected_by from public.integrations where organization_id = :org_b and location_id = :loc_b1 and provider = 'koibox'),
  :b_admin::uuid, 'queda a nombre de quien la crea');

-- ===========================================================================
-- 3. La app solo inserta el envío
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s_a \gset
select lives_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (%L, %L, %L, 'koibox', 'local:v1', 'ZGVrMQ==', 'Y2lwMQ==')$$, :'sub1', :org_a, :'int_pend'),
  'el org_admin con MFA envía la clave de una integración pendiente (primera conexión)');
select lives_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (%L, %L, %L, 'koibox', 'local:v1', 'ZGVrMg==', 'Y2lwMg==')$$, :'sub2', :org_a, :'int_act'),
  'y de una activa (rotar)');
select lives_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (%L, %L, %L, 'koibox', 'local:v1', 'ZGVrMw==', 'Y2lwMw==')$$, :'sub3', :org_a, :'int_err'),
  'y de una en error');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'int_disc'),
  '42501', null, 'pero no de una desconectada');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'google-calendar', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'plat_a'),
  '42501', null, 'ni de una de plataforma');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'otro', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'int_pend'),
  '42501', null, 'ni con otro proveedor que el de la integración');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'int_b'),
  '42501', null, 'ni para la integración de otra organización (con la suya)');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :org_b, :'int_b'),
  '42501', null, 'ni en otra organización');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (%L, %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :'sub1', :org_a, :'int_pend'),
  '23505', null, 'el id de un envío no se reutiliza');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext, submitted_by)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==', %L)$$, :org_a, :'int_pend', :a_staff1),
  '42501', null, 'ni elige quién lo envía');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext, created_at)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==', now() + interval '1 day')$$, :org_a, :'int_pend'),
  '42501', null, 'ni cuándo');
select throws_ok($$select id from public.integration_secret_submissions$$, '42501', null, 'no lee los envíos, ni los suyos');
select throws_ok(format($$update public.integration_secret_submissions set ciphertext = 'eA==' where id = %L$$, :'sub1'),
  '42501', null, 'ni los cambia');
select throws_ok(format($$delete from public.integration_secret_submissions where id = %L$$, :'sub1'),
  '42501', null, 'ni los borra');
select throws_ok($$select ciphertext from public.integration_secrets$$, '42501', null, 'y sigue sin leer los secretos');
reset role;

select pg_temp.login(:a_admin) as s_a1 \gset
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'int_pend'),
  '42501', null, 'el org_admin sin el segundo factor (aal1) no envía');
reset role;
select pg_temp.login_mfa(:a_loc1_mgr) as s_lm \gset
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'int_pend'),
  '42501', null, 'ni un location_manager, aunque sea de ese local y tenga MFA');
reset role;
select pg_temp.staff_login(:p_admin) as s_p \gset
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :org_a, :'int_pend'),
  '42501', null, 'ni el equipo interno con permiso de soporte');
reset role;

select is((select submitted_by from public.integration_secret_submissions where id = :'sub1'), :a_admin::uuid,
  'submitted_by lo pone la base de datos: quien envía');
select ok((select created_at between now() - interval '1 minute' and now() from public.integration_secret_submissions where id = :'sub1'),
  'y created_at, la hora del envío');

-- El evento, en la misma transacción, solo con ids.
select is(
  (select count(*)::int from public.domain_events where type = 'integration.key_submitted' and organization_id = :org_a),
  3, 'un evento integration.key_submitted por envío insertado (ninguno por los rechazados)');
select results_eq(
  format($$select organization_id, location_id, payload from public.domain_events
    where type = 'integration.key_submitted' and payload->>'submission_id' = %L$$, :'sub1'),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('submission_id', %L::uuid, 'integration_id', %L::uuid, 'provider', 'koibox'))$$,
         :org_a, :loc_a1, :'sub1', :'int_pend'),
  'el evento lleva la organización y el local de la integración, y solo ids (ni la clave ni el texto cifrado)');
select is(
  (select count(*)::int from public.domain_events
    where type = 'integration.key_submitted' and (payload ? 'ciphertext' or payload ? 'encrypted_data_key' or payload::text like '%Y2lw%')),
  0, 'ningún evento lleva el texto cifrado');

-- ===========================================================================
-- 4. moodly_worker: los envíos
-- ===========================================================================
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select is((select count(*)::int from public.integration_secret_submissions), 0, 'sin organización fijada, no ve ningún envío');
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select results_eq(
  format($$select provider, key_ref, encrypted_data_key, ciphertext from public.integration_secret_submissions where id = %L$$, :'sub1'),
  $$values ('koibox'::text, 'local:v1'::text, 'ZGVrMQ=='::text, 'Y2lwMQ=='::text)$$,
  'lee un envío de su organización');
select is((select count(*)::int from public.integration_secret_submissions where id = :'sub_b'), 0, 'no ve el de B ni pidiéndolo por id');
select throws_ok($$select submitted_by from public.integration_secret_submissions$$, '42501', null, 'no lee quién lo envió');
select throws_ok(format($$insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (%L, %L, %L, 'koibox', 'local:v1', 'eA==', 'eA==')$$, :'sub_x', :org_a, :'int_pend'),
  '42501', null, 'no inserta un envío');
select throws_ok(format($$update public.integration_secret_submissions set ciphertext = 'eA==' where id = %L$$, :'sub1'),
  '42501', null, 'ni lo cambia');
select results_eq(format($$with w as (delete from public.integration_secret_submissions where id = %L returning id) select count(*)::int from w$$, :'sub_b'), $$values (0)$$,
  'no borra el de B');
select results_eq(format($$with w as (delete from public.integration_secret_submissions where id = %L returning id) select count(*)::int from w$$, :'sub3'), $$values (1)$$,
  'borra uno suyo');

-- ===========================================================================
-- 5. moodly_worker: los secretos
-- ===========================================================================
select lives_ok(format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
  values (%L, 'integration', %L, 'local:v1', 'TkVX', 'TkVX')$$, :org_a, :kname_a1),
  'inserta el secreto de una integración de su organización');
select throws_ok(format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
  values (%L, 'integration', 'koibox.otro', 'local:v1', 'eA==', 'eA==')$$, :org_b),
  '42501', null, 'no escribe un secreto en B (RLS, WITH CHECK)');
select throws_ok(format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
  values (%L, 'model_provider', 'openai', 'local:v1', 'eA==', 'eA==')$$, :org_a),
  '42501', null, 'ni una clave de modelo de BYOK');
select lives_ok(format($$update public.integration_secrets set key_ref = 'local:v1', encrypted_data_key = 'Uk9U', ciphertext = 'Uk9U' where id = %L$$, :'sec_act'),
  'rota la clave de un secreto suyo');
reset role;
select ok((select rotated_at is not null from public.integration_secrets where id = :'sec_act'), 'y queda la hora de la rotación');
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select lives_ok(format($$update public.integration_secrets set rotated_at = null where id = %L$$, :'sec_act'),
  'si intenta borrar la hora de la rotación…');
reset role;
select is((select rotated_at is not null from public.integration_secrets where id = :'sec_act'), true, '…la guarda la vuelve a poner');
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select throws_ok(format($$update public.integration_secrets set name = 'koibox.otro' where id = %L$$, :'sec_act'),
  '42501', null, 'no cambia el nombre de un secreto');
select throws_ok(format($$update public.integration_secrets set organization_id = %L where id = %L$$, :org_b, :'sec_act'),
  '42501', null, 'ni su organización');
select throws_ok(format($$update public.integration_secrets set kind = 'model_provider' where id = %L$$, :'sec_act'),
  '42501', null, 'ni su tipo');
select results_eq(format($$with w as (update public.integration_secrets set ciphertext = 'eA==' where id = %L returning id) select count(*)::int from w$$, :'sec_b'), $$values (0)$$,
  'no cambia un secreto de B');
select results_eq(format($$with w as (delete from public.integration_secrets where id = %L returning id) select count(*)::int from w$$, :'sec_b'), $$values (0)$$,
  'ni lo borra');

-- ===========================================================================
-- 6. moodly_worker: las integraciones nativas (guard_worker_integration)
-- ===========================================================================
select id as sec_new from public.integration_secrets where organization_id = :org_a and name = :kname_a1 \gset
select throws_ok(format($$update public.integrations set status = 'active' where id = %L$$, :'int_pend'),
  '23514', null, 'no activa una nativa sin secreto');
select throws_ok(format($$update public.integrations set status = 'active', secret_id = %L where id = %L$$, :'sec_act', :'int_pend'),
  '42501', null, 'ni con el secreto de otra integración (otro nombre)');
select throws_ok(format($$update public.integrations set status = 'active', secret_id = %L where id = %L$$, :'sec_b', :'int_pend'),
  '42501', null, 'ni con un secreto de otra organización');
select throws_ok(format($$update public.integrations set external_connection_id = 'conn-x' where id = %L$$, :'int_pend'),
  '42501', null, 'no pone un id de conexión externa en una nativa');
select lives_ok(format($$update public.integrations set status = 'active', secret_id = %L, last_submission_at = now(), last_submission_id = %L, last_submission_result = 'applied' where id = %L$$,
  :'sec_new', :'sub1', :'int_pend'),
  'activa una pendiente con su secreto y apunta la marca del envío');
select throws_ok(format($$update public.integrations set last_submission_at = last_submission_at - interval '1 second', last_submission_id = %L where id = %L$$, :'sub2', :'int_pend'),
  '42501', null, 'la marca no va hacia atrás');
select throws_ok(format($$update public.integrations set last_submission_id = '00000000-0000-4000-8000-000000000000' where id = %L$$, :'int_pend'),
  '42501', null, 'ni con la misma hora y un id menor');
select throws_ok(format($$update public.integrations set last_submission_at = null, last_submission_id = null where id = %L$$, :'int_pend'),
  '42501', null, 'ni se borra');
select lives_ok(format($$update public.integrations set last_submission_id = 'ffffffff-ffff-4fff-bfff-ffffffffffff', last_submission_result = 'rejected' where id = %L$$, :'int_pend'),
  'con la misma hora, avanza con un id mayor (desempate)');
select throws_ok(format($$update public.integrations set secret_id = null where id = %L$$, :'int_act'),
  '42501', null, 'no quita el secreto de una activa');
select throws_ok(format($$update public.integrations set status = 'error', secret_id = null where id = %L$$, :'int_act'),
  '42501', null, 'ni al pasarla a error');
select lives_ok(format($$update public.integrations set status = 'error' where id = %L$$, :'int_act'),
  'pasa una activa a error (sin tocar el secreto)');
select throws_ok(format($$update public.integrations set secret_id = null where id = %L$$, :'int_act'),
  '42501', null, 'y en error no le quita el secreto');
select lives_ok(format($$update public.integrations set status = 'active' where id = %L$$, :'int_act'),
  'y la vuelve a activar');
select throws_ok(format($$update public.integrations set status = 'pending' where id = %L$$, :'int_act'),
  '42501', null, 'no la pasa a pendiente');
select throws_ok(format($$update public.integrations set status = 'disconnected' where id = %L$$, :'int_act'),
  '42501', null, 'ni a desconectada (eso lo decide una persona)');
select throws_ok(format($$update public.integrations set status = 'active' where id = %L$$, :'int_disc'),
  '42501', null, 'no reactiva una desconectada');
select throws_ok(format($$update public.integrations set secret_id = %L where id = %L$$, :'sec_act', :'int_err'),
  '42501', null, 'no enlaza a una en error el secreto de otra integración');
select lives_ok(format($$update public.integrations set secret_id = null where id = %L$$, :'int_disc'),
  'quita el secreto de una desconectada (la limpieza al desconectar)');
select throws_ok(format($$update public.integrations set secret_id = %L where id = %L$$, :'sec_disc', :'int_disc'),
  '42501', null, 'y a una desconectada no le pone un secreto');
select results_eq(format($$with w as (delete from public.integration_secrets where id = %L and kind = 'integration' returning id) select count(*)::int from w$$, :'sec_disc'), $$values (1)$$,
  'y borra ese secreto');
select results_eq(format($$with w as (update public.integrations set status = 'error' where id = %L returning id) select count(*)::int from w$$, :'int_b'), $$values (0)$$,
  'no cambia una integración de B');
select throws_ok(format($$update public.integrations set last_submission_at = now(), last_submission_id = %L where id = %L$$, :'sub1', :'plat_a'),
  '42501', null, 'una de plataforma no lleva marca de envío');
select lives_ok(format($$update public.integrations set status = 'error' where id = %L$$, :'plat_a'),
  'y con una de plataforma, lo de #277 sigue igual');
reset role;

-- Una pendiente con un secreto viejo (reconexión antes de la limpieza): pasa a error y se le quita.
update public.integrations set status = 'disconnected' where id = :'int_act';
update public.integrations set status = 'pending' where id = :'int_act';
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select throws_ok(format($$update public.integrations set secret_id = null where id = %L$$, :'int_act'),
  '42501', null, 'en una pendiente que sigue pendiente, no le quita el secreto');
select throws_ok(format($$update public.integrations set status = 'active', secret_id = null where id = %L$$, :'int_act'),
  '42501', null, 'ni al activarla');
select lives_ok(format($$update public.integrations set status = 'error', secret_id = null where id = %L$$, :'int_act'),
  'sí al pasar una pendiente a error (clave mala en la reconexión)');
reset role;

-- ===========================================================================
-- 7. Al desconectar, el evento con el secreto anterior
-- ===========================================================================
-- int_pend está activa con sec_new; int_err, en error sin secreto.
select pg_temp.login_mfa(:a_admin) as s_a2 \gset
select lives_ok(format($$update public.integrations set status = 'disconnected' where id = %L$$, :'int_pend'),
  'el org_admin desconecta una nativa activa');
select lives_ok(format($$update public.integrations set status = 'disconnected' where id = %L$$, :'int_err'),
  'y una en error sin secreto');
select throws_ok(format($$update public.integrations set secret_id = null where id = %L$$, :'int_pend'),
  '42501', null, 'pero no le quita el secreto (eso lo hace el worker)');
select lives_ok(format($$update public.integrations set status = 'pending' where id = %L$$, :'int_err'),
  'y la reconecta (pendiente)');
select throws_ok(format($$update public.integrations set status = 'active' where id = %L$$, :'int_err'),
  '42501', null, 'pero no la activa');
reset role;
select results_eq(
  format($$select organization_id, location_id, payload from public.domain_events
    where type = 'integration.disconnected' and payload->>'integration_id' = %L$$, :'int_pend'),
  format($$values (%L::uuid, %L::uuid, jsonb_build_object('integration_id', %L::uuid, 'provider', 'koibox', 'secret_id', %L::uuid))$$,
         :org_a, :loc_a1, :'int_pend', :'sec_new'),
  'sale integration.disconnected con el secreto que tenía (OLD.secret_id), la organización y el local de la fila');
select is((select count(*)::int from public.domain_events where type = 'integration.disconnected' and payload->>'integration_id' = :'int_err'),
  0, 'sin secreto no hay nada que limpiar: sin evento');
select is((select count(*)::int from public.domain_events where type = 'integration.disconnected' and payload->>'integration_id' = :'int_disc'),
  0, 'ni por una que ya estaba desconectada');
update public.integrations set status = 'disconnected' where id = :'plat_a';
select is((select count(*)::int from public.domain_events where type = 'integration.disconnected' and payload->>'integration_id' = :'plat_a'),
  0, 'ni por una de plataforma');
select is((select count(*)::int from public.domain_events where type = 'integration.disconnected' and organization_id = :org_a),
  2, 'en total, uno por cada desconexión de una nativa con secreto (int_act antes y int_pend ahora)');

-- ===========================================================================
-- 8. Los dos security definer: solo una fila en domain_events, y el tenant de la fila
-- ===========================================================================
select is(
  (select array_agg(format('%s:%s', proname, regexp_count(prosrc, '\m(insert|update|delete|truncate|merge|copy)\M', 1, 'i')) order by proname)
     from pg_proc where oid in ('private.emit_integration_key_submitted()'::regprocedure, 'private.emit_integration_disconnected()'::regprocedure)),
  array['emit_integration_disconnected:1', 'emit_integration_key_submitted:1'],
  'cada emisor tiene una sola sentencia de escritura');
select ok(
  (select bool_and(prosrc ~* 'insert into public\.domain_events') from pg_proc
    where oid in ('private.emit_integration_key_submitted()'::regprocedure, 'private.emit_integration_disconnected()'::regprocedure)),
  'y es un INSERT en public.domain_events');
select ok(
  (select bool_and(prosrc !~* '(auth\.|current_setting|request\.jwt|current_user|session_user|set_config)') from pg_proc
    where oid in ('private.emit_integration_key_submitted()'::regprocedure, 'private.emit_integration_disconnected()'::regprocedure)),
  'ninguno mira quién llama (ni auth.uid(), ni el JWT, ni current_setting): la organización y el local salen de la fila');

-- Lo que escribe de verdad un envío y una desconexión, tabla a tabla (pg_stat_xact_user_tables cuenta
-- lo de esta transacción, también lo que escriben los triggers).
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'integration', :kname_a2, 'local:v1', 'RERE', 'RERE') returning id as sec_err \gset
update public.integrations set status = 'active', secret_id = :'sec_err' where id = :'int_err';
create temp table w_before as
  select relid::regclass::text as t, n_tup_ins, n_tup_upd, n_tup_del from pg_stat_xact_user_tables;
create function pg_temp.w_delta() returns table (t text, ins bigint, upd bigint, del bigint) language sql as $$
  select a.relid::regclass::text, a.n_tup_ins - coalesce(b.n_tup_ins, 0), a.n_tup_upd - coalesce(b.n_tup_upd, 0), a.n_tup_del - coalesce(b.n_tup_del, 0)
    from pg_stat_xact_user_tables a left join w_before b on b.t = a.relid::regclass::text
   where a.schemaname not like 'pg_temp%'
     and (a.n_tup_ins, a.n_tup_upd, a.n_tup_del) is distinct from (b.n_tup_ins, b.n_tup_upd, b.n_tup_del)
   order by a.relid::regclass::text collate "C";
$$;
select pg_temp.act_as_mfa(:a_admin, :'s_a2');
insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
values (gen_random_uuid(), :org_a, :'int_err', 'koibox', 'local:v1', 'ZGVrNA==', 'Y2lwNA==');
update public.integrations set status = 'disconnected' where id = :'int_err';
reset role;
select results_eq(
  $$select t, ins, upd, del from pg_temp.w_delta()$$,
  $$values ('domain_events'::text, 2::bigint, 0::bigint, 0::bigint),
           ('integration_secret_submissions'::text, 1::bigint, 0::bigint, 0::bigint),
           ('integrations'::text, 0::bigint, 1::bigint, 0::bigint)$$,
  'un envío y una desconexión escriben solo el envío, la integración y un evento cada uno: nada más');
select results_eq(
  format($$select distinct organization_id, type from public.domain_events
    where type in ('integration.key_submitted', 'integration.disconnected') and payload->>'integration_id' = %L order by type$$, :'int_err'),
  format($$values (%L::uuid, 'integration.disconnected'::text), (%L::uuid, 'integration.key_submitted'::text)$$, :org_a, :org_a),
  'y los dos eventos son de la organización de la fila');

select * from finish();
rollback;
