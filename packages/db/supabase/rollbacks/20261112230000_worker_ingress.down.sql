-- Vuelta atrás de 20261112230000_worker_ingress.sql: la entrada de canales
-- vuelve a escribir con la clave secreta. Antes, desplegar un worker sin esa
-- migración (si no, la entrada se queda sin permisos).

revoke select (id, type, payload) on public.domain_events from moodly_worker;
revoke insert (attachments, external_message_id) on public.messages from moodly_worker;
revoke insert (organization_id, location_id, contact_id, channel_account_id, channel, agent_id) on public.conversations from moodly_worker;
revoke insert (organization_id, contact_id, kind, external_id) on public.contact_identities from moodly_worker;
revoke select (contact_id, kind, external_id) on public.contact_identities from moodly_worker;
revoke insert (organization_id, display_name) on public.contacts from moodly_worker;
revoke select (id) on public.contacts from moodly_worker;
revoke update (status, conversation_id, message_id, error_code, attempts) on public.inbound_events from moodly_worker;
revoke insert (organization_id, channel_account_id, provider_event_id, payload) on public.inbound_events from moodly_worker;
revoke select on public.inbound_events from moodly_worker;
drop policy inbound_events_worker on public.inbound_events;

-- guard_worker_message vuelve a la de 20261112140000: solo la respuesta del agente.
create or replace function private.guard_worker_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker'
     and (new.author is distinct from 'agent' or new.direction is distinct from 'out' or new.author_user_id is not null) then
    raise exception 'el worker solo escribe los mensajes del agente' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_message() from public;
