-- Vuelta atrás de 20261112240000_dbos_5_4_schema.sql: el esquema de DBOS vuelve
-- a la versión 123 (la de @dbos-inc/dbos-sdk 5.3.0). Antes, desplegar un worker
-- con la 5.3.0: la 5.4.0 no arranca con el esquema en la 123.

DROP INDEX CONCURRENTLY IF EXISTS "dbos"."idx_application_versions_owner_timestamp";
DROP INDEX CONCURRENTLY IF EXISTS "dbos"."idx_application_versions_timestamp";
UPDATE "dbos"."dbos_migrations" SET "version" = 123;
