-- 3.2 (control del worker): cada consulta del worker filtra por la organización
-- explícita, no solo por RLS. Filtrar por una columna exige poder leerla, y a
-- moodly_worker le faltaba SELECT sobre organization_id en tres tablas de las
-- que ya lee otras columnas:
--   - contact_identities (la entrada busca la identidad del cliente; channels.send
--     comprueba que el número sigue siendo suyo);
--   - domain_events (la entrada lee el message.received de su mensaje);
--   - contacts (V2: invariante de pgTAP «si lee alguna columna de una tabla con
--     organization_id, también lee organization_id»).
-- Sin el grant, esos filtros fallan con 42501. Es una columna de la propia fila:
-- no amplía qué filas ve (RLS sigue igual) ni qué otras columnas lee.
--
-- Sin funciones security definer. service_role queda igual.
-- Tests en 58_worker_org_column_grants (y los privilegios exactos en 51).
-- Vuelta atrás: rollbacks/20261114100000_worker_org_column_grants.down.sql.

grant select (organization_id) on public.contact_identities to moodly_worker;
grant select (organization_id) on public.domain_events to moodly_worker;
grant select (organization_id) on public.contacts to moodly_worker;
