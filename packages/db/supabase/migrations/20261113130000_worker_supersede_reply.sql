-- O-01, gate M1: un mensaje del cliente recibe una sola respuesta, aunque llegue
-- otro a mitad del turno, y lo que no se sabe si llegó guarda su porqué.
--
-- 1. delivery_error de un envío «unknown» (nota de V10 sobre #294): el worker
--    apunta el código (timeout, http_502…) sin cambiar el estado.
--    guard_delivery_status descartaba delivery_error si el estado no cambiaba;
--    ahora lo deja cambiar mientras el estado siga siendo «unknown» antes y
--    después. Lo demás sigue igual: delivered, read y failed solo avanzan, y un
--    aviso que no cambia el estado de un mensaje en cualquier otro estado no
--    toca ni la hora ni el error.
-- 2. Los borradores de respuesta que ya no tocan (el cliente escribió otra vez y
--    contesta el turno de su último mensaje): el worker los cierra para que la
--    bandeja no tenga dos respuestas pendientes. Su ejecución pasa a failed con
--    output.superseded (ya podía: UPDATE de status y output, 20261112140000) y
--    su aprobación, a expired:
--    - moodly_worker: UPDATE solo de approvals.status. guard_approval
--      (20261030090000), que actúa para todos los roles, ya no deja que nadie
--      que no sea una persona con su sesión apruebe o rechace: al worker solo le
--      queda pending → expired.
--    - guard_worker_approval (solo para moodly_worker): y solo caduca la
--      aprobación de una respuesta (effect_class external_message) cuya
--      ejecución ya está failed con output.superseded. Cualquier otra (una
--      reserva, una respuesta viva) sigue sin poder tocarla.
--
-- Sin funciones security definer. service_role queda igual.
-- Tests en 56_worker_supersede_reply (y los privilegios exactos en 50).
-- Vuelta atrás: rollbacks/20261113130000_worker_supersede_reply.down.sql.

-- ---------------------------------------------------------------------------
-- 1. delivery_error mientras sigue «unknown»
-- ---------------------------------------------------------------------------
create or replace function private.guard_delivery_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.direction = 'out' and new.status is distinct from old.status then
    if new.status not in ('pending', 'sent', 'delivered', 'read', 'failed', 'unknown') then
      raise exception 'un mensaje que sale no pasa a %', new.status using errcode = '23514';
    end if;
    new.status := private.next_delivery_status(old.status, new.status);
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    -- Un aviso que no cambia nada no toca la hora; tampoco el error, salvo el
    -- porqué de un envío que sigue sin saberse si llegó.
    new.status_changed_at := old.status_changed_at;
    if not (old.status = 'unknown' and new.status = 'unknown') then
      new.delivery_error := old.delivery_error;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Caducar la aprobación de un borrador de respuesta que ya no toca
-- ---------------------------------------------------------------------------
create function private.guard_worker_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' and new.status is distinct from old.status then
    if new.status <> 'expired' or new.effect_class <> 'external_message' or not exists (
      select 1 from public.executions e
      where e.id = new.execution_id and e.organization_id = new.organization_id
        and e.status = 'failed' and e.output ? 'superseded'
    ) then
      raise exception 'el worker solo caduca la aprobación de una respuesta que ya no toca' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_approval() from public;
create trigger guard_worker_approval before update on public.approvals
  for each row execute function private.guard_worker_approval();

grant update (status) on public.approvals to moodly_worker;
