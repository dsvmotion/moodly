-- Vuelta atrás de 20261113150000_approval_edits.sql: quien aprueba ya no puede
-- editar el texto de una respuesta, y aprobar una reserva con la hora pasada
-- vuelve a no comprobarse en la base de datos (lo sigue parando la Server
-- Action, y al ejecutarla falla). Antes, desplegar una web y un worker sin la
-- edición (OA02, PR 2). Las ediciones guardadas se pierden al quitar la columna.

revoke update (edited_input) on public.approvals from authenticated;

-- guard_approval, como la dejó 20261111200000_offboarding_execution_states.
create or replace function private.guard_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_requested_by uuid := new.requested_by;
  v_decided_by uuid := new.decided_by;
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

drop function private.valid_reply_edit(jsonb);

alter table public.approvals
  drop constraint approvals_edited_is_object,
  drop constraint approvals_edited_only_approved,
  drop column edited_input;
