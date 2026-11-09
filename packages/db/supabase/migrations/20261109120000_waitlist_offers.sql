-- Paso 4f-2: ofrecer el hueco que se libera a la lista de espera (MANUAL §5.1,
-- decidido por producto el 2026-11-08).
--
-- La skill waitlist_offer en el catálogo de la plataforma: cuando se cancela
-- una cita, el worker ofrece el hueco al primero de la lista que encaje, por
-- la conversación en la que se apuntó, durante 30 minutos, y después al
-- siguiente. Clase external_outreach con autonomía execute (el techo de la
-- clase), solo de Recepción: es un aviso que pidió el propio cliente al
-- apuntarse y no espera a una persona. Recepción la trae de serie, también los
-- agentes que ya existen; quien no quiera ofertas, la desactiva. Como los
-- recordatorios, la lanza la plataforma: el modelo nunca la ve como
-- herramienta.
--
-- No cambia ninguna tabla: la oferta usa las columnas de waitlist_entries de
-- 20261109090000 y la escribe solo el worker (service_role).
--
-- Funciones security definer: ninguna nueva. attach_default_skills_to, de
-- 20261031150000, da la skill nueva a los agentes que ya existen; no cambia.
--
-- Vuelta atrás:
--   delete from public.agent_skills where skill_id in
--     (select id from public.skills where organization_id is null and key = 'waitlist_offer');
--   delete from private.default_agent_skills where skill_key = 'waitlist_offer';
--   delete from public.skills where organization_id is null and key = 'waitlist_offer';

insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'waitlist_offer', 1, 'code', 'Waitlist offers',
   'Offers a freed slot to the next person on the waitlist for 30 minutes, in the conversation where they joined it.',
   'external_outreach', 'execute', 'execute', '{reception}', 'published');

insert into private.default_agent_skills (agent_type_key, skill_key) values ('reception', 'waitlist_offer');

-- Los agentes de Recepción que ya existen.
select private.attach_default_skills_to(id) from public.agents;
