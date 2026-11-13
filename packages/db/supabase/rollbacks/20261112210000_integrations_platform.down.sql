-- Vuelta atrás de 20261112210000_integrations_platform.sql (O-02). Antes,
-- desplegar una web y un worker sin integraciones de plataforma (sin
-- NANGO_API_KEY) y borrar sus conexiones en Nango. No hay datos de clientes:
-- las filas 'platform' se borran.
drop trigger guard_worker_integration on public.integrations;
drop function private.guard_worker_integration();
revoke select, update on public.integrations from moodly_worker;
drop trigger guard_integration_write on public.integrations;
drop function private.guard_integration_write();
drop policy integrations_insert on public.integrations;
drop policy integrations_update on public.integrations;
revoke insert, update on public.integrations from authenticated;
delete from public.integrations where kind = 'platform';
alter table public.integrations
  drop constraint integrations_external_connection_only_platform,
  drop constraint integrations_platform_active_has_connection,
  drop constraint integrations_platform_shape,
  drop constraint integrations_external_connection_id_key,
  drop column external_connection_id,
  drop constraint integrations_kind_check,
  add constraint integrations_kind_check check (kind in ('mcp', 'native'));
