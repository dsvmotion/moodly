-- Paso B20-2: buscar en el conocimiento del negocio (MANUAL §6.1, ADR 0037 y
-- ADR 0048).
--
-- La skill search_knowledge en el catálogo de la plataforma: el agente busca en
-- las fuentes del negocio (preguntas frecuentes, precios, políticas) antes de
-- contestar una pregunta sobre él, y contesta solo con lo que encuentra.
-- Lectura con autonomía autonomous (no cambia nada ni sale nada hacia nadie),
-- para cualquier tipo de agente. Atención al cliente y Recepción la traen de
-- serie, también los agentes que ya existen.
--
-- La búsqueda es search_knowledge (20261031120000), con la organización y el
-- local del run: el modelo solo propone la consulta.
--
-- No cambia ninguna tabla. Funciones security definer: ninguna nueva.
-- attach_default_skills_to, de 20261031150000, da la skill nueva a los agentes
-- que ya existen; no cambia.
--
-- Vuelta atrás:
--   delete from public.agent_skills where skill_id in
--     (select id from public.skills where organization_id is null and key = 'search_knowledge');
--   delete from private.default_agent_skills where skill_key = 'search_knowledge';
--   delete from public.skills where organization_id is null and key = 'search_knowledge';

insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'search_knowledge', 1, 'code', 'Search business knowledge',
   'Searches what the business has written (FAQs, prices, policies) to answer a question about it, only with what it finds.',
   'read', 'autonomous', 'autonomous', '{}', 'published');

insert into private.default_agent_skills (agent_type_key, skill_key)
values ('customer', 'search_knowledge'), ('reception', 'search_knowledge');

-- Los agentes de Atención al cliente y de Recepción que ya existen.
select private.attach_default_skills_to(id) from public.agents;
