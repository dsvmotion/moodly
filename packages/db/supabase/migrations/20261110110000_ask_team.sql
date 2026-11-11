-- Paso B20-4b: preguntar al equipo en vez de inventar (MANUAL §5.9).
--
-- La skill ask_team en el catálogo de la plataforma: cuando search_knowledge
-- no trae lo que pregunta el cliente, el agente deja la pregunta al equipo
-- (knowledge_requests, 20261110100000) y le dice al cliente que una persona le
-- contestará por esa conversación. Escritura interna con autonomía execute de
-- serie (no compromete nada ni sale hacia el cliente), para cualquier tipo de
-- agente. Atención al cliente y Recepción la traen de serie, también los
-- agentes que ya existen.
--
-- La organización, el local, el run y la conversación los pone el runtime: el
-- modelo solo escribe la pregunta.
--
-- No cambia ninguna tabla. Funciones security definer: ninguna nueva.
-- attach_default_skills_to, de 20261031150000, da la skill nueva a los agentes
-- que ya existen; no cambia.
--
-- Vuelta atrás:
--   delete from public.agent_skills where skill_id in
--     (select id from public.skills where organization_id is null and key = 'ask_team');
--   delete from private.default_agent_skills where skill_key = 'ask_team';
--   delete from public.skills where organization_id is null and key = 'ask_team';

insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'ask_team', 1, 'code', 'Ask the team',
   'Asks the business team a question the agent cannot answer with the business knowledge; a person replies to the customer and the answer becomes knowledge.',
   'internal_write', 'execute', 'autonomous', '{}', 'published');

insert into private.default_agent_skills (agent_type_key, skill_key)
values ('customer', 'ask_team'), ('reception', 'ask_team');

-- Los agentes de Atención al cliente y de Recepción que ya existen.
select private.attach_default_skills_to(id) from public.agents;
