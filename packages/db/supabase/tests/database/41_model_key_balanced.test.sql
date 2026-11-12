-- La clave de modelo `balanced` (20261112040000, B-01): una organización la
-- puede elegir para una tarea de texto; nunca para los embeddings, y una clave
-- desconocida sigue sin entrar.
begin;
\ir _fixtures/tenants.psql
select plan(5);

select pg_temp.login_mfa(:a_admin) as s \gset
select lives_ok(
  format($$insert into public.org_model_settings (organization_id, residency, model_by_task) values (%L, 'any', '{"converse": "balanced"}')$$, :org_a),
  'el org_admin con aal2 elige balanced para conversar');
select lives_ok(
  format($$update public.org_model_settings set model_by_task = '{"converse": "balanced", "reason": "balanced", "classify": "fast"}' where organization_id = %L$$, :org_a),
  'y para razonar, junto a otras claves');
select throws_ok(
  format($$update public.org_model_settings set model_by_task = '{"embed": "balanced"}' where organization_id = %L$$, :org_a),
  '23514', null, 'los embeddings, nunca con balanced');
select throws_ok(
  format($$update public.org_model_settings set model_by_task = '{"converse": "balance"}' where organization_id = %L$$, :org_a),
  '23514', null, 'una clave desconocida sigue sin entrar');
reset role;
select is(
  (select model_by_task from public.org_model_settings where organization_id = :org_a),
  '{"converse": "balanced", "reason": "balanced", "classify": "fast"}'::jsonb,
  'queda guardada la elección válida');

select * from finish();
rollback;
