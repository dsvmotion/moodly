-- Vuelta atrás de 20261112040600_execution_autonomy_ceiling.sql: la máquina de
-- estados de las ejecuciones vuelve a su versión de 20261111200000 (sin el
-- techo de autonomía por clase de efecto).

create or replace function private.guard_execution_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved boolean;
begin
  if tg_op = 'INSERT' then
    if new.status in ('approved', 'rejected') then
      raise exception 'una ejecución no nace aprobada ni rechazada' using errcode = '42501';
    end if;
    if new.status in ('executed', 'failed') and new.autonomy_applied not in ('execute', 'autonomous') then
      raise exception 'sin autonomía para ejecutar, una ejecución nace esperando a una persona' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('executed', 'failed', 'rejected') then
    raise exception 'una ejecución terminada no cambia de estado' using errcode = '42501';
  end if;

  v_approved := exists (
    select 1 from public.approvals a
    where a.execution_id = new.id
      and a.status = 'approved'
      and a.input_hash = new.input_hash
  );
  if old.status in ('suggested', 'drafted', 'needs_approval') then
    if new.status in ('rejected', 'failed') then
      return new;
    end if;
    if new.status in ('approved', 'executed') then
      if not v_approved then
        raise exception 'lo que espera a una persona no se ejecuta sin su aprobación' using errcode = '42501';
      end if;
      return new;
    end if;
  elsif old.status = 'approved' then
    if new.status in ('executed', 'failed') then
      if not v_approved then
        raise exception 'lo que espera a una persona no se ejecuta sin su aprobación' using errcode = '42501';
      end if;
      return new;
    end if;
  end if;
  raise exception 'una ejecución no pasa de % a %', old.status, new.status using errcode = '42501';
end;
$$;
