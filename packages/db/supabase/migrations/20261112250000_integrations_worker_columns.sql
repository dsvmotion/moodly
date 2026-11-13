-- moodly_worker lee de integrations solo las columnas que usa (O-02; ADR 0049:
-- privilegios mínimos, de columna). Lo señaló la Revisora en #280: desde
-- 20261112210000 tenía SELECT sobre la tabla entera.
--
-- Lo que usan el webhook de Nango y la lectura del calendario (apps/worker/src/
-- integrations), en el SELECT, el WHERE, el RETURNING o el ORDER BY:
--   id, organization_id, location_id, provider, kind, status,
--   external_connection_id, last_health_check.
-- Fuera: scopes, secret_id, server_version, connected_by, created_at y
-- updated_at. El UPDATE de columnas (status, external_connection_id,
-- last_health_check) no cambia, y con él sigue valiendo «select … for update».
--
-- Las políticas (integrations_worker) y las guardas (guard_worker_integration)
-- no dependen de los privilegios de columna: no cambian.
--
-- Sin funciones security definer. Vuelta atrás:
-- rollbacks/20261112250000_integrations_worker_columns.down.sql.

revoke select on public.integrations from moodly_worker;
grant select (id, organization_id, location_id, provider, kind, status, external_connection_id, last_health_check)
  on public.integrations to moodly_worker;
