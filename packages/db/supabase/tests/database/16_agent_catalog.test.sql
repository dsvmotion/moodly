-- Catálogo de agentes y skills (20261023150000_agent_catalog, ADR 0030): los 4
-- de serie, un agente por tipo y organización creado al dar de alta la
-- organización, aislamiento entre organizaciones, solo lectura desde la app y la
-- integridad de tipos, skills y autonomía.
begin;
\ir _fixtures/tenants.psql
select plan(38);

\set custom_b   '''0b000000-0000-4000-8000-0000000000c1'''
\set skill_pub  '''5c000000-0000-4000-8000-000000000001'''
\set skill_b    '''5c000000-0000-4000-8000-000000000002'''
\set skill_rest '''5c000000-0000-4000-8000-000000000003'''

-- Cuenta lo que ve el usuario actual del catálogo en A y en B.
create function pg_temp.catalog_counts() returns int[] language sql as $$
  select array[
    (select count(*)::int from public.agent_types where organization_id is null),
    (select count(*)::int from public.agent_types where organization_id = 'b0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.agents where organization_id = 'a0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.agents where organization_id = 'b0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.skills where organization_id is null),
    (select count(*)::int from public.skills where organization_id = 'b0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.agent_skills where organization_id = 'a0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.agent_skills where organization_id = 'b0000000-0000-4000-8000-000000000000')
  ];
$$;

-- ===========================================================================
-- 1. Los 4 de serie y sus agentes
-- ===========================================================================
select is(
  (select array_agg(key || ':' || color order by key) from public.agent_types where origin = 'builtin'),
  array['admin:agent-admin', 'customer:agent-customer', 'reception:agent-reception', 'sales:agent-sales'],
  'los 4 tipos de serie, con su color (ADR 0023)'
);
select ok(
  (select bool_and(organization_id is null and description <> '') from public.agent_types where origin = 'builtin'),
  'los de serie son de la plataforma y tienen descripción'
);
select is(
  (select array_agg(t.key || ':' || a.status order by t.key)
   from public.agents a join public.agent_types t on t.id = a.agent_type_id
   where a.organization_id = :org_a),
  array['admin:draft', 'customer:draft', 'reception:draft', 'sales:draft'],
  'una organización nueva nace con sus 4 agentes de serie, en borrador'
);
select is(
  (select count(*)::int from public.organizations o
   where (select count(*) from public.agents a where a.organization_id = o.id) <> 4),
  0,
  'todas las organizaciones tienen sus 4 agentes (también las que ya existían)'
);

-- Datos de prueba de la plataforma: un tipo propio de B, una skill publicada de
-- la plataforma, una compuesta de B y una restringida a Recepción.
insert into public.agent_types (id, organization_id, origin, key, name, color)
values (:custom_b, :org_b, 'custom', 'events', 'Eventos', 'agent-sales');
insert into public.agents (organization_id, agent_type_id) values (:org_b, :custom_b);
insert into public.skills (id, organization_id, key, kind, name, effect_class, default_autonomy, max_autonomy, status) values
  (:skill_pub, null, 'check_availability', 'code', 'Consultar disponibilidad', 'read', 'execute', 'autonomous', 'published');
insert into public.skills (id, organization_id, key, kind, name, definition, effect_class, default_autonomy, max_autonomy) values
  (:skill_b, :org_b, 'event_quote', 'composed', 'Presupuesto de evento', '{"steps": []}', 'internal_write', 'draft', 'execute');
insert into public.skills (id, organization_id, key, kind, name, effect_class, default_autonomy, max_autonomy, restricted_to_agent_types, status) values
  (:skill_rest, null, 'move_appointment', 'code', 'Mover una cita', 'internal_write', 'draft', 'execute', array['reception'], 'published');
insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
select a.id, :skill_pub, a.organization_id, 'execute'
from public.agents a join public.agent_types t on t.id = a.agent_type_id
where a.organization_id in (:org_a, :org_b) and t.key = 'customer';
insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
select a.id, :skill_b, :org_b, 'draft' from public.agents a where a.agent_type_id = :custom_b;

-- ===========================================================================
-- 2. Aislamiento: cada organización ve el catálogo de la plataforma y lo suyo
--    [tipos plataforma, tipos de B, agentes A, agentes B, skills plataforma,
--     skills de B, skills de agentes de A, skills de agentes de B]
--    Desde 20261108090000 (paso 4e-1) la plataforma trae 7 skills de código y
--    cada organización nace con 8 en sus agentes (Recepción 7, Atención al
--    cliente 1). Skills de la plataforma: 7 + las 2 de prueba; de los agentes
--    de A: 8 + 1; de los de B: 8 + 2.
-- ===========================================================================
select pg_temp.login(:a_staff1);
select is(pg_temp.catalog_counts(), array[4, 0, 4, 0, 9, 0, 9, 0], 'staff de A: ve la plataforma y lo de A, nada de B');

reset role;
select pg_temp.login_mfa(:b_admin);
select is(pg_temp.catalog_counts(), array[4, 1, 0, 5, 9, 1, 0, 10], 'org_admin de B: ve la plataforma y lo de B (con su agente propio), nada de A');

reset role;
select pg_temp.login(:outsider);
select is(pg_temp.catalog_counts(), array[4, 0, 0, 0, 9, 0, 0, 0], 'sin organización: solo el catálogo de la plataforma');

-- Equipo interno con permiso de soporte vigente (staff_login lo concede para
-- todas las organizaciones): lo ve todo, para dar soporte.
reset role;
select pg_temp.staff_login(:p_operator);
select is(pg_temp.catalog_counts(), array[4, 1, 4, 5, 9, 1, 9, 10], 'equipo interno con permiso de soporte: ve el catálogo de A y de B');

-- Una organización suspendida no ve sus agentes (has_org_role exige que esté activa).
reset role;
update public.organizations set status = 'suspended' where id = :org_a;
select pg_temp.login(:a_staff1);
select is(pg_temp.catalog_counts(), array[4, 0, 0, 0, 9, 0, 0, 0], 'organización suspendida: sus miembros no ven sus agentes');
reset role;
update public.organizations set status = 'active' where id = :org_a;

-- Sesión cerrada: nada.
select pg_temp.login(:a_staff1) as staff1_session \gset
reset role;
delete from auth.sessions where id = :'staff1_session';
select pg_temp.act_as(:a_staff1, :'staff1_session');
select is(pg_temp.catalog_counts(), array[0, 0, 0, 0, 0, 0, 0, 0], 'sesión cerrada: no ve nada del catálogo');

-- ===========================================================================
-- 3. Solo lectura desde la app, también para un org_admin con MFA
-- ===========================================================================
reset role;
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$insert into public.agent_types (organization_id, origin, key, name, color) values (%L, 'custom', 'mine', 'Mío', 'agent-sales')$$, :org_a),
  '42501', null, 'org_admin: no puede crear tipos de agente (llega en la fase 3)'
);
select throws_ok($$update public.agent_types set name = 'Cambiado'$$, '42501', null, 'org_admin: no puede cambiar el catálogo de tipos');
select throws_ok($$delete from public.agent_types$$, '42501', null, 'org_admin: no puede borrar tipos');
select throws_ok(
  format($$insert into public.agents (organization_id, agent_type_id) values (%L, '0a9e0000-0000-4000-8000-000000000001')$$, :org_a),
  '42501', null, 'org_admin: no puede crear agentes'
);
select throws_ok($$update public.agents set status = 'live'$$, '42501', null, 'org_admin: no puede cambiar el estado de un agente (llega con su pantalla)');
select throws_ok($$delete from public.agents$$, '42501', null, 'org_admin: no puede borrar agentes');
select throws_ok(
  $$insert into public.skills (key, kind, name, effect_class, default_autonomy, max_autonomy) values ('x', 'code', 'X', 'read', 'execute', 'execute')$$,
  '42501', null, 'org_admin: no puede crear skills'
);
select throws_ok($$update public.skills set max_autonomy = 'autonomous'$$, '42501', null, 'org_admin: no puede subir la autonomía de una skill');
select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
           select id, %L, organization_id, 'execute' from public.agents limit 1$$, :skill_pub),
  '42501', null, 'org_admin: no puede dar skills a un agente (llega en la fase 1–2)'
);
select throws_ok($$update public.agent_skills set autonomy_level = 'autonomous'$$, '42501', null, 'org_admin: no puede cambiar la autonomía de una skill de su agente');
select throws_ok($$delete from public.agent_skills$$, '42501', null, 'org_admin: no puede quitar skills');

-- ===========================================================================
-- 4. Integridad (actúa también para la plataforma)
-- ===========================================================================
reset role;
select throws_ok(
  format('insert into public.agents (organization_id, agent_type_id) values (%L, %L)', :org_a, :custom_b),
  '23503', null, 'plataforma: un agente de A no puede usar un tipo propio de B'
);
select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
           select a.id, %L, %L, 'draft' from public.agents a join public.agent_types t on t.id = a.agent_type_id
           where a.organization_id = %L and t.key = 'sales'$$, :skill_b, :org_a, :org_a),
  '23503', null, 'plataforma: un agente de A no puede tener una skill propia de B'
);
select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
           select a.id, %L, %L, 'draft' from public.agents a join public.agent_types t on t.id = a.agent_type_id
           where a.organization_id = %L and t.key = 'sales'$$, :skill_pub, :org_b, :org_a),
  '23503', null, 'plataforma: el organization_id de agent_skills tiene que ser el del agente'
);
select throws_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
           select a.id, %L, %L, 'draft' from public.agents a join public.agent_types t on t.id = a.agent_type_id
           where a.organization_id = %L and t.key = 'sales'$$, :skill_rest, :org_a, :org_a),
  '23514', null, 'plataforma: una skill restringida a Recepción no se da a Comercial'
);
select lives_ok(
  format($$insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
           select a.id, %L, %L, 'draft' from public.agents a join public.agent_types t on t.id = a.agent_type_id
           where a.organization_id = %L and t.key = 'reception'$$, :skill_rest, :org_a, :org_a),
  'plataforma: la skill restringida sí se da a Recepción'
);
select throws_ok(
  format($$update public.agent_skills set autonomy_level = 'autonomous' where skill_id = %L and organization_id = %L$$, :skill_rest, :org_a),
  '23514', null, 'plataforma: la autonomía de un agente no supera el máximo de la skill'
);
select throws_ok(
  $$insert into public.skills (key, kind, name, effect_class, default_autonomy, max_autonomy) values ('pay', 'code', 'Cobrar', 'financial', 'draft', 'execute')$$,
  '23514', null, 'plataforma: una skill financiera no pasa del techo draft (§5.6)'
);
select throws_ok(
  $$insert into public.skills (key, kind, name, effect_class, default_autonomy, max_autonomy) values ('remind', 'code', 'Recordar', 'external_outreach', 'draft', 'autonomous')$$,
  '23514', null, 'plataforma: un contacto saliente no pasa del techo execute (§5.6)'
);
select throws_ok(
  $$insert into public.skills (key, kind, name, effect_class, default_autonomy, max_autonomy) values ('look', 'code', 'Mirar', 'read', 'autonomous', 'execute')$$,
  '23514', null, 'plataforma: la autonomía por defecto no supera la máxima'
);
select throws_ok(
  format($$insert into public.skills (organization_id, key, kind, name, effect_class, default_autonomy, max_autonomy) values (%L, 'own_code', 'code', 'Código propio', 'read', 'execute', 'execute')$$, :org_a),
  '23514', null, 'plataforma: una skill de código siempre es de la plataforma'
);
select throws_ok(
  $$insert into public.skills (key, kind, name, effect_class, default_autonomy, max_autonomy) values ('naked', 'composed', 'Sin definición', 'read', 'execute', 'execute')$$,
  '23514', null, 'plataforma: una skill compuesta lleva su definición'
);
select throws_ok(
  format($$insert into public.agent_types (organization_id, origin, key, name, color) values (%L, 'builtin', 'fake', 'Falso', 'agent-sales')$$, :org_a),
  '23514', null, 'plataforma: un tipo de una organización solo puede ser propio'
);
select throws_ok(
  $$insert into public.agent_types (origin, key, name, color) values ('builtin', 'reception', 'Otra recepción', 'agent-reception')$$,
  '23505', null, 'plataforma: la clave de un tipo de serie no se repite'
);
select throws_ok(
  format('insert into public.agents (organization_id, agent_type_id) values (%L, %L)', :org_a, '0a9e0000-0000-4000-8000-000000000001'),
  '23505', null, 'plataforma: una organización tiene un solo agente de cada tipo'
);

-- ===========================================================================
-- 5. Alta y baja de organizaciones (plataforma)
-- ===========================================================================
insert into public.organizations (id, name) values ('c0000000-0000-4000-8000-000000000000', 'Org C');
select is(
  (select count(*)::int from public.agents where organization_id = 'c0000000-0000-4000-8000-000000000000' and status = 'draft'),
  4,
  'alta de organización: nace con sus 4 agentes en borrador'
);
delete from public.organizations where id = :org_b;
select is(
  array[
    (select count(*)::int from public.agents where organization_id = :org_b),
    (select count(*)::int from public.agent_types where organization_id = :org_b),
    (select count(*)::int from public.skills where organization_id = :org_b),
    (select count(*)::int from public.agent_skills where organization_id = :org_b)
  ],
  array[0, 0, 0, 0],
  'baja de organización (RGPD): se borran sus agentes, tipos, skills y asignaciones'
);
select is(
  (select count(*)::int from public.skills where id = :skill_pub),
  1,
  'baja de organización: las skills de la plataforma siguen'
);

select * from finish();
rollback;
