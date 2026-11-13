-- O-01: los avisos de estado de un canal (enviado, entregado, leído, fallido)
-- se aplican a los mensajes que salen (ADR 0052 §4). Los escribe la entrada de
-- canales del worker, como moodly_worker por SQL bajo RLS (ADR 0049), igual que
-- el resto de lo que entra.
--
-- - messages: UPDATE solo de status y delivery_error. Nunca del contenido, del
--   autor, del id del proveedor ni de nada más (privilegios por columna).
-- - guard_worker_message_status (solo para moodly_worker): solo cambia mensajes
--   que salen (direction 'out'). Un mensaje del cliente o uno que escribió el
--   equipo en un canal que no avisa no tiene estados de entrega que aplicar,
--   pero el aviso que llega es del proveedor: que nunca toque lo que entra.
-- - Las reglas del estado ya actuaban para todos los roles: guard_delivery_status
--   (20261112030000) hace que solo avance, que un fallo después de entregado no
--   cuente (ni que vuelva a pending), y deja la hora y el error como estaban si
--   el aviso no cambia nada.
-- - private.next_delivery_status: EXECUTE para moodly_worker. La llama
--   guard_delivery_status, que se ejecuta como quien escribe (como ya hacía
--   service_role). Es pura: no lee ni escribe nada.
-- - La política messages_worker (20261112040500) ya acota a su organización.
-- service_role queda igual.
--
-- Sin funciones security definer.
-- Tests en 53_worker_delivery_status (y el privilegio exacto en 48).
-- Vuelta atrás: rollbacks/20261113110000_worker_delivery_status.down.sql.

create function private.guard_worker_message_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' then
    if old.direction is distinct from 'out' then
      raise exception 'el worker solo aplica estados de entrega a lo que sale' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_message_status() from public;
create trigger guard_worker_message_status before update on public.messages
  for each row execute function private.guard_worker_message_status();

grant update (status, delivery_error) on public.messages to moodly_worker;
grant execute on function private.next_delivery_status(text, text) to moodly_worker;
