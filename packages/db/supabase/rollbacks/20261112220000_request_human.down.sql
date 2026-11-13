-- Vuelta atrás de 20261112220000_request_human.sql. Antes, desplegar un worker
-- sin request_human en codeSkills (o dejarlo: sin la fila, no se ofrece).
delete from public.agent_skills where skill_id in
  (select id from public.skills where organization_id is null and key = 'request_human');
delete from private.default_agent_skills where skill_key = 'request_human';
delete from public.skills where organization_id is null and key = 'request_human';
