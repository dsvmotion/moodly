-- Vuelta atrás de 20260929105448_tenants_rls.sql.
-- DESTRUCTIVO: borra todas las organizaciones, regiones, locales, perfiles y
-- memberships. Solo para entornos sin datos reales o tras un backup.
-- Supabase CLI no ejecuta "down" migrations: aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

drop table if exists public.memberships;
drop table if exists public.users;
drop table if exists public.locations;
drop table if exists public.regions;
drop table if exists public.organizations;

drop function if exists private.can_see_user(uuid);
drop function if exists private.can_see_membership(uuid, uuid, text, uuid[], uuid[]);
drop function if exists private.can_access_region(uuid, uuid);
drop function if exists private.can_access_location(uuid, uuid, text[]);
drop function if exists private.has_org_role(uuid, text[]);
drop function if exists private.guard_last_org_admin();
drop function if exists private.guard_location_structure();
drop function if exists private.validate_membership_scope();
drop function if exists private.set_updated_at();

drop schema if exists private;

delete from supabase_migrations.schema_migrations where version = '20260929105448';

commit;
