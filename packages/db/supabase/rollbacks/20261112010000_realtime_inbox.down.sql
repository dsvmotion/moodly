-- Vuelta atrás de 20261112010000_realtime_inbox.sql: la bandeja deja de
-- recibir avisos por Realtime (vuelve a pedir la página cada 5 s).

drop policy inbox_read on realtime.messages;
drop trigger broadcast_inbox_change on public.conversations;
drop trigger broadcast_inbox_change on public.messages;
drop function private.broadcast_inbox_change();
drop function private.can_read_inbox_topic(text);
drop function private.inbox_topic(uuid, uuid);
