-- PL-T1, paso 1 (ADR 0049, opción C): el rol con el que el worker leerá y
-- escribirá los datos de las organizaciones por SQL, bajo RLS, con la
-- organización fijada en cada transacción. Hoy el worker usa la clave secreta
-- por PostgREST, que no pasa por RLS (G-07).
--
-- Este paso solo crea el rol, la función que lee la organización de la
-- transacción y las políticas del rol; no cambia cómo trabaja el worker. Los
-- privilegios por tabla llegan módulo a módulo, a la vez que el código que los
-- usa: aquí, solo la lectura que hace el turno de conversación al prepararse
-- (apps/worker/src/agents/converse.ts, prepare).
--
-- - moodly_worker: sin login (se lo dan el seed en local y el workflow
--   «Staging · worker» en staging, como a dbos_worker), sin BYPASSRLS, sin
--   heredar de nadie, sin DDL y sin acceso a auth.
-- - La organización va en la transacción: el worker empieza cada unidad de
--   trabajo con select set_config('moodly.organization_id', <org>, true).
--   private.worker_organization_id() la lee; sin ella devuelve null y el rol
--   no ve ninguna fila.
-- - Una política <tabla>_worker por tabla de tenant, solo para moodly_worker:
--   using y with check organization_id = (select private.worker_organization_id()).
--   En organizations, la clave es id y solo se lee. Las tablas con
--   organization_id opcional (agent_types, skills y audit_logs: catálogo
--   global o filas de la plataforma) quedan para el módulo que las use: sin
--   política propia, el rol no ve nada de ellas.
--
-- Protege de errores de código (una organización equivocada, una tabla sin
-- filtro), no de un worker comprometido, que puede fijar cualquier
-- organización (ADR 0049, «Consecuencias»).
--
-- Vuelta atrás: rollbacks/20261112020000_worker_role.down.sql.

-- Los roles son del clúster y sobreviven a un `supabase db reset`.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'moodly_worker') then
    create role moodly_worker nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. La organización de la transacción
-- ---------------------------------------------------------------------------
create function private.worker_organization_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('moodly.organization_id', true), '')::uuid;
$$;
revoke all on function private.worker_organization_id() from public, anon, authenticated, service_role;
grant execute on function private.worker_organization_id() to moodly_worker;

-- Para llamar a esa función desde sus políticas. En private nada es ejecutable
-- por PUBLIC (lo vigila 00_rls_enabled), así que el rol solo llega a lo que se
-- le concede.
grant usage on schema public, private to moodly_worker;

-- ---------------------------------------------------------------------------
-- 2. Las políticas del rol
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'agent_runs', 'agent_skills', 'agents', 'appointments', 'approvals', 'booking_resources',
    'channel_accounts', 'config_overrides', 'config_snapshots', 'contact_identities', 'contacts',
    'conversations', 'domain_events', 'executions', 'goal_progress', 'goals', 'integration_secrets',
    'integrations', 'invitations', 'knowledge_chunks', 'knowledge_requests', 'knowledge_sources',
    'locations', 'memberships', 'messages', 'org_model_settings', 'regions', 'resource_services',
    'services', 'support_grants', 'waitlist_entries'
  ] loop
    execute format(
      'create policy %I on public.%I for all to moodly_worker '
      'using (organization_id = (select private.worker_organization_id())) '
      'with check (organization_id = (select private.worker_organization_id()))',
      t || '_worker', t);
  end loop;
end
$$;

create policy organizations_worker on public.organizations
  for select to moodly_worker
  using (id = (select private.worker_organization_id()));

-- ---------------------------------------------------------------------------
-- 3. Privilegios: solo la lectura del turno de conversación al prepararse
-- ---------------------------------------------------------------------------
grant select on public.conversations, public.messages, public.channel_accounts, public.locations,
  public.org_model_settings, public.services, public.agent_runs
  to moodly_worker;
