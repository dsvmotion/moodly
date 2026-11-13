-- O-01 (ADR 0052 §2) sobre PL-T1 (ADR 0049): la entrada de canales escribe como
-- moodly_worker, por SQL bajo RLS, en vez de con la clave secreta por PostgREST
-- (apps/worker/src/ingress/receive.ts e ingest.ts).
--
-- La resolución de la cuenta del canal (channelAccounts.resolve, la segunda
-- lectura entre organizaciones) sigue con la clave secreta: es la que dice de
-- qué organización es el evento, antes de que haya organización que fijar.
-- Todo lo demás va dentro de forOrganization(esa organización).transaction.
--
-- moodly_worker no es «la plataforma» (V1, 2026-11-12): privilegios mínimos, de
-- columna, y las guardas también para él.
-- - inbound_events: la política inbound_events_worker (no estaba en la lista
--   de 20261112040500), SELECT, INSERT de lo que llega (organización, cuenta, id
--   del evento y payload) y UPDATE solo de status, conversation_id, message_id,
--   error_code y attempts. Las transiciones las vigilan guard_inbound_event (lo
--   que llegó no cambia; processed e ignored son finales; nada vuelve a
--   received) y guard_inbound_event_attempts (attempts solo crece), que actúan
--   para todos los roles, este incluido: son justo las que usa la entrada.
-- - contacts: INSERT de organization_id y display_name, y SELECT solo de id
--   (para el RETURNING). Nunca UPDATE ni DELETE: si dos mensajes del mismo
--   cliente crean el contacto a la vez, el que pierde deshace su transacción en
--   vez de borrar.
-- - contact_identities: SELECT de contact_id, kind y external_id, e INSERT de
--   esas columnas y la organización. Nunca UPDATE ni DELETE.
-- - conversations: INSERT de organization_id, location_id, contact_id,
--   channel_account_id, channel y agent_id. mode y assigned_user_id quedan fuera:
--   una conversación que crea el worker nace con el agente y sin persona
--   asignada (los valores por defecto). validate_conversation (la cuenta, el
--   contacto y el agente de la misma organización, y el canal de la cuenta)
--   actúa para todos los roles. Ya tenía SELECT y UPDATE (mode).
-- - messages: INSERT además de attachments y external_message_id (lo que trae
--   el mensaje del cliente). guard_worker_message (20261112140000) pasa a admitir
--   dos formas y nada más: la respuesta del agente (author agent, direction out,
--   sin external_message_id) y el mensaje del cliente que entra por un canal
--   (author contact, direction in, status received, con su external_message_id,
--   la clave con la que la entrada no lo duplica, y sin idempotency_key). Nunca
--   como una persona del equipo (author user, author_user_id), ni un mensaje del
--   cliente sin la clave del proveedor (no viene de la entrada).
-- - domain_events: SELECT de id, type y payload (la entrada busca el
--   message.received de su mensaje para encolar el turno ya). Nunca escribe:
--   lo emite el trigger emit_message_received, que es de la plataforma.
-- service_role queda igual.
--
-- Sin funciones security definer nuevas.
-- Tests en 51_worker_ingress.
-- Vuelta atrás: rollbacks/20261112230000_worker_ingress.down.sql.

create policy inbound_events_worker on public.inbound_events for all to moodly_worker
  using (organization_id = (select private.worker_organization_id()))
  with check (organization_id = (select private.worker_organization_id()));

grant select on public.inbound_events to moodly_worker;
grant insert (organization_id, channel_account_id, provider_event_id, payload) on public.inbound_events to moodly_worker;
grant update (status, conversation_id, message_id, error_code, attempts) on public.inbound_events to moodly_worker;

grant select (id) on public.contacts to moodly_worker;
grant insert (organization_id, display_name) on public.contacts to moodly_worker;

grant select (contact_id, kind, external_id) on public.contact_identities to moodly_worker;
grant insert (organization_id, contact_id, kind, external_id) on public.contact_identities to moodly_worker;

grant insert (organization_id, location_id, contact_id, channel_account_id, channel, agent_id) on public.conversations to moodly_worker;

grant insert (attachments, external_message_id) on public.messages to moodly_worker;

grant select (id, type, payload) on public.domain_events to moodly_worker;

create or replace function private.guard_worker_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' and new.author_user_id is null
     and (
       -- La respuesta del agente.
       (new.author = 'agent' and new.direction = 'out' and new.external_message_id is null)
       -- El mensaje del cliente que entra por un canal (la entrada, O-01).
       or (new.author = 'contact' and new.direction = 'in' and new.status = 'received'
           and new.external_message_id is not null and new.idempotency_key is null)
     ) then
    return new;
  end if;
  if current_user = 'moodly_worker' then
    raise exception 'el worker solo escribe la respuesta del agente o el mensaje del cliente que entra por un canal' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_message() from public;
