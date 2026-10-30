-- Integraciones y skills mcp (20261031090000, paso 3c, ADR 0036). Las
-- integraciones las ve el org_admin y las escribe solo la plataforma; una
-- herramienta MCP entra fijada a su huella y sin clasificar (external_message
-- en draft), vuelve a ese estado si cambia, y los agentes bajan con su techo.
begin;
\ir _fixtures/tenants.psql
select plan(31);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset

-- ===========================================================================
-- 1. Integraciones: formato e integridad (la plataforma)
-- ===========================================================================
insert into public.integrations (organization_id, provider, kind, server_version, status)
values (:org_a, 'crm-demo', 'mcp', '1.2.0', 'active') returning id as int_mcp \gset
insert into public.integrations (organization_id, location_id, provider, kind)
values (:org_a, :loc_a1, 'google-calendar', 'native') returning id as int_cal \gset
insert into public.integrations (organization_id, provider, kind, server_version)
values (:org_b, 'crm-demo', 'mcp', '1.2.0') returning id as int_b \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_a, 'integration', 'whatsapp', 'local:v1', 'ZGVr', 'Y2lwaGVy') returning id as secret_a \gset
insert into public.integration_secrets (organization_id, kind, name, key_ref, encrypted_data_key, ciphertext)
values (:org_b, 'integration', 'whatsapp', 'local:v1', 'ZGVr', 'Y2lwaGVy') returning id as secret_b \gset
insert into public.integrations (organization_id, provider, kind, secret_id)
values (:org_a, 'whatsapp', 'native', :'secret_a') returning id as int_wa \gset

select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'otro-mcp', 'mcp')$$, :org_a),
  '23514', null, 'una integración MCP lleva la versión revisada del servidor');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, server_version) values (%L, 'otra', 'native', '1.0')$$, :org_a),
  '23514', null, 'y una nativa no');
select throws_ok(
  format($$insert into public.integrations (organization_id, location_id, provider, kind) values (%L, %L, 'otra', 'native')$$, :org_a, :loc_b1),
  '23514', null, 'el local es de su organización');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, connected_by) values (%L, 'otra', 'native', %L)$$, :org_a, :outsider),
  '23514', null, 'y quien la conectó también');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, secret_id) values (%L, 'otra', 'native', %L)$$, :org_a, :'secret_b'),
  '23503', null, 'nunca con el secreto de otra organización');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind, server_version) values (%L, 'crm-demo', 'mcp', '2.0')$$, :org_a),
  '23505', null, 'una por proveedor en cada ámbito');
select throws_ok(
  format($$update public.integrations set provider = 'otra' where id = %L$$, :'int_mcp'),
  '42501', null, 'el proveedor no cambia');
select throws_ok(
  format($$update public.integrations set location_id = %L where id = %L$$, :loc_a2, :'int_cal'),
  '42501', null, 'ni el local');
delete from public.integration_secrets where id = :'secret_a';
select is((select secret_id from public.integrations where id = :'int_wa'), null::uuid,
  'si se borra el secreto, la integración sigue, sin él');

-- ===========================================================================
-- 2. Quién las ve; nadie las escribe desde la app
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select is((select count(*)::int from public.integrations), 3, 'el org_admin ve las de su organización');
select throws_ok(
  format($$insert into public.integrations (organization_id, provider, kind) values (%L, 'otra', 'native')$$, :org_a),
  '42501', null, 'pero no crea ninguna');
select throws_ok(
  format($$update public.integrations set status = 'disconnected' where id = %L$$, :'int_mcp'),
  '42501', null, 'ni la cambia');
select throws_ok(
  format($$delete from public.integrations where id = %L$$, :'int_mcp'),
  '42501', null, 'ni la borra');
reset role;
select pg_temp.login(:a_loc1_mgr) as s \gset
select is((select count(*)::int from public.integrations), 0, 'un location_manager no las ve, ni la de su local');
reset role;
select pg_temp.login_mfa(:b_admin) as s \gset
select is((select count(*)::int from public.integrations), 1, 'el org_admin de otra organización solo ve la suya');
reset role;

-- ===========================================================================
-- 3. Skills mcp: entran sin clasificar y fijadas a su huella
-- ===========================================================================
insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy,
                           max_autonomy, status, mcp_tool_name, mcp_tool_hash)
values (:org_a, 'mcp_crm_demo_create_lead', 'mcp', 'Crear lead', :'int_mcp', 'read', 'autonomous',
        'autonomous', 'published', 'create_lead', repeat('a', 64))
returning id as skill_mcp \gset
select results_eq(
  format($$select effect_class, default_autonomy, max_autonomy, status from public.skills where id = %L$$, :'skill_mcp'),
  $$values ('external_message', 'draft', 'draft', 'draft')$$,
  'una herramienta MCP entra como external_message en draft, diga lo que diga el importador');

update public.skills set effect_class = 'read', default_autonomy = 'execute', max_autonomy = 'autonomous', status = 'published'
where id = :'skill_mcp';
select results_eq(
  format($$select effect_class, max_autonomy from public.skills where id = %L$$, :'skill_mcp'),
  $$values ('read', 'autonomous')$$,
  'clasificarla es un cambio aparte, y se queda');

insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
values (:'agent_a', :'skill_mcp', :org_a, 'execute');
update public.skills set mcp_tool_hash = repeat('b', 64) where id = :'skill_mcp';
select results_eq(
  format($$select effect_class, default_autonomy, max_autonomy, status from public.skills where id = %L$$, :'skill_mcp'),
  $$values ('external_message', 'draft', 'draft', 'draft')$$,
  'si la herramienta cambia (otra huella), vuelve a estar sin clasificar');
select is(
  (select autonomy_level from public.agent_skills where agent_id = :'agent_a' and skill_id = :'skill_mcp'), 'draft',
  'y el agente que la tenía en execute baja a draft con ella');

update public.skills set effect_class = 'read', max_autonomy = 'autonomous' where id = :'skill_mcp';
select is(
  (select autonomy_level from public.agent_skills where agent_id = :'agent_a' and skill_id = :'skill_mcp'), 'draft',
  'subir el techo no sube a los agentes');
update public.skills set max_autonomy = 'suggest', default_autonomy = 'suggest' where id = :'skill_mcp';
select is(
  (select autonomy_level from public.agent_skills where agent_id = :'agent_a' and skill_id = :'skill_mcp'), 'suggest',
  'bajarlo, sí: un agente nunca queda por encima del techo de la skill');

update public.skills set mcp_tool_name = 'create_lead_v2' where id = :'skill_mcp';
select is((select effect_class from public.skills where id = :'skill_mcp'), 'external_message',
  'otro nombre de herramienta también la deja sin clasificar');

select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy, max_autonomy, mcp_tool_name, mcp_tool_hash)
           values (null, 'mcp_x', 'mcp', 'X', %L, 'external_message', 'draft', 'draft', 'x', %L)$$, :'int_mcp', repeat('c', 64)),
  '23514', null, 'una skill mcp nunca es de la plataforma');
select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy, max_autonomy, mcp_tool_name)
           values (%L, 'mcp_x', 'mcp', 'X', %L, 'external_message', 'draft', 'draft', 'x')$$, :org_a, :'int_mcp'),
  '23514', null, 'ni existe sin la huella de la herramienta revisada');
select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy, max_autonomy, mcp_tool_name, mcp_tool_hash)
           values (%L, 'mcp_x', 'mcp', 'X', %L, 'external_message', 'draft', 'draft', 'x', 'no-es-una-huella')$$, :org_a, :'int_mcp'),
  '23514', null, 'y la huella es un SHA-256');
select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy, max_autonomy, mcp_tool_name, mcp_tool_hash)
           values (%L, 'mcp_x', 'mcp', 'X', %L, 'external_message', 'draft', 'draft', 'x', %L)$$, :org_a, :'int_b', repeat('c', 64)),
  '23503', null, 'nunca sale de la integración de otra organización');
select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy, max_autonomy, mcp_tool_name, mcp_tool_hash)
           values (%L, 'mcp_x', 'mcp', 'X', %L, 'external_message', 'draft', 'draft', 'x', %L)$$, :org_a, :'int_cal', repeat('c', 64)),
  '23514', null, 'ni de una integración nativa');
select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, integration_id, effect_class, default_autonomy, max_autonomy, mcp_tool_name, mcp_tool_hash)
           values (%L, 'mcp_otra_clave', 'mcp', 'X', %L, 'external_message', 'draft', 'draft', 'create_lead_v2', %L)$$, :org_a, :'int_mcp', repeat('c', 64)),
  '23505', null, 'una skill por herramienta y versión en cada integración');
select throws_ok(
  format($$delete from public.integrations where id = %L$$, :'int_mcp'),
  '23503', null, 'una integración con skills no se borra: se desconecta');

insert into public.skills (key, kind, name, effect_class, default_autonomy, max_autonomy)
values ('prueba_code', 'code', 'Prueba', 'read', 'autonomous', 'autonomous') returning id as skill_code \gset
select is((select effect_class || '/' || max_autonomy from public.skills where id = :'skill_code'), 'read/autonomous',
  'las skills que no son mcp no se tocan');

-- ===========================================================================
-- 4. La app no escribe skills
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$update public.skills set effect_class = 'read' where id = %L$$, :'skill_mcp'),
  '42501', null, 'el org_admin no clasifica herramientas todavía (llega con Ajustes → Integraciones)');

select * from finish();
rollback;
