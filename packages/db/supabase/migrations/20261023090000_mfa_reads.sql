-- MFA también para leer (auditoría 2026-10-23, hallazgo R-16).
--
-- Antes, quien tenía el segundo factor activado solo lo necesitaba en la
-- interfaz (requireUser manda a /login/mfa) y para administrar (aal2 en las
-- políticas de escritura, 20261022120000_admin_mfa). La contraseña sola ya daba
-- una sesión aal1 válida contra la API de Supabase, y ninguna política SELECT
-- pedía aal2: con la contraseña robada se leían por REST la organización, los
-- locales, las memberships y las invitaciones (comprobado en local con el seed).
--
-- Ahora la sesión solo cuenta como viva para los datos si es aal2 o si la
-- persona no tiene ningún factor verificado. Se cambia en un único sitio,
-- private.session_is_active(), que es la primera condición de todas las
-- políticas (y la comprueba accept_invitation): las cubre todas, también las
-- futuras.
--
-- - El aal sale del claim del JWT, que firma Supabase Auth (como
--   session_is_aal2()). Solo vale aal2 tras verificar un factor.
-- - Activar el MFA en una sesión la deja en aal2 (Auth emite un token nuevo) y
--   Auth cierra las demás sesiones aal1 de esa persona; desactivarlo borra los
--   factores y la sesión vuelve a valer con aal1.
-- - Un factor sin verificar (alta a medias) no cuenta.
--
-- Vuelta atrás: supabase/rollbacks/20261023090000_mfa_reads.down.sql

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
    -- Un session_id ausente o mal formado cuenta como "sin sesión": se valida
    -- el formato antes del cast para no depender de si el planificador llega
    -- a evaluarlo (fallo cerrado y determinista, sin error).
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
      -- Quien tiene un segundo factor verificado necesita una sesión aal2.
      and (
        coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
        or not exists (
          select 1 from auth.mfa_factors f
          where f.user_id = s.user_id and f.status = 'verified'
        )
      )
  );
$$;
