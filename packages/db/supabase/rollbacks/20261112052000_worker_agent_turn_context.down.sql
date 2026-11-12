-- Vuelta atrás de 20261112052000_worker_agent_turn_context.sql. El worker
-- vuelve a leer el contexto por public.agent_turn_context (PostgREST): antes,
-- desplegar la versión del worker que la usa.
drop function private.worker_agent_turn_context(uuid);
