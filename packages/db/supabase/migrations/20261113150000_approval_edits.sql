-- OA02, PR 2: quien aprueba una respuesta del agente puede corregir su texto
-- al aprobarla (decisión de V1, 2026-11-13). Y una reserva o un cambio de cita
-- cuya hora ya pasó no se aprueba (revisión de V10 sobre #312).
--
-- - approvals.edited_input: lo que la persona aprobó en lugar de lo que propuso
--   el agente. La ejecución no cambia (lo que propuso el agente queda tal cual,
--   con su hash): el worker comprueba el hash de la original como siempre y,
--   si hay edición, ejecuta la edición con la misma clave de idempotencia.
-- - Solo se pone en el mismo UPDATE que pasa la aprobación de pending a
--   approved, con la sesión de quien decide (RLS approvals_decide y el rol que
--   pide), una vez y nunca después. Al rechazar, no. El worker no la escribe.
-- - Solo para respuestas (skill reply, external_message): {"text": …}, con el
--   texto recortado entre 1 y 4000 caracteres, el mismo límite que la skill
--   (MAX_REPLY_LENGTH de packages/skills). Editar una reserva llegará con su
--   revalidación de huecos.
-- - Aprobar una reserva o un cambio de cita (input.starts_at) cuya hora ya pasó
--   falla (BK001, como la base de datos al reservar en el pasado). Al
--   ejecutarla también fallaría; así la persona no cree que la aprobó.
--
-- guard_approval es SECURITY INVOKER (como antes): lee la ejecución con RLS de
-- quien decide, que la ve porque ve la aprobación (mismo alcance). Si no la
-- viera, la edición se rechaza (no es una respuesta que pueda ver).
--
-- Vuelta atrás: rollbacks/20261113150000_approval_edits.down.sql (devuelve
-- guard_approval a la versión de 20261111200000 y quita la columna; las
-- ediciones guardadas se pierden). No hay datos de clientes todavía.

alter table public.approvals
  add column edited_input jsonb,
  add constraint approvals_edited_only_approved check (edited_input is null or status = 'approved'),
  add constraint approvals_edited_is_object check (edited_input is null or jsonb_typeof(edited_input) = 'object');

comment on column public.approvals.edited_input is
  'Lo que aprobó la persona en lugar de la propuesta del agente (OA02): solo el texto de una respuesta, puesto al aprobar.';

-- La regla de lo que se puede editar, aparte para probarla y para que el
-- guard la lea igual siempre. Solo una respuesta: {"text": …} y nada más.
create function private.valid_reply_edit(p_edit jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- CASE y no AND: SQL no garantiza el orden, y jsonb_object_keys falla con
  -- lo que no es un objeto. Nunca null: lo que no se sabe validar no vale.
  select case
           when p_edit is null or jsonb_typeof(p_edit) <> 'object' then false
           when coalesce((select array_agg(k order by k) from jsonb_object_keys(p_edit) as k), '{}') <> array['text'] then false
           when jsonb_typeof(p_edit -> 'text') <> 'string' then false
           else length(btrim(p_edit ->> 'text')) between 1 and 4000
         end;
$$;
revoke all on function private.valid_reply_edit(jsonb) from public;
grant execute on function private.valid_reply_edit(jsonb) to authenticated, service_role;

create or replace function private.guard_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_requested_by uuid := new.requested_by;
  v_decided_by uuid := new.decided_by;
  v_execution record;
  v_found boolean := false;
begin
  -- Borrar a quien la pidió o a quien la decidió deja la aprobación sin él (D-01).
  if new.requested_by is distinct from old.requested_by then
    if private.user_was_deleted(old.requested_by, new.requested_by) then
      v_requested_by := old.requested_by;
    end if;
  end if;
  if new.decided_by is distinct from old.decided_by and new.status is not distinct from old.status then
    if private.user_was_deleted(old.decided_by, new.decided_by) then
      v_decided_by := old.decided_by;
    end if;
  end if;

  if (new.execution_id, new.organization_id, new.location_id, new.effect_class, new.input_hash,
      new.required_role, new.reason, v_requested_by, new.expires_at, new.created_at)
     is distinct from
     (old.execution_id, old.organization_id, old.location_id, old.effect_class, old.input_hash,
      old.required_role, old.reason, old.requested_by, old.expires_at, old.created_at) then
    raise exception 'lo que se aprueba no cambia' using errcode = '42501';
  end if;
  -- La edición (OA02) solo entra con la decisión de aprobar: nunca antes, nunca después.
  if new.edited_input is distinct from old.edited_input
     and not (old.status = 'pending' and new.status = 'approved' and old.edited_input is null) then
    raise exception 'lo aprobado no se edita después' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then
    if (v_decided_by, new.decided_at) is distinct from (old.decided_by, old.decided_at) then
      raise exception 'la decisión de una aprobación no cambia' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'una aprobación ya decidida o caducada no cambia' using errcode = '42501';
  end if;
  if new.status in ('approved', 'rejected') then
    if current_user <> 'authenticated' or (select auth.uid()) is null then
      raise exception 'solo una persona con su sesión aprueba o rechaza' using errcode = '42501';
    end if;
    if now() >= old.expires_at then
      raise exception 'la aprobación ha caducado' using errcode = '42501';
    end if;
    if new.status = 'approved' then
      select e.skill_key, e.effect_class, e.input into v_execution
      from public.executions e
      where e.id = new.execution_id and e.organization_id = new.organization_id;
      v_found := found;
      if new.edited_input is not null then
        if not v_found or v_execution.skill_key <> 'reply' or v_execution.effect_class <> 'external_message' then
          raise exception 'solo se edita el texto de una respuesta' using errcode = '42501';
        end if;
        if not private.valid_reply_edit(new.edited_input) then
          raise exception 'el texto editado no es válido (entre 1 y 4000 caracteres)' using errcode = '23514';
        end if;
      end if;
      -- Un IF dentro de otro: SQL no garantiza el orden de un AND, y el cast
      -- solo puede correr si el texto es una fecha.
      if v_found and v_execution.skill_key in ('book_appointment', 'reschedule_appointment') then
        if pg_input_is_valid(v_execution.input ->> 'starts_at', 'timestamptz') then
          if (v_execution.input ->> 'starts_at')::timestamptz <= now() then
            raise exception 'la hora de la cita ya ha pasado' using errcode = 'BK001';
          end if;
        end if;
      end if;
    end if;
    new.decided_by := (select auth.uid());
    new.decided_at := now();
  elsif new.status = 'expired' then
    if current_user = 'authenticated' then
      raise exception 'una persona no marca una aprobación como caducada' using errcode = '42501';
    end if;
    new.decided_by := null;
    new.decided_at := null;
  end if;
  return new;
end;
$$;

-- Por columna: la persona que decide escribe el estado (como antes) y, al
-- aprobar, la edición. Nadie más: moodly_worker sigue solo con status.
grant update (edited_input) on public.approvals to authenticated;
