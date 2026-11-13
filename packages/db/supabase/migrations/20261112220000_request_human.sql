-- CU3 (paso D): pasar la conversación a una persona porque lo pide el cliente o
-- porque lo que pide no es del ámbito del agente.
--
-- La skill request_human en el catálogo de la plataforma. El modelo solo elige
-- el motivo (customer_asked u out_of_scope); la conversación, el local y la
-- organización son los del run. Si se ejecuta, el turno acaba en manos de una
-- persona y el worker pasa la conversación a 'human', como en los demás pasos:
-- de ahí salen el evento conversation.handed_off, el aviso en la bandeja y el
-- email al equipo (20261112200000).
--
-- internal_write y autónoma: no sale nada hacia nadie y no tiene sentido pedir
-- aprobación para pedir una persona. Para cualquier tipo de agente; Atención al
-- cliente y Recepción la traen de serie, también los agentes que ya existen.
--
-- No cambia ninguna tabla. Funciones security definer: ninguna nueva.
-- attach_default_skills_to, de 20261031150000, da la skill nueva a los agentes
-- que ya existen; no cambia.
--
-- Vuelta atrás: rollbacks/20261112220000_request_human.down.sql.

insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'request_human', 1, 'code', 'Hand over to a person',
   'Hands the conversation to a person from the team when the customer asks for one or asks for something outside what the agent can do.',
   'internal_write', 'autonomous', 'autonomous', '{}', 'published');

insert into private.default_agent_skills (agent_type_key, skill_key)
values ('customer', 'request_human'), ('reception', 'request_human');

-- Los agentes de Atención al cliente y de Recepción que ya existen.
select private.attach_default_skills_to(id) from public.agents;
