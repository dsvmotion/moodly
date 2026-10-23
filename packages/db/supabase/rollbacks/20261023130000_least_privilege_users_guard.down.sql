-- Vuelta atrás de 20261023130000_least_privilege_users_guard.sql (R-20 y R-35):
-- authenticated recupera los privilegios que no usa ninguna política (RLS los
-- sigue dejando en 0 filas) y public.users pierde su guarda de columnas.

drop trigger guard_fields on public.users;
drop function private.guard_user_fields();

grant insert, delete on public.organizations to authenticated;
grant delete on public.regions, public.locations, public.users to authenticated;
grant insert on public.memberships to authenticated;
