-- Vuelta atrás de 20261112150000_worker_handoff_summary.sql. Antes, desplegar
-- un worker que guarde el resumen y haga el paso a una persona por PostgREST.
revoke insert, update on public.conversation_summaries from moodly_worker;
