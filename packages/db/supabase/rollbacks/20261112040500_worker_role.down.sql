-- Vuelta atrás de 20261112040500_worker_role.sql: fuera las políticas, los
-- privilegios y la función del rol moodly_worker, y el rol (si nadie lo usa;
-- el worker todavía no se conecta con él).

revoke select on public.conversations, public.messages, public.channel_accounts, public.locations,
  public.org_model_settings, public.services, public.agent_runs
  from moodly_worker;

do $$
declare
  p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where 'moodly_worker' = any (roles) loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

revoke usage on schema public, private from moodly_worker;
drop function private.worker_organization_id();
drop role moodly_worker;
