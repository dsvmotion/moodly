-- Rol con el que el worker se conecta al esquema de DBOS (ADR 0027, regla 6):
-- lee y escribe las tablas de dbos y nada más. Sin DDL (no crea ni altera
-- nada), sin acceso a public ni a private (los datos de las organizaciones los
-- toca con la clave secreta a través de TenantDb, §4.4) y sin heredar de nadie.
--
-- Se crea sin login: cada entorno le da login y contraseña fuera de las
-- migraciones, que no llevan secretos. En local lo hace `pnpm db:seed`; en
-- staging y producción, el despliegue, con la contraseña de su gestor de
-- secretos.

-- Los roles son del clúster, no de la base de datos: sobreviven a un
-- `supabase db reset`, así que se crea solo si no existe.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dbos_worker') then
    create role dbos_worker nologin noinherit;
  end if;
end
$$;

-- Lo justo para DBOS: usar el esquema, leer y escribir sus tablas y llamar a
-- sus funciones. Ni TRUNCATE, ni REFERENCES, ni TRIGGER.
grant usage on schema dbos to dbos_worker;
grant select, insert, update, delete on all tables in schema dbos to dbos_worker;
grant usage, select on all sequences in schema dbos to dbos_worker;
grant execute on all functions in schema dbos to dbos_worker;

-- Las tablas y funciones que añadan las migraciones de próximas versiones de
-- DBOS (las aplica el CI con este mismo rol, postgres) nacen con los mismos
-- privilegios.
alter default privileges in schema dbos grant select, insert, update, delete on tables to dbos_worker;
alter default privileges in schema dbos grant usage, select on sequences to dbos_worker;
alter default privileges in schema dbos grant execute on functions to dbos_worker;

-- Nadie más: PostgreSQL da EXECUTE a PUBLIC en toda función nueva, y el
-- esquema no se expone por la API (config.toml: api.schemas = public), pero
-- tampoco debe ser legible desde una sesión de la app.
revoke all on schema dbos from public, anon, authenticated, service_role;
revoke all on all tables in schema dbos from public, anon, authenticated, service_role;
revoke all on all sequences in schema dbos from public, anon, authenticated, service_role;
revoke execute on all functions in schema dbos from public, anon, authenticated, service_role;
alter default privileges in schema dbos revoke execute on functions from public;
