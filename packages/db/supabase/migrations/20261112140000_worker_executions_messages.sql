-- PL-T1, paso 3c-2 (ADR 0049): moodly_worker guarda las ejecuciones del turno y
-- escribe la respuesta del agente en la conversación, por SQL bajo RLS, en vez
-- de la clave secreta por PostgREST (converse.ts: recordExecution;
-- conversation-sender.ts).
--
-- moodly_worker no es «la plataforma» (V1, 2026-11-12): privilegios mínimos y
-- las guardas también para él.
-- - executions: INSERT de las columnas que guarda el turno; UPDATE solo de
--   status y output (retener lo que esperaba a una persona cuando la
--   conversación ya la lleva una persona). Nunca DELETE ni TRUNCATE.
-- - messages: solo INSERT de las columnas de la respuesta del agente. Nunca
--   UPDATE, DELETE ni TRUNCATE.
-- - guard_worker_execution (solo para moodly_worker): nunca pone una ejecución
--   approved ni rejected; eso lo decide una persona. Lo demás lo sigue mirando
--   guard_execution_status (D-02 y el techo de autonomía), que actúa para todos
--   los roles, y validate_execution (run, organización y local coherentes).
-- - guard_worker_message (solo para moodly_worker): el worker solo escribe los
--   mensajes del agente (author 'agent', direction 'out', sin author_user_id).
--   Es la regla de guard_staff_message (que solo actúa para authenticated y
--   pone author 'user') llevada al worker: nunca escribe como una persona del
--   equipo ni como el cliente. guard_agent_message_mode (R-02: solo en una
--   conversación que lleva el agente) ya actuaba para todos los roles.
-- - executions: también SELECT (las actualizaciones filtran por la clave de la
--   ejecución; el worker ya leía sus ejecuciones por PostgREST).
-- - conversations: UPDATE solo de mode, con guard_worker_conversation (solo para
--   moodly_worker: de agent a human y nada más; nunca devuelve una conversación
--   al agente, eso lo hace una persona). Se adelanta de 3c-3 porque escribir un
--   mensaje del agente bloquea su conversación (guard_agent_message_mode, FOR
--   SHARE, R-02) y Postgres pide para ese bloqueo un privilegio de UPDATE en la
--   tabla. guard_conversation_mode solo actúa para authenticated: esta es su
--   regla para el worker.
-- - Guardas solo para authenticated en estas tablas: en messages,
--   guard_staff_message (cubierta por guard_worker_message); en conversations,
--   guard_conversation_mode (cubierta por guard_worker_conversation); en
--   executions, ninguna. service_role queda igual.
--
-- Tests en 48_worker_executions_messages.
-- Vuelta atrás: rollbacks/20261112140000_worker_executions_messages.down.sql.

create function private.guard_worker_execution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' and new.status in ('approved', 'rejected')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'el worker no aprueba ni rechaza: eso lo decide una persona' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_execution() from public;
create trigger guard_worker_execution before insert or update on public.executions
  for each row execute function private.guard_worker_execution();

create function private.guard_worker_message()
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
create trigger guard_worker_message before insert on public.messages
  for each row execute function private.guard_worker_message();

create function private.guard_worker_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' and new.mode is distinct from old.mode
     and not (old.mode = 'agent' and new.mode = 'human') then
    raise exception 'el worker solo pasa una conversación del agente a una persona' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_conversation() from public;
create trigger guard_worker_conversation before update on public.conversations
  for each row execute function private.guard_worker_conversation();

grant select on public.executions to moodly_worker;
grant update (mode) on public.conversations to moodly_worker;
grant insert (organization_id, run_id, location_id, skill_key, skill_version, effect_class, autonomy_applied,
              input, target, input_hash, preview, output, status, idempotency_key)
  on public.executions to moodly_worker;
grant update (status, output) on public.executions to moodly_worker;
grant insert (organization_id, conversation_id, direction, author, content, status, idempotency_key)
  on public.messages to moodly_worker;
