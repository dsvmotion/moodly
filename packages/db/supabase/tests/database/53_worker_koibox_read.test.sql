-- Koibox, solo lectura (20261113100000, O-02; ADR 0034 y 0049): moodly_worker
-- lee las columnas del secreto cifrado que necesita SecretVault, solo de su
-- organización; la app y el equipo siguen sin ver los secretos. Desde
-- 20261114110000 (ADR 0055) el worker también escribe los secretos de
-- integración (lo prueban, exacto y en negativo, 60_integration_key_submissions);
-- aquí queda que sigue sin tocar las claves de modelo de BYOK ni enlazar a una
-- integración un secreto que no es el suyo.
begin;
\ir _fixtures/tenants.psql
select plan(14);

insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'integration', 'koibox.api_key', 'local:v1', 'ZGVrQQ==', 'Y2lwaGVyQQ==') returning id as sec_a \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_b, 'integration', 'koibox.api_key', 'local:v1', 'ZGVrQg==', 'Y2lwaGVyQg==') returning id as sec_b \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'model_provider', 'anthropic', 'local:v1', 'ZGVrTQ==', 'Y2lwaGVyTQ==') returning id as sec_model \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'integration', 'otra.api_key', 'local:v1', 'ZGVrTw==', 'Y2lwaGVyTw==') returning id as sec_other \gset
insert into public.integrations (organization_id, provider, kind, status, secret_id)
values (:org_a, 'koibox', 'native', 'active', :'sec_a') returning id as int_a \gset
insert into public.integrations (organization_id, provider, kind, status, secret_id)
values (:org_b, 'koibox', 'native', 'active', :'sec_b') returning id as int_b \gset

-- Privilegios, exactos.
select is(
  (select string_agg(column_name::text, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and table_name = 'integration_secrets' and privilege_type = 'SELECT'),
  'ciphertext, encrypted_data_key, id, key_ref, kind, name, organization_id',
  'lee de integration_secrets solo lo que necesita SecretVault.open');
select is(
  (select string_agg(privilege_type::text, ', ' order by privilege_type::text) from information_schema.role_table_grants
   where grantee = 'moodly_worker' and table_name = 'integration_secrets'),
  'DELETE', 'de tabla entera, solo DELETE (20261114110000; las columnas de INSERT y UPDATE las fija 60_integration_key_submissions)');
select ok(not has_table_privilege('moodly_worker', 'public.integration_secrets', 'select,truncate'),
  'sin SELECT de la tabla entera (ni created_at ni rotated_at) ni TRUNCATE');
select ok(has_column_privilege('moodly_worker', 'public.integrations', 'secret_id', 'select'), 'lee el secret_id de integrations');

-- Como moodly_worker, con la organización A fijada.
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select is((select count(*)::int from public.integration_secrets), 0, 'sin organización fijada, no ve ningún secreto');
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select results_eq(
  format($$select s.key_ref, s.encrypted_data_key, s.ciphertext
    from public.integrations i join public.integration_secrets s on s.id = i.secret_id and s.organization_id = i.organization_id
    where i.organization_id = %L and i.provider = 'koibox' and i.kind = 'native' and i.status = 'active'$$, :org_a),
  $$values ('local:v1'::text, 'ZGVrQQ=='::text, 'Y2lwaGVyQQ=='::text)$$,
  'lee el secreto cifrado de su integración de Koibox');
select is((select count(*)::int from public.integration_secrets where id = :'sec_b'), 0, 'no ve el secreto de B ni pidiéndolo por id');
select is((select count(*)::int from public.integrations where id = :'int_b'), 0, 'ni la integración de B');
select throws_ok($$select * from public.integration_secrets$$, '42501', null, 'select * falla: ni created_at ni rotated_at');
select throws_ok(format($$update public.integration_secrets set ciphertext = 'eA==' where id = %L$$, :'sec_model'), '42501', null,
  'no cambia una clave de modelo de BYOK');
select throws_ok(format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext) values (%L, 'model_provider', 'otro', 'local:v1', 'eA==', 'eA==')$$, :org_a),
  '42501', null, 'ni crea una');
select throws_ok(format($$delete from public.integration_secrets where id = %L$$, :'sec_model'), '42501', null, 'ni la borra');
select throws_ok(format($$update public.integrations set secret_id = %L where id = %L$$, :'sec_other', :'int_a'), '42501', null,
  'ni enlaza a la integración un secreto que no es el suyo (otro nombre)');
reset role;

-- La app y el equipo, como antes: nada.
select pg_temp.login_mfa(:a_admin) as s_admin \gset
select throws_ok($$select ciphertext from public.integration_secrets$$, '42501', null, 'el org_admin con MFA no lee los secretos');
reset role;

select * from finish();
rollback;
