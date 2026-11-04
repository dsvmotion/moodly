-- Paso 4e-0: los eventos de las citas (MANUAL §5.8, ADR 0009).
--
-- Cada cambio que importa de una cita emite su evento de dominio en la misma
-- transacción, con la organización y el local de la fila (control 3.7) y solo
-- ids y horas en el payload, sin datos personales:
-- - appointment.created: una cita reservada nueva.
-- - appointment.rescheduled: una cita viva cambia de hora o de recurso.
-- - appointment.cancelled: una cita viva se cancela; el hueco queda libre.
--
-- Son la base del recordatorio de 24 h (4e) y de la lista de espera (4f), y del
-- ejemplo de coordinación entre agentes de §5.8 (cita → recurso y recordatorio).
-- Completar o marcar como perdida una cita, o cambiar su sincronización, no
-- emite nada todavía: nadie lo consume.
--
-- Función security definer: private.emit_appointment_event escribe en
-- domain_events, como emit_message_received. Quien reserva, mueve o cancela (el
-- worker, y más adelante la app) no tiene ni debe tener privilegios sobre
-- domain_events. Escribe solo el evento de esa cita, con su organización y su
-- local. Es un trigger y nadie la puede llamar: tests en negativo en
-- 30_appointment_events.
--
-- Vuelta atrás:
--   drop trigger emit_appointment_event on public.appointments;
--   drop function private.emit_appointment_event();

create function private.emit_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type    text;
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'booked' then
      return null;
    end if;
    v_type := 'appointment.created';
    v_payload := jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at);
  elsif old.status = 'booked' and new.status = 'cancelled' then
    v_type := 'appointment.cancelled';
    v_payload := jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at);
  elsif old.status = 'booked' and new.status = 'booked'
        and (new.starts_at, new.resource_id) is distinct from (old.starts_at, old.resource_id) then
    v_type := 'appointment.rescheduled';
    v_payload := jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at, 'previous_starts_at', old.starts_at);
  else
    return null;
  end if;

  insert into public.domain_events (organization_id, location_id, type, payload)
  values (new.organization_id, new.location_id, v_type, v_payload);
  return null;
end;
$$;

revoke all on function private.emit_appointment_event() from public, anon, authenticated, service_role;

create trigger emit_appointment_event
  after insert or update on public.appointments
  for each row execute function private.emit_appointment_event();
