-- El agente solo escribe en una conversación que lleva él (auditoría de
-- preproducción, R-02).
--
-- Hasta ahora el worker miraba conversations.mode al cargar el turno: si alguien
-- del equipo tomaba el control mientras el modelo pensaba (o después, al aprobar
-- un borrador, o al salir un recordatorio), el mensaje del agente se guardaba
-- igual y contestaban los dos. Ahora lo decide la base de datos, al insertar:
--
-- - Un mensaje con author = 'agent' solo entra si su conversación (de su misma
--   organización) está en mode = 'agent'. Si no, 55000
--   (object_not_in_prerequisite_state), y el worker lo trata como «no se envía».
-- - La conversación se lee con FOR SHARE: «tomar el control» (un UPDATE de mode)
--   y el mensaje del agente no se cruzan. Si el UPDATE va primero, el insert
--   espera a que termine y ve 'human'; si el insert va primero, el UPDATE espera
--   a que el mensaje esté guardado, y el mensaje queda antes de la toma.
-- - Una excepción, de la plataforma y no del modelo: la confirmación de la baja
--   de los recordatorios (clave opt-out:<mensaje>, 4e-3), que se contesta
--   aunque la conversación la lleve una persona (decisión de producto,
--   2026-11-08). Esa clave la pone el worker (reminders/consent.ts); las del
--   agente son las de sus ejecuciones.
--
-- No es security definer: la ejecuta quien inserta. Desde la app nadie inserta
-- mensajes del agente (guard_staff_message pone author = 'user'); el worker
-- inserta con su clave secreta.
--
-- Vuelta atrás:
--   drop trigger guard_agent_message_mode on public.messages;
--   drop function private.guard_agent_message_mode();

create function private.guard_agent_message_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mode text;
begin
  if new.author is distinct from 'agent' then
    return new;
  end if;
  if new.idempotency_key like 'opt-out:%' then
    return new;
  end if;
  select c.mode into v_mode
  from public.conversations c
  where c.id = new.conversation_id and c.organization_id = new.organization_id
  for share;
  if v_mode is distinct from 'agent' then
    raise exception 'la conversación no la lleva el agente (%): su mensaje no se guarda', coalesce(v_mode, 'no existe')
      using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_agent_message_mode() from public;

-- Lo que escribe el equipo no llega aquí con author = 'agent': la app no puede
-- dar esa columna (grant de 20261109230000) y guard_staff_message pone 'user'.
create trigger guard_agent_message_mode before insert on public.messages
  for each row execute function private.guard_agent_message_mode();
