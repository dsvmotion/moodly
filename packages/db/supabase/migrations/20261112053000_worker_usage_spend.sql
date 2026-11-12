-- PL-T1, paso 3 (ADR 0049): moodly_worker lee el libro de consumo de su
-- organización (usage_records, PL-ledger 20261112051000) para el gasto del día
-- y del mes del turno, dentro de su transacción bajo RLS, en vez de
-- public.usage_spend por PostgREST con la clave secreta.
--
-- - Política usage_records_worker: solo SELECT, solo las filas de la
--   organización de la transacción (00_rls_enabled exige ese filtro exacto).
-- - grant select: el worker lee; anotar sigue siendo de la plataforma (el
--   enrutador, por PostgREST) hasta que su módulo pase a moodly_worker.
-- - Es una tabla particionada: la política y el privilegio van en la tabla
--   padre, por la que entra el worker.
--
-- public.usage_spend (y tenantDb.usageSpend) se quedan: tras este cambio el
-- worker ya no las llama, y se quitan aparte, con su test.
--
-- Vuelta atrás: rollbacks/20261112053000_worker_usage_spend.down.sql.

create policy usage_records_worker on public.usage_records
  for select to moodly_worker
  using (organization_id = (select private.worker_organization_id()));

grant select on public.usage_records to moodly_worker;
