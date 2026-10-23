-- Configuración de agentes con herencia y bloqueos (20261023170000_agent_config,
-- MANUAL §4.3): resolución organización → región → local, bloqueos al guardar
-- y al resolver, snapshots inmutables con hash y quién ve cada nivel.
begin;
\ir _fixtures/tenants.psql
select plan(35);

-- El agente de Recepción de A (lo crea el alta de la organización, D1).
select a.id as agent_a from public.agents a
join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_a and t.key = 'reception' \gset
select a.id as agent_b from public.agents a
join public.agent_types t on t.id = a.agent_type_id
where a.organization_id = :org_b and t.key = 'reception' \gset

-- Overrides de la plataforma para el agente de A:
--   organización: tono formal y bienvenida bloqueados;
--   región A-Norte: horario de apertura bloqueado y otra despedida;
--   local A1 (A-Norte): un retardo; local A3 (A-Sur): otro horario.
insert into public.config_overrides (organization_id, agent_id, level, level_id, "values", locked_keys) values
  (:org_a, :'agent_a', 'organization', :org_a,
   '{"tone": "formal", "messages": {"welcome": "Hola", "bye": "Adiós"}, "hours": {"open": "09:00"}}',
   array['tone', 'messages.welcome']),
  (:org_a, :'agent_a', 'region', :region_a_n,
   '{"hours": {"open": "10:00"}, "messages": {"bye": "Hasta luego"}}', array['hours.open']),
  (:org_a, :'agent_a', 'location', :loc_a1, '{"greeting_delay": 2}', '{}'),
  (:org_a, :'agent_a', 'location', :loc_a3, '{"hours": {"open": "08:00"}}', '{}');

-- ===========================================================================
-- 1. Resolución
-- ===========================================================================
select is(
  private.resolve_agent_config(:'agent_a'),
  '{"tone": "formal", "messages": {"welcome": "Hola", "bye": "Adiós"}, "hours": {"open": "09:00"}}'::jsonb,
  'sin local: la configuración de la organización'
);
select is(
  private.resolve_agent_config(:'agent_a', :loc_a1),
  '{"tone": "formal", "messages": {"welcome": "Hola", "bye": "Hasta luego"}, "hours": {"open": "10:00"}, "greeting_delay": 2}'::jsonb,
  'local A1: organización ⊕ región A-Norte ⊕ local, con merge profundo'
);
select is(
  private.resolve_agent_config(:'agent_a', :loc_a2),
  '{"tone": "formal", "messages": {"welcome": "Hola", "bye": "Hasta luego"}, "hours": {"open": "10:00"}}'::jsonb,
  'local A2 sin override propio: hereda de su región'
);
select is(
  private.resolve_agent_config(:'agent_a', :loc_a3),
  '{"tone": "formal", "messages": {"welcome": "Hola", "bye": "Adiós"}, "hours": {"open": "08:00"}}'::jsonb,
  'local A3 (otra región, sin bloqueo de horario): su propio horario'
);
select is(private.resolve_agent_config(:'agent_b'), '{}'::jsonb, 'agente sin overrides: la base vacía');
select throws_ok(
  format('select private.resolve_agent_config(%L, %L)', :'agent_a', :loc_b1),
  '23503', null, 'no se resuelve con un local de otra organización'
);

-- ===========================================================================
-- 2. Bloqueos al guardar (también para la plataforma)
-- ===========================================================================
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id, "values")
           values (%L, %L, 'region', %L, '{"tone": "casual"}')$$, :org_a, :'agent_a', :region_a_s),
  '23514', 'la clave tone está bloqueada en un nivel superior',
  'una región no cambia una clave bloqueada por la organización'
);
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id, "values")
           values (%L, %L, 'location', %L, '{"hours": {"open": "07:00"}}')$$, :org_a, :'agent_a', :loc_a2),
  '23514', 'la clave hours.open está bloqueada en un nivel superior',
  'un local no cambia una clave bloqueada por su región'
);
select throws_ok(
  format($$update public.config_overrides set "values" = '{"messages": "texto"}' where level_id = %L$$, :loc_a1),
  '23514', null,
  'un local no reemplaza un objeto que contiene una clave bloqueada (messages ⊃ messages.welcome)'
);
select throws_ok(
  format($$update public.config_overrides set "values" = '{"messages": {"welcome": {"es": "Buenas"}}}' where level_id = %L$$, :loc_a1),
  '23514', null,
  'un local no cambia nada dentro de una clave bloqueada'
);
select lives_ok(
  format($$update public.config_overrides set "values" = '{"greeting_delay": 3, "messages": {"bye": "Chao"}}' where level_id = %L$$, :loc_a1),
  'un local sí cambia lo que no está bloqueado, aunque esté junto a una clave bloqueada'
);
select throws_ok(
  format($$update public.config_overrides set locked_keys = array['hours.open'] where level = 'organization' and agent_id = %L$$, :'agent_a'),
  '23514', 'no se puede bloquear: un nivel inferior ya cambia hours.open',
  'la organización no bloquea una clave que ya cambia una región o un local'
);
select throws_ok(
  format($$update public.config_overrides set locked_keys = array['hours.open', 'greeting_delay'] where level = 'region' and level_id = %L$$, :region_a_n),
  '23514', 'no se puede bloquear: un nivel inferior ya cambia greeting_delay',
  'una región no bloquea una clave que ya cambia uno de sus locales'
);
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id, locked_keys)
           values (%L, %L, 'region', %L, array['Tono!'])$$, :org_a, :'agent_a', :region_a_s),
  '23514', null, 'locked_keys solo admite rutas en minúscula con puntos'
);
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id)
           values (%L, %L, 'organization', %L)$$, :org_a, :'agent_b', :org_a),
  '23503', null, 'un override de A no puede ser de un agente de B'
);
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id)
           values (%L, %L, 'region', %L)$$, :org_a, :'agent_a', :region_b_c),
  '23503', null, 'un override de A no puede apuntar a una región de B'
);
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id)
           values (%L, %L, 'organization', %L)$$, :org_a, :'agent_a', :region_a_s),
  '23514', null, 'el nivel organización apunta a la propia organización'
);

-- ===========================================================================
-- 3. Defensa en profundidad: aunque un override incumpliera un bloqueo, la
--    resolución no lo aplica.
-- ===========================================================================
alter table public.config_overrides disable trigger validate_config_override;
update public.config_overrides set "values" = '{"tone": "casual", "messages": "pisado", "greeting_delay": 3}'
where level_id = :loc_a1;
alter table public.config_overrides enable trigger validate_config_override;
select is(
  private.resolve_agent_config(:'agent_a', :loc_a1),
  '{"tone": "formal", "messages": {"welcome": "Hola", "bye": "Hasta luego"}, "hours": {"open": "10:00"}, "greeting_delay": 3}'::jsonb,
  'un override que incumple los bloqueos no pisa tone ni messages al resolver'
);
update public.config_overrides set "values" = '{"greeting_delay": 2}' where level_id = :loc_a1;

-- ===========================================================================
-- 4. Snapshots
-- ===========================================================================
select private.snapshot_agent_config(:'agent_a', :loc_a1) as snap1 \gset
select is(
  (select resolved from public.config_snapshots where id = :'snap1'),
  private.resolve_agent_config(:'agent_a', :loc_a1),
  'el snapshot guarda la configuración resuelta'
);
select is(
  (select hash from public.config_snapshots where id = :'snap1'),
  encode(extensions.digest(private.resolve_agent_config(:'agent_a', :loc_a1)::text, 'sha256'), 'hex'),
  'con su sha256'
);
select is(private.snapshot_agent_config(:'agent_a', :loc_a1), :'snap1'::uuid, 'si nada cambia, se reutiliza el mismo snapshot');
update public.config_overrides set "values" = '{"greeting_delay": 5}' where level_id = :loc_a1;
select isnt(private.snapshot_agent_config(:'agent_a', :loc_a1), :'snap1'::uuid, 'si cambia la configuración, hay un snapshot nuevo');
select is(
  (select resolved ->> 'greeting_delay' from public.config_snapshots where id = :'snap1'),
  '2',
  'el snapshot anterior no cambia'
);
select throws_ok(
  format($$update public.config_snapshots set resolved = '{}' where id = %L$$, :'snap1'),
  '42501', 'un config_snapshot no se modifica', 'nadie modifica un snapshot, tampoco la plataforma'
);
select isnt(private.snapshot_agent_config(:'agent_a'), :'snap1'::uuid, 'el snapshot sin local es otro');

-- ===========================================================================
-- 5. Quién ve qué (solo lectura)
--    [override org A, región A-Norte, local A1, local A3, snapshots de A]
-- ===========================================================================
create function pg_temp.config_counts() returns int[] language sql as $$
  select array[
    (select count(*)::int from public.config_overrides where level = 'organization' and organization_id = 'a0000000-0000-4000-8000-000000000000'),
    (select count(*)::int from public.config_overrides where level = 'region' and level_id = 'a1000000-0000-4000-8000-000000000001'),
    (select count(*)::int from public.config_overrides where level = 'location' and level_id = 'a2000000-0000-4000-8000-000000000001'),
    (select count(*)::int from public.config_overrides where level = 'location' and level_id = 'a2000000-0000-4000-8000-000000000003'),
    (select count(*)::int from public.config_snapshots where organization_id = 'a0000000-0000-4000-8000-000000000000')
  ];
$$;

select pg_temp.login(:a_admin);
select is(pg_temp.config_counts(), array[1, 1, 1, 1, 3], 'org_admin de A: toda la configuración y los snapshots de A');
reset role;
select pg_temp.login(:a_loc1_mgr);
select is(pg_temp.config_counts(), array[1, 1, 1, 0, 3], 'manager del local A1: la organización, su región y su local; no A3');
reset role;
select pg_temp.login(:a_region_mgr);
select is(pg_temp.config_counts(), array[1, 1, 1, 0, 3], 'manager de A-Norte: la organización, su región y sus locales');
reset role;
select pg_temp.login_mfa(:b_admin);
select is(pg_temp.config_counts(), array[0, 0, 0, 0, 0], 'org_admin de B: nada de A');
reset role;
select pg_temp.staff_login(:p_operator);
select is(pg_temp.config_counts(), array[1, 1, 1, 1, 3], 'equipo interno con permiso de soporte: todo lo de A');

reset role;
select pg_temp.login_mfa(:a_admin);
select throws_ok(
  format($$insert into public.config_overrides (organization_id, agent_id, level, level_id) values (%L, %L, 'location', %L)$$, :org_a, :'agent_a', :loc_a2),
  '42501', null, 'org_admin: no puede crear overrides desde la app (llega con su pantalla)'
);
select throws_ok($$update public.config_overrides set "values" = '{}'$$, '42501', null, 'org_admin: no puede cambiar overrides');
select throws_ok($$delete from public.config_overrides$$, '42501', null, 'org_admin: no puede borrar overrides');
select throws_ok(
  format($$insert into public.config_snapshots (organization_id, agent_id, resolved, hash) values (%L, %L, '{}', repeat('0', 64))$$, :org_a, :'agent_a'),
  '42501', null, 'org_admin: no puede crear snapshots'
);
-- El mensaje importa: sin él, el 42501 podría venir del INSERT en
-- config_snapshots y no de que la función no se puede ejecutar.
select throws_ok(
  format('select private.snapshot_agent_config(%L)', :'agent_a'),
  '42501', 'permission denied for function snapshot_agent_config',
  'org_admin: no puede ejecutar la creación de snapshots (solo el worker)'
);

select * from finish();
rollback;
