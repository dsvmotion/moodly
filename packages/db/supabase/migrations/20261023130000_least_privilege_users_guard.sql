-- Mínimo privilegio para authenticated (auditoría R-20) y guarda de columnas
-- de public.users (R-35).
--
-- Vuelta atrás: los mismos GRANT que se revocan aquí, `drop trigger guard_fields
-- on public.users` y `drop function private.guard_user_fields()`.

-- ---------------------------------------------------------------------------
-- R-20. Supabase concede a authenticated todos los privilegios en las tablas
-- nuevas de public. Estos no los usa ninguna política: RLS ya los bloqueaba
-- (0 filas), y ahora ni siquiera llegan a RLS (42501). Alta y baja de
-- organizaciones, borrado físico de regiones, locales y perfiles (RGPD) y altas
-- de memberships (accept_invitation, security definer) son de la plataforma.
-- ---------------------------------------------------------------------------
revoke insert, delete on public.organizations from authenticated;
revoke delete on public.regions, public.locations, public.users from authenticated;
revoke insert on public.memberships from authenticated;

-- ---------------------------------------------------------------------------
-- R-35. Cada persona edita su perfil (users_update_self), pero solo su nombre y
-- su idioma: id y created_at son de la plataforma. Lista blanca, como el resto
-- de guardas (ADR 0003): una columna nueva queda protegida hasta que se decida
-- quién puede cambiarla. Solo actúa con authenticated.
-- ---------------------------------------------------------------------------
create function private.guard_user_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  editable constant text[] := array['full_name', 'locale', 'updated_at'];
begin
  if current_user = 'authenticated'
     and (to_jsonb(new) - editable) is distinct from (to_jsonb(old) - editable)
  then
    raise exception 'desde la app solo se pueden cambiar full_name y locale del perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_user_fields() from public;

create trigger guard_fields before update on public.users
  for each row execute function private.guard_user_fields();
