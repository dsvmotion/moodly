-- Vuelta atrás de 20261113110000_worker_delivery_status.sql: el worker deja de
-- aplicar los avisos de estado. Antes, desplegar un worker sin esa migración
-- (si no, cada aviso falla por permisos y el proveedor lo repite).

revoke execute on function private.next_delivery_status(text, text) from moodly_worker;
revoke update (status, delivery_error) on public.messages from moodly_worker;
drop trigger guard_worker_message_status on public.messages;
drop function private.guard_worker_message_status();
