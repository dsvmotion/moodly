-- PL-T1, paso 3 (ADR 0049): el contexto del turno de un agente, para el rol
-- moodly_worker, sin pasarle la organización.
--
-- public.agent_turn_context(p_organization_id, p_agent_id) (20261031150000) la
-- llama el worker por PostgREST con la clave secreta, y la organización va de
-- parámetro. Aquí, private.worker_agent_turn_context(p_agent_id) hace la misma
-- lectura con la organización de la transacción (private.worker_organization_id(),
-- que fija forOrganization con set_config): quien llama no puede elegir otra.
-- Así el worker la lee dentro de su transacción bajo RLS (converse.ts, prepare).
--
-- Es security definer porque lee el catálogo de la plataforma (agent_types y
-- skills con organization_id null), que las políticas de moodly_worker no
-- dejan ver (solo las filas de su organización, 00_rls_enabled). Solo lee; cada
-- fila de tenant que toca (agents, agent_skills, organizations) va filtrada por
-- esa organización, igual que en la función de 20261031150000. Sin organización
-- en la transacción devuelve null. Solo la puede ejecutar moodly_worker.
-- Tests en 45_worker_agent_turn_context.
--
-- public.agent_turn_context se queda mientras la usen los demás módulos del
-- worker (recordatorios, lista de espera, skills programadas), que se mudan con
-- su paso.
--
-- También: moodly_worker lee los resúmenes de las conversaciones (PL-T3,
-- 20261112050000), que el turno carga antes de la historia. La política
-- conversation_summaries_worker ya existe (de esa migración); faltaba el
-- privilegio. Solo lectura: el resumen lo sigue guardando la plataforma.
--
-- Vuelta atrás: rollbacks/20261112110000_worker_agent_turn_context.down.sql.

create function private.worker_agent_turn_context(p_agent_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'agent', jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'display_name', a.display_name,
      'type_key', t.key,
      'type_name', t.name
    ),
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', s.key,
        'version', s.version,
        'kind', s.kind,
        'effect_class', s.effect_class,
        'enabled', g.enabled,
        'autonomy_level', g.autonomy_level
      ) order by s.key)
      from public.agent_skills g
      join public.skills s on s.id = g.skill_id
      where g.agent_id = a.id and g.organization_id = a.organization_id
    ), '[]'::jsonb)
  )
  from public.agents a
  join public.agent_types t on t.id = a.agent_type_id
  join public.organizations o on o.id = a.organization_id
  where a.id = p_agent_id
    and a.organization_id = (select private.worker_organization_id());
$$;
revoke all on function private.worker_agent_turn_context(uuid) from public, anon, authenticated, service_role;
grant execute on function private.worker_agent_turn_context(uuid) to moodly_worker;

grant select on public.conversation_summaries to moodly_worker;
