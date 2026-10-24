-- Eventos de dominio (outbox, MANUAL §5.8, ADR 0009): lo que pasa en una
-- organización se apunta aquí en la misma transacción que la acción, y el
-- worker lo publica después (un workflow por suscriptor, ADR 0027).
--
-- - organization_id y location_id son la única fuente del tenant de un evento
--   (control 3.7): el consumidor los toma de la fila, nunca del payload.
-- - El payload lleva ids y datos mínimos, nunca datos personales en claro: quien
--   lo consume lee lo que necesite, acotado a la organización de la fila.
-- - Nadie de la app escribe esta tabla: los eventos los escriben triggers de la
--   base de datos (y, más adelante, el worker) y el worker los publica con la
--   clave secreta. Los lee el org_admin de la organización.

-- ---------------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------------
create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Del local en el que pasó, si es de un local (lo valida validate_domain_event).
  location_id uuid references public.locations (id) on delete cascade,
  -- entidad.verbo en pasado, p. ej. invitation.created o appointment.cancelled.
  type text not null check (type ~ '^[a-z][a-z_]{0,62}(\.[a-z][a-z_]{0,62}){1,2}$'),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8192
  ),
  -- Run del agente que lo provocó (§5.8). Sin clave externa hasta que exista agent_runs (A4).
  source_run_id uuid,
  -- Protección contra bucles (§5.8): un evento que provoca otro le suma 1.
  chain_depth smallint not null default 0 check (chain_depth between 0 and 5),
  created_at timestamptz not null default now(),
  -- Cuándo el worker encoló sus entregas; null mientras está pendiente.
  published_at timestamptz,
  constraint domain_events_published_after_created check (published_at is null or published_at >= created_at)
);

-- El publicador lee los pendientes, los más antiguos primero.
create index domain_events_pending_idx on public.domain_events (created_at, id) where published_at is null;
-- Las claves externas y la consulta «actividad de una organización».
create index domain_events_organization_idx on public.domain_events (organization_id, created_at desc);
create index domain_events_location_idx on public.domain_events (location_id) where location_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Integridad (para cualquier rol, también la plataforma)
-- ---------------------------------------------------------------------------
-- El local es de la organización del evento. Security definer solo para leer
-- locations sin depender de la RLS de quien escribe; no escribe nada.
create function private.validate_domain_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local del evento no es de su organización' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_domain_event() from public;

create trigger validate_domain_event
  before insert or update on public.domain_events
  for each row execute function private.validate_domain_event();

-- La hora de publicación la pone la base de datos, no el reloj del worker.
create function private.domain_events_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is null and new.published_at is not null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.domain_events_set_published_at() from public;

create trigger set_published_at
  before update of published_at on public.domain_events
  for each row execute function private.domain_events_set_published_at();

-- ---------------------------------------------------------------------------
-- 3. Privilegios y RLS
-- ---------------------------------------------------------------------------
alter table public.domain_events enable row level security;
alter table public.domain_events force row level security;

-- Supabase concede todo a anon, authenticated y service_role en cada tabla
-- nueva de public. Nadie de la app escribe eventos: si authenticated pudiera
-- insertar, un miembro falsificaría eventos de su organización por la API.
-- Leen el org_admin (su organización, para el panel de actividad) y el equipo
-- interno con soporte vigente. La service role (el worker) lee y marca como
-- publicado, y nada más: un evento es un hecho y no se edita. Insertar y
-- borrar se concederá cuando el worker lo necesite.
revoke all on public.domain_events from anon, authenticated, service_role;
grant select on public.domain_events to authenticated, service_role;
grant update (published_at) on public.domain_events to service_role;

create policy domain_events_select_org_admin on public.domain_events
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

create policy domain_events_select_platform_staff on public.domain_events
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- ---------------------------------------------------------------------------
-- 4. Primer evento: invitation.created, en la misma transacción que el alta
-- ---------------------------------------------------------------------------
-- Security definer: la invitación la crea un org_admin (authenticated), que no
-- tiene ni debe tener privilegios sobre domain_events (si los tuviera, podría
-- falsificar eventos de su organización por la API). Por eso esta función, que
-- se ejecuta como su dueño, escribe el evento. Escribe solo esa fila, con la
-- organización de la invitación recién creada (que ya pasó RLS y sus guardas) y
-- sin datos personales: ni el email ni el token. No la puede llamar nadie: es un
-- trigger y no tiene EXECUTE para ningún rol de la app.
create function private.emit_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_events (organization_id, type, payload)
  values (
    new.organization_id,
    'invitation.created',
    jsonb_build_object('invitation_id', new.id, 'role', new.role, 'invited_by', new.invited_by)
  );
  return null;
end;
$$;

revoke all on function private.emit_invitation_created() from public, anon, authenticated, service_role;

create trigger emit_invitation_created
  after insert on public.invitations
  for each row execute function private.emit_invitation_created();
