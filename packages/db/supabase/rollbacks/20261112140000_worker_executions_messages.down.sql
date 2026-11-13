-- Vuelta atrás de 20261112140000_worker_executions_messages.sql. Antes,
-- desplegar un worker que escriba ejecuciones y mensajes por PostgREST.
revoke insert on public.messages from moodly_worker;
revoke update on public.conversations from moodly_worker;
revoke select on public.executions from moodly_worker;
drop trigger guard_worker_conversation on public.conversations;
drop function private.guard_worker_conversation();
revoke insert, update on public.executions from moodly_worker;
drop trigger guard_worker_message on public.messages;
drop function private.guard_worker_message();
drop trigger guard_worker_execution on public.executions;
drop function private.guard_worker_execution();
