-- Vuelta atrás de 20261113140000_business_setup.sql: la app vuelve a solo leer
-- servicios, recursos y lo que hace cada uno, y el horario deja de comprobarse.
-- Antes, desplegar una web sin los ajustes del negocio (OA04). Los precios
-- escritos se pierden al quitar sus columnas.

revoke insert (organization_id, location_id, name, duration_minutes, active, price_cents, currency) on public.services from authenticated;
revoke update (name, duration_minutes, active, price_cents, currency) on public.services from authenticated;
revoke insert (organization_id, location_id, name, kind, active) on public.booking_resources from authenticated;
revoke update (name, kind, active) on public.booking_resources from authenticated;
revoke insert (organization_id, resource_id, service_id), delete on public.resource_services from authenticated;

drop policy resource_services_delete on public.resource_services;
drop policy resource_services_insert on public.resource_services;
drop policy booking_resources_update on public.booking_resources;
drop policy booking_resources_insert on public.booking_resources;
drop policy services_update on public.services;
drop policy services_insert on public.services;

alter table public.locations drop constraint locations_opening_hours_format;
drop function private.valid_opening_hours(jsonb);

drop trigger guard_synced on public.resource_services;
drop function private.guard_synced_resource_service();
drop trigger guard_synced on public.booking_resources;
drop trigger guard_synced on public.services;
drop function private.guard_synced_booking_row();

alter table public.services drop column currency, drop column price_cents;
