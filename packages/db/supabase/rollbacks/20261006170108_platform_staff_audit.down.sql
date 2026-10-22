-- Vuelta atrás de 20261006170108_platform_staff_audit.sql.
-- DESTRUCTIVO para las tablas nuevas: borra platform_staff (quién es equipo
-- interno) y audit_logs (el registro de auditoría). Exportar antes audit_logs
-- si hay datos reales. No toca los datos de tenants: solo quita las políticas
-- del equipo interno y el trigger de identidades separadas de memberships.
-- Supabase CLI no ejecuta "down" migrations: aplicar a mano con
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <este archivo>
begin;

drop policy if exists organizations_select_platform_staff on public.organizations;
drop policy if exists regions_select_platform_staff       on public.regions;
drop policy if exists locations_select_platform_staff     on public.locations;
drop policy if exists memberships_select_platform_staff   on public.memberships;
drop policy if exists users_select_platform_staff         on public.users;

drop trigger if exists validate_identity on public.memberships;

drop table if exists public.audit_logs;
drop table if exists public.platform_staff;

drop function if exists private.guard_audit_logs_append_only();
drop function if exists private.audit_logs_set_at();
drop function if exists private.is_platform_staff(text[]);
drop function if exists private.validate_identity_separation();

delete from supabase_migrations.schema_migrations where version = '20261006170108';

commit;
