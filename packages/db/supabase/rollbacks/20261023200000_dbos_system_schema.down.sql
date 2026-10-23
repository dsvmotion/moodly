-- Vuelta atrás de 20261023200000_dbos_system_schema.sql: fuera el esquema de
-- DBOS, con todos los workflows, pasos y colas del worker (los runs a medias
-- se pierden). Antes, parar el worker y aplicar la vuelta atrás de
-- 20261023200100_dbos_worker_role.sql.

drop schema dbos cascade;
