-- Vuelta atrás de 20261112250000: moodly_worker vuelve a leer integrations entera
-- (como en 20261112210000). Ningún worker depende de no tenerlo.
revoke select (id, organization_id, location_id, provider, kind, status, external_connection_id, last_health_check)
  on public.integrations from moodly_worker;
grant select on public.integrations to moodly_worker;
