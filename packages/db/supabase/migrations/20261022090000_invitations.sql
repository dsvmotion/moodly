-- Invitaciones con consentimiento (hallazgo 2.2 de
-- docs/audits/2026-10-20-revision-seguridad-plataforma.md; ADR 0022 §5).
--
-- Antes: un org_admin creaba la membership directamente y podía meter en su
-- organización a cualquier usuario del sistema sin que lo aceptara.
-- Ahora:
--   1. El org_admin crea una invitación para un email, con rol y alcance
--      (create_invitation: función normal, pasa por RLS). Se genera un token de
--      256 bits; en la base solo queda su hash. El enlace se muestra una vez.
--   2. La persona invitada, con su sesión, la acepta (accept_invitation). La
--      membership solo se crea si el token es válido, no ha caducado (7 días),
--      no se ha usado ni revocado y el email de su sesión es el invitado.
--   3. Se elimina la política memberships_insert: la única vía de alta es la
--      invitación (la plataforma, con service role, sigue pudiendo).
--
-- accept_invitation es SECURITY DEFINER y escribe en memberships: requiere
-- revisión humana (AGENTS.md → Base de datos: guardas).
-- Vuelta atrás: supabase/rollbacks/20261022090000_invitations.down.sql

create table public.invitations (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  email              text not null,
  role               text not null check (role in ('org_admin', 'region_manager', 'location_manager', 'staff')),
  scope_region_ids   uuid[] not null default '{}',
  scope_location_ids uuid[] not null default '{}',
  token_hash         text not null unique,
  invited_by         uuid not null references public.users (id) on delete cascade,
  expires_at         timestamptz not null default now() + interval '7 days',
  accepted_at        timestamptz,
  accepted_by        uuid references public.users (id) on delete set null,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint invitations_email_normalized check (
    email = lower(btrim(email)) and length(email) between 3 and 320 and position('@' in email) > 1
  ),
  -- Misma coherencia rol ↔ alcance que memberships.
  constraint invitations_scope_matches_role check (
    case role
      when 'org_admin'        then cardinality(scope_region_ids) = 0 and cardinality(scope_location_ids) = 0
      when 'region_manager'   then cardinality(scope_region_ids) > 0 and cardinality(scope_location_ids) = 0
      else                         cardinality(scope_region_ids) = 0 and cardinality(scope_location_ids) > 0
    end
  )
);
create index invitations_organization_idx on public.invitations (organization_id);
create index invitations_invited_by_idx   on public.invitations (invited_by);
create index invitations_accepted_by_idx  on public.invitations (accepted_by);

-- Los ids del alcance deben ser de la misma organización (misma función que memberships).
create trigger validate_scope before insert or update on public.invitations
  for each row execute function private.validate_membership_scope();

-- Guarda (solo para authenticated, ADR 0003): una invitación no se modifica,
-- solo se revoca (revoked_at de null a ahora). Aceptarla lo hace accept_invitation.
create function private.guard_invitation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.revoked_at is not null or old.accepted_at is not null then
    raise exception 'la invitación ya está cerrada' using errcode = '42501';
  end if;
  if new.revoked_at is null
     or (to_jsonb(new) - 'revoked_at') <> (to_jsonb(old) - 'revoked_at') then
    raise exception 'una invitación solo se puede revocar' using errcode = '42501';
  end if;
  new.revoked_at := now();
  return new;
end;
$$;
revoke all on function private.guard_invitation_update() from public;
create trigger guard_invitation_update before update on public.invitations
  for each row execute function private.guard_invitation_update();

-- RLS: solo los org_admin de la organización ven, crean y revocan sus invitaciones.
alter table public.invitations enable row level security;
alter table public.invitations force row level security;
revoke all on public.invitations from anon;
revoke truncate, references, trigger, delete on public.invitations from authenticated;

create policy invitations_select on public.invitations
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

create policy invitations_insert on public.invitations
  for insert to authenticated
  with check ((select private.session_is_active())
              and private.has_org_role(organization_id, array['org_admin'])
              and invited_by = (select auth.uid()));

create policy invitations_update on public.invitations
  for update to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

-- ---------------------------------------------------------------------------
-- Crear: función normal (security invoker), así que el INSERT pasa por RLS.
-- Devuelve el token en claro UNA vez; en la base solo queda su hash.
-- ---------------------------------------------------------------------------
create function public.create_invitation(
  p_organization_id    uuid,
  p_email              text,
  p_role               text,
  p_scope_region_ids   uuid[] default '{}',
  p_scope_location_ids uuid[] default '{}'
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_token text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
begin
  insert into public.invitations
    (organization_id, email, role, scope_region_ids, scope_location_ids, token_hash, invited_by)
  values
    (p_organization_id, lower(btrim(p_email)), p_role,
     coalesce(p_scope_region_ids, '{}'), coalesce(p_scope_location_ids, '{}'),
     encode(extensions.digest(v_token, 'sha256'), 'hex'), (select auth.uid()));
  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aceptar: security definer (crea la membership). Comprueba sesión viva, token,
-- caducidad, que no esté usada ni revocada, que el email de la sesión sea el
-- invitado y que la organización esté activa. Cualquier fallo da el MISMO error, para no dar pistas a quien
-- pruebe tokens. Devuelve la organización a la que entra.
-- ---------------------------------------------------------------------------
create function public.accept_invitation(p_token text)
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

-- Supabase concede EXECUTE por defecto a anon y authenticated en public: se
-- quita a todos y se da solo lo necesario.
revoke all on function public.create_invitation(uuid, text, text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.accept_invitation(text) from public, anon, authenticated;
grant execute on function public.create_invitation(uuid, text, text, uuid[], uuid[]) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant select, insert, update on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- La única vía de alta pasa a ser la invitación.
-- ---------------------------------------------------------------------------
drop policy memberships_insert on public.memberships;
