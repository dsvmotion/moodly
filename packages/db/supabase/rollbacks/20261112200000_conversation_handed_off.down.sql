-- Vuelta atrás de 20261112200000_conversation_handed_off.sql. Antes, desplegar
-- un worker sin el consumidor notify.handoff_email (o dejarlo: sin eventos
-- nuevos, no envía nada). Los conversation.handed_off ya escritos se quedan:
-- sin consumidor, el worker solo los registra.
drop function public.handoff_notification(uuid, uuid);
drop trigger emit_conversation_handed_off on public.conversations;
drop function private.emit_conversation_handed_off();
