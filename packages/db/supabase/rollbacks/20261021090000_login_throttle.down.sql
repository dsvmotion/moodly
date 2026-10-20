-- Vuelta atrás de 20261021090000_login_throttle.sql: elimina el freno de login
-- (funciones y tabla de fallos). Solo se pierden los fallos recientes, que son
-- temporales. Antes, desplegar una versión de la app que no llame a estas
-- funciones. Aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

drop function if exists public.login_record_success();
drop function if exists public.login_record_failure(text, text);
drop function if exists public.login_throttle(text, text);
drop function if exists private.login_key(text, integer);
drop table if exists private.login_failures;

commit;
