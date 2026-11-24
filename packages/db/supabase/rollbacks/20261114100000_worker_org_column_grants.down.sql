-- Vuelta atrás de 20261114100000_worker_org_column_grants.sql. Antes, desplegar
-- un worker sin los filtros explícitos de organization_id sobre estas tablas
-- (si no, la entrada de canales y channels.send fallan con 42501).

revoke select (organization_id) on public.contact_identities from moodly_worker;
revoke select (organization_id) on public.domain_events from moodly_worker;
revoke select (organization_id) on public.contacts from moodly_worker;
