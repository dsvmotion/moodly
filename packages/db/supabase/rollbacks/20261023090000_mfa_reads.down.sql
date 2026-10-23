-- Vuelta atrás de 20261023090000_mfa_reads.sql: session_is_active() deja de
-- mirar el segundo factor (definición de 20260930101908_session_revocation.sql).
-- Las lecturas vuelven a valer con aal1 aunque la persona tenga MFA (R-16).

create or replace function private.session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.id = (
        select case
          when claim ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then claim::uuid
        end
        from (select (select auth.jwt()) ->> 'session_id' as claim) as jwt
      )
      and s.user_id = (select auth.uid())
      and (s.not_after is null or s.not_after > now())
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
