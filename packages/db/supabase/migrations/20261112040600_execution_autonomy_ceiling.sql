-- D-02, seguimiento (revisión de V10 sobre #192): una ejecución no nace con
-- más autonomía que el techo de su clase de efecto (MANUAL §5.6; el mismo
-- EFFECT_CLASS_CEILING de packages/agent-core/src/effects.ts):
--   read, internal_write, external_message → autonomous;
--   external_outreach → execute;
--   financial y destructive → draft (siempre con aprobación).
-- Antes, la base de datos dejaba nacer executed o failed una ejecución
-- financiera o destructiva si decía autonomía execute o autonomous; ahora no
-- puede, para ningún rol (también la service role y el dueño). Subir lo
-- financiero a execute con el visto bueno explícito de un org_admin (MANUAL
-- §5.6) no existe todavía; cuando exista, cambiará este techo con su auditoría.
--
-- Usa los mismos private.autonomy_rank y private.effect_class_ceiling que ya
-- acotan la autonomía máxima de cada skill (20261023150000_agent_catalog,
-- skills_max_within_ceiling). Solo cambia private.guard_execution_status
-- (20261111200000): el resto de la máquina de estados queda igual. La autonomía de una ejecución no cambia
-- después de nacer (guard_execution), así que basta con mirarla al insertar.
--
-- Vuelta atrás: rollbacks/20261112040600_execution_autonomy_ceiling.down.sql
-- (la función de 20261111200000).

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
    if private.autonomy_rank(new.autonomy_applied) > private.autonomy_rank(private.effect_class_ceiling(new.effect_class)) then
      raise exception 'la autonomía de la ejecución supera el techo de su clase de efecto' using errcode = '42501';
    end if;
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
