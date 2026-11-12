-- Política de modelos por organización y secretos cifrados (20261030120000,
-- paso 3b, ADR 0034/0035). El org_admin con aal2 gestiona residencia,
-- proveedores, modelo por tarea y topes; el modo de conexión solo lo pone la
-- plataforma; cada cambio queda en audit_logs; los secretos no los ve nadie
-- desde la app.
begin;
\ir _fixtures/tenants.psql
select plan(29);

-- ===========================================================================
-- 1. Quién gestiona la política
-- ===========================================================================
select pg_temp.login(:a_admin) as s \gset
select throws_ok(
  format($$insert into public.org_model_settings (organization_id, residency) values (%L, 'eu')$$, :org_a),
  '42501', null, 'el org_admin sin aal2 no crea la política');

reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
select lives_ok(
  format($$insert into public.org_model_settings (organization_id, residency, allowed_providers) values (%L, 'eu', array['anthropic', 'mistral'])$$, :org_a),
  'el org_admin con aal2 crea la política de su organización («Solo UE»)');
select is((select updated_by from public.org_model_settings where organization_id = :org_a), :a_admin::uuid,
  'updated_by lo pone la base de datos');
select throws_ok(
  format($$insert into public.org_model_settings (organization_id) values (%L)$$, :org_b),
  '42501', null, 'ni la de otra organización');
select throws_ok(
  format($$insert into public.org_model_settings (organization_id, connection) values (%L, 'byok')$$, :org_a),
  '42501', null, 'el modo de conexión no lo elige la app al crear');
select throws_ok(
  format($$update public.org_model_settings set connection = 'byok' where organization_id = %L$$, :org_a),
  '42501', null, 'ni al cambiar: lo pone la plataforma al guardar las claves');
select throws_ok(
  format($$update public.org_model_settings set updated_by = %L where organization_id = %L$$, :a_staff1, :org_a),
  '42501', null, 'ni quién cambió la política');

with u as (update public.org_model_settings set residency = 'any', budget_per_day_eur = 50 where organization_id = :org_a returning 1)
select is(count(*)::int, 1, 'el org_admin con aal2 cambia la residencia y los topes') from u;

reset role;
select pg_temp.login(:a_admin) as s \gset
with u as (update public.org_model_settings set residency = 'eu' where organization_id = :org_a returning 1)
select is(count(*)::int, 0, 'sin aal2 no la cambia') from u;
select is((select residency from public.org_model_settings where organization_id = :org_a), 'any', 'pero sí la ve');

reset role;
select pg_temp.login(:a_loc1_mgr) as s \gset
select is((select count(*)::int from public.org_model_settings), 0, 'un location_manager no la ve');
reset role;
select pg_temp.login(:a_staff1) as s \gset
select is((select count(*)::int from public.org_model_settings), 0, 'ni el staff');
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
select is((select count(*)::int from public.org_model_settings), 0, 'ni el org_admin de otra organización');
with u as (update public.org_model_settings set residency = 'eu' where organization_id = :org_a returning 1)
select is(count(*)::int, 0, 'que tampoco la cambia') from u;

-- ===========================================================================
-- 2. Formato cerrado
-- ===========================================================================
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(format($$update public.org_model_settings set allowed_providers = array['OpenAI'] where organization_id = %L$$, :org_a),
  '23514', null, 'proveedores en minúsculas');
select throws_ok(format($$update public.org_model_settings set allowed_providers = array['anthropic', 'anthropic'] where organization_id = %L$$, :org_a),
  '23514', null, 'sin repetir');
select throws_ok(format($$update public.org_model_settings set model_by_task = '{"chat": "fast"}' where organization_id = %L$$, :org_a),
  '23514', null, 'solo tareas conocidas');
select throws_ok(format($$update public.org_model_settings set model_by_task = '{"converse": "gpt-x"}' where organization_id = %L$$, :org_a),
  '23514', null, 'solo claves lógicas de modelo (nunca un ID de proveedor)');
select throws_ok(format($$update public.org_model_settings set model_by_task = '{"converse": "embedding"}' where organization_id = %L$$, :org_a),
  '23514', null, 'la conversación nunca con el modelo de embeddings');
select throws_ok(format($$update public.org_model_settings set model_by_task = '{"embed": "fast"}' where organization_id = %L$$, :org_a),
  '23514', null, 'y los embeddings siempre con él');
select throws_ok(format($$update public.org_model_settings set budget_per_run_eur = 60 where organization_id = %L$$, :org_a),
  '23514', null, 'el tope por run no supera el del día');
select lives_ok(format($$update public.org_model_settings set model_by_task = '{"converse": "smart"}' where organization_id = %L$$, :org_a),
  'una tarea con otra clave lógica válida');

-- ===========================================================================
-- 3. Auditoría
-- ===========================================================================
reset role;
-- La plataforma pone el modo de conexión al guardar las claves del cliente.
update public.org_model_settings set connection = 'byok' where organization_id = :org_a;
-- Un update que no cambia nada no deja rastro.
update public.org_model_settings set residency = residency where organization_id = :org_a;
-- Todas llevan la misma hora (la de la transacción del test): se comparan como conjunto.
select set_eq(
  $$select action, actor_type, metadata -> 'changed' from public.audit_logs
    where action like 'model_settings.%'$$,
  format($$values ('model_settings.insert', 'user', '{"residency": "eu", "connection": "managed", "model_by_task": {}, "allowed_providers": ["anthropic", "mistral"], "budget_per_day_eur": 20.0000, "budget_per_run_eur": 0.5000, "budget_per_month_eur": 300.0000}'::jsonb),
                  ('model_settings.update', 'user', '{"residency": "any", "budget_per_day_eur": 50.0000}'::jsonb),
                  ('model_settings.update', 'user', '{"model_by_task": {"converse": "smart"}}'::jsonb),
                  ('model_settings.update', 'system', '{"connection": "byok"}'::jsonb)$$),
  'cada cambio queda en audit_logs con lo que cambió y quién (persona o plataforma); un update sin cambios, no');
select is(
  (select count(distinct actor_id)::int from public.audit_logs where action like 'model_settings.%' and actor_type = 'user'), 1,
  'los cambios de la app llevan a la persona que los hizo');

-- ===========================================================================
-- 4. Secretos: nadie desde la app
-- ===========================================================================
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'model_provider', 'anthropic', 'local:v1', 'ZGVr', 'Y2lwaGVy');
select throws_ok(
  format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext) values (%L, 'model_provider', 'anthropic', 'local:v1', 'ZGVr', 'Y2lwaGVy')$$, :org_a),
  '23505', null, 'un secreto por organización, tipo y nombre');
select throws_ok(
  format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext) values (%L, 'integration', 'whatsapp', 'local:v1', 'ZGVr', 'en claro!')$$, :org_a),
  '23514', null, 'solo texto cifrado en base64');

select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok($$select * from public.integration_secrets$$, '42501', null, 'el org_admin con aal2 no lee los secretos');
select throws_ok(
  format($$insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext) values (%L, 'integration', 'google', 'local:v1', 'ZGVr', 'Y2lwaGVy')$$, :org_a),
  '42501', null, 'ni los escribe');
select pg_temp.staff_login(:p_admin) as s \gset
select throws_ok($$select * from public.integration_secrets$$, '42501', null, 'el equipo interno tampoco los lee');

select * from finish();
rollback;
