-- PL-T1, paso 3c-4 (ADR 0049): moodly_worker pide las aprobaciones de lo que
-- espera a una persona y, cuando una persona decide, cierra la ejecución y el
-- run, por SQL bajo RLS, en vez de la clave secreta por PostgREST
-- (approvals.ts: requestApproval, load, settleExecution, settleRun).
--
-- moodly_worker no es «la plataforma» (V1, 2026-11-12): privilegios mínimos y
-- las guardas también para él. Lo que el código escribe, exactamente:
-- - approvals: solo INSERT, pendiente (requestApproval). Nunca la decide, la
--   caduca ni la cambia: sin UPDATE, DELETE ni TRUNCATE, y el INSERT no lleva
--   status, decided_by, decided_at ni requested_by (nacen con su valor por
--   defecto, pendiente y sin decidir; validate_approval lo exige para todos
--   los roles). guard_approval, que actúa para todos los roles, ya solo deja
--   aprobar o rechazar a authenticated con sesión; para el worker, además, no
--   hay privilegio de UPDATE con el que intentarlo.
-- - executions: settleExecution pone executed, failed o rejected a lo que
--   esperaba a una persona. guard_worker_execution (20261112140000) no dejaba
--   rejected al worker; ahora lo deja en un solo caso: la aprobación de esa
--   ejecución ya la rechazó una persona (el worker copia la decisión, nunca la
--   toma). approved, nunca. executed sigue exigiendo una aprobación aprobada y
--   con el mismo hash (guard_execution_status, para todos los roles).
-- - agent_runs: settleRun pasa el run de awaiting_approval a completed, solo el
--   estado: lo permite guard_worker_agent_run (20261112130000).
-- - Lecturas: SELECT en approvals (load y guard_worker_execution, que es
--   invoker y la lee bajo RLS). La política approvals_worker (20261112040500)
--   ya era FOR ALL por la organización de la transacción.
-- - Guardas que solo actúan para authenticated en approvals: ninguna
--   (validate_approval y guard_approval actúan para todos). service_role queda
--   igual.
--
-- Tests en 50_worker_approvals.
-- Vuelta atrás: rollbacks/20261112160000_worker_approvals.down.sql.

grant select on public.approvals to moodly_worker;
grant insert (organization_id, execution_id, location_id, effect_class, input_hash, required_role, reason, expires_at)
  on public.approvals to moodly_worker;

create or replace function private.guard_worker_execution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' and new.status in ('approved', 'rejected')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    -- Copiar el rechazo de una persona: la aprobación de esta ejecución ya está rechazada.
    if tg_op = 'UPDATE' and new.status = 'rejected' and exists (
      select 1 from public.approvals a where a.execution_id = new.id and a.status = 'rejected'
    ) then
      return new;
    end if;
    raise exception 'el worker no aprueba ni rechaza: eso lo decide una persona' using errcode = '42501';
  end if;
  return new;
end;
$$;
