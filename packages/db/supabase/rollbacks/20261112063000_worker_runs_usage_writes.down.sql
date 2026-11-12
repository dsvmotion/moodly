-- Vuelta atrás de 20261112063000_worker_runs_usage_writes.sql. Antes, desplegar
-- un worker que escriba los runs y el consumo por PostgREST.
revoke insert on public.usage_records from moodly_worker;
drop policy usage_records_worker on public.usage_records;
create policy usage_records_worker on public.usage_records
  for select to moodly_worker
  using (organization_id = (select private.worker_organization_id()));
revoke insert, update on public.agent_runs from moodly_worker;
revoke select on public.agents from moodly_worker;
drop trigger guard_worker_agent_run on public.agent_runs;
drop function private.guard_worker_agent_run();
