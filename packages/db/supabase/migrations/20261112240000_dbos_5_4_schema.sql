-- Esquema de sistema de DBOS al día con @dbos-inc/dbos-sdk 5.4.0 (ADR 0027,
-- regla 6; W1). La 5.4.0 pide la versión 125 del esquema (la 5.3.0, la 123):
-- dos índices nuevos en dbos.application_versions. Con el esquema atrasado, el
-- worker no arranca.
--
-- Todo lo que sigue a esta cabecera es, sin tocar, la salida de
-- `dbos schema --print-migrations 124` de @dbos-inc/dbos-sdk 5.4.0 (la versión
-- exacta de apps/worker). Para comprobarlo:
--   diff <(tail -n +18 <este archivo>) \
--        <(pnpm --filter @repo/worker exec dbos schema --print-migrations 124)
-- Sin funciones SECURITY DEFINER ni privilegios nuevos: los índices no cambian
-- quién llega al esquema (20261023200100_dbos_worker_role).
--
-- Usa CREATE INDEX CONCURRENTLY, como 20261023200000: el CLI de Supabase no
-- envuelve la migración en una transacción.
--
-- Vuelta atrás: rollbacks/20261112240000_dbos_5_4_schema.down.sql.
-- DBOS system database migrations
-- This script is for PostgreSQL only.
-- Contains CREATE/DROP INDEX CONCURRENTLY: run outside a transaction block (e.g. plain psql, not psql --single-transaction).
-- Migration 124: 124_application_versions_timestamp_index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_application_versions_timestamp" ON "dbos"."application_versions" ("version_timestamp" DESC);
UPDATE "dbos"."dbos_migrations" SET "version" = 124;
-- Migration 125: 125_application_versions_owner_timestamp_index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_application_versions_owner_timestamp" ON "dbos"."application_versions" ("application_name", "version_timestamp" DESC);
UPDATE "dbos"."dbos_migrations" SET "version" = 125;
