-- Vuelta atrás de 20261112080000_inbound_events_attempts.sql: fuera el contador
-- de intentos de los eventos de entrada, su guarda y su permiso de columna.
-- El worker de esa versión escribe attempts: se vuelve atrás junto con él.

revoke update (attempts) on public.inbound_events from service_role;
drop trigger guard_inbound_event_attempts on public.inbound_events;
drop function private.guard_inbound_event_attempts();
alter table public.inbound_events drop column attempts;
