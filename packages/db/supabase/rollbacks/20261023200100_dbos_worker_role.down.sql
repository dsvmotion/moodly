-- Vuelta atrás de 20261023200100_dbos_worker_role.sql: fuera el rol del
-- worker. Antes, parar el worker (sus conexiones impiden borrar el rol).
-- Los privilegios por defecto se quitan antes de borrar el rol.

alter default privileges in schema dbos revoke all on tables from dbos_worker;
alter default privileges in schema dbos revoke all on sequences from dbos_worker;
alter default privileges in schema dbos revoke all on functions from dbos_worker;
revoke all on all tables in schema dbos from dbos_worker;
revoke all on all sequences in schema dbos from dbos_worker;
revoke all on all functions in schema dbos from dbos_worker;
revoke all on schema dbos from dbos_worker;
drop role dbos_worker;
