-- Vuelta atrás de 20261023150000_agent_catalog.sql: fuera el catálogo de agentes
-- y skills (agent_types, agents, skills, agent_skills) y el alta automática de
-- los agentes de serie. Borra también los agentes de todas las organizaciones.

drop trigger create_builtin_agents on public.organizations;

drop table public.agent_skills;
drop table public.skills;
drop table public.agents;
drop table public.agent_types;

drop function private.create_builtin_agents();
drop function private.validate_agent_skill();
drop function private.validate_agent_type();
drop function private.effect_class_ceiling(text);
drop function private.autonomy_rank(text);
