-- Endurecimiento de auth (auditoría preproducción 2026-11-10, G-03 y G-04).
--
-- G-03. login_record_success() borraba los fallos del freno con cualquier JWT
-- con email, también con la sesión aal1 (solo contraseña) de quien tiene un
-- segundo factor verificado. Así, quien supiera la contraseña podía vaciar el
-- freno entre intento e intento y probar códigos TOTP sin límite. Ahora exige
-- private.session_is_active(): sesión viva y, con factor verificado, aal2. El
-- login normal (sin factor) y el paso de MFA (ya en aal2) siguen igual.
--
-- G-04. accept_invitation() se fiaba del email del JWT. Con la confirmación de
-- email desactivada, una cuenta con el email de otra persona sin confirmar
-- podía aceptar su invitación. Ahora exige auth.users.email_confirmed_at de
-- quien llama; si no está confirmado, el mismo error genérico que el resto
-- (no da pistas sobre el token). Además, config.toml activa la confirmación de
-- email también en local ([auth.email] enable_confirmations = true).
--
-- Ambas son SECURITY DEFINER y ya escribían en tablas (private.login_failures;
-- memberships e invitations). No amplían lo que escriben: solo añaden
-- condiciones. Tests en negativo: 09_login_throttle y 10_invitations.
--
-- Vuelta atrás: volver a crear las dos funciones con el cuerpo de
-- 20261021090000_login_throttle.sql y 20261022090000_invitations.sql
-- (create or replace; los permisos no cambian).

create or replace function public.login_record_success()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := (select auth.jwt()) ->> 'email';
begin
  -- Sesión viva y, si la persona tiene un segundo factor verificado, aal2: con
  -- la contraseña sola no se vacía el freno de los códigos (G-03).
  if v_email is null or not (select private.session_is_active()) then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  delete from private.login_failures where email_hash = private.login_key(v_email, 320);
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text := lower(btrim((select auth.jwt()) ->> 'email'));
  v_inv   public.invitations;
begin
  if v_user is null or v_email is null or not (select private.session_is_active()) then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) > 128 then
    raise exception 'invitación no válida o caducada' using errcode = 'P0002';
  end if;

  select * into v_inv from public.invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;

  if v_inv.id is null
     or v_inv.accepted_at is not null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
     or v_inv.email <> v_email
     -- El email del JWT solo cuenta si la persona lo ha confirmado (G-04): el
     -- de auth.users, el mismo que el del JWT, con email_confirmed_at.
     or not exists (
       select 1 from auth.users u
        where u.id = v_user
          and u.email_confirmed_at is not null
          and lower(btrim(u.email)) = v_email
     )
     -- Una organización suspendida o archivada no admite altas (20261021130000_org_status).
     or not private.org_is_active(v_inv.organization_id) then
    raise exception 'invitación no válida o caducada' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = v_user and m.organization_id = v_inv.organization_id) then
    raise exception 'ya perteneces a esta organización' using errcode = '23505';
  end if;

  insert into public.users (id) values (v_user) on conflict (id) do nothing;
  insert into public.memberships (user_id, organization_id, role, scope_region_ids, scope_location_ids)
  values (v_user, v_inv.organization_id, v_inv.role, v_inv.scope_region_ids, v_inv.scope_location_ids);

  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_inv.organization_id;
end;
$$;
