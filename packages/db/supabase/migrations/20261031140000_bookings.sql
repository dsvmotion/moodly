-- Reservas con el calendario propio de Moodly (paso 4b; roadmap B1, ADR 0023).
-- Si el negocio no tiene una herramienta de reservas conectada, Moodly es la
-- fuente; cuando la tenga (Google Calendar, Booksy…), estas tablas son su copia
-- sincronizada (external_ref, synced_at) detrás de la misma interfaz
-- BookingProvider. Solo datos de prueba todavía.
--
-- - services: lo que se reserva y cuánto dura, en todos los locales o en uno.
-- - booking_resources y resource_services: quién o qué atiende (profesional,
--   cabina, equipo) en cada local, y qué servicios puede hacer.
-- - appointments: las citas. La base de datos impide dos citas solapadas del
--   mismo recurso (restricción de exclusión) y dos citas para la misma
--   petición (idempotency_key): reintentar nunca duplica.
-- - find_booking_slots: los huecos libres según el horario y la zona horaria
--   del local (cambio de hora incluido). Solo para la plataforma.
--
-- La app solo lee, cada uno lo de su alcance. Escribe el worker (las skills de
-- Recepción, paso 4c).
--
-- Vuelta atrás: drop de find_booking_slots, appointments, resource_services,
-- booking_resources y services y de sus funciones private.*. btree_gist se
-- queda. No hay datos de clientes todavía.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. services, booking_resources y resource_services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = en todos los locales de la organización.
  location_id uuid,
  name text not null check (length(btrim(name)) between 1 and 120),
  duration_minutes int not null check (duration_minutes between 5 and 600),
  active boolean not null default true,
  external_ref text check (length(external_ref) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_id_organization_id_key unique (id, organization_id),
  constraint services_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
);
create index services_organization_id_idx on public.services (organization_id, location_id);
create index services_location_id_idx on public.services (location_id, organization_id);

create table public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('staff', 'room', 'equipment')),
  active boolean not null default true,
  external_ref text check (length(external_ref) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_resources_id_organization_id_key unique (id, organization_id),
  constraint booking_resources_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
);
create index booking_resources_location_id_idx on public.booking_resources (location_id, organization_id);
create index booking_resources_organization_id_idx on public.booking_resources (organization_id);

create table public.resource_services (
  organization_id uuid not null,
  resource_id uuid not null,
  service_id uuid not null,
  primary key (resource_id, service_id),
  constraint resource_services_resource_same_org foreign key (resource_id, organization_id)
    references public.booking_resources (id, organization_id) on delete cascade,
  constraint resource_services_service_same_org foreign key (service_id, organization_id)
    references public.services (id, organization_id) on delete cascade
);
create index resource_services_service_id_idx on public.resource_services (service_id, organization_id);
create index resource_services_resource_org_idx on public.resource_services (resource_id, organization_id);

-- Un recurso solo hace servicios que se ofrecen en su local. Security definer
-- para comprobar contra los datos reales; solo lee.
create function private.validate_resource_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.booking_resources r
    join public.services s on s.id = new.service_id and s.organization_id = r.organization_id
    where r.id = new.resource_id and r.organization_id = new.organization_id
      and (s.location_id is null or s.location_id = r.location_id)
  ) then
    raise exception 'el servicio no se ofrece en el local del recurso' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_resource_service() from public;
create trigger validate_resource_service before insert or update on public.resource_services
  for each row execute function private.validate_resource_service();

-- ---------------------------------------------------------------------------
-- 2. appointments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  service_id uuid not null,
  resource_id uuid not null,
  contact_id uuid not null,
  starts_at timestamptz not null,
  -- La pone la base de datos con la duración del servicio.
  ends_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed', 'no_show')),
  -- La misma petición (la idempotency_key de la ejecución) crea una sola cita: reintentar no duplica.
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  booked_by text not null check (booked_by in ('agent', 'user', 'sync')),
  cancelled_at timestamptz,
  external_ref text check (length(external_ref) <= 200),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_id_organization_id_key unique (id, organization_id),
  constraint appointments_idempotency_key unique (organization_id, idempotency_key),
  constraint appointments_time_order check (ends_at > starts_at),
  constraint appointments_cancelled_at check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint appointments_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id),
  constraint appointments_service_same_org foreign key (service_id, organization_id)
    references public.services (id, organization_id),
  constraint appointments_resource_same_org foreign key (resource_id, organization_id)
    references public.booking_resources (id, organization_id),
  constraint appointments_contact_same_org foreign key (contact_id, organization_id)
    references public.contacts (id, organization_id) on delete cascade,
  -- Nunca dos citas vivas solapadas del mismo recurso.
  constraint appointments_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'booked')
);
create index appointments_scope_idx on public.appointments (organization_id, location_id, starts_at);
create index appointments_contact_id_idx on public.appointments (contact_id, organization_id, starts_at);
create index appointments_service_id_idx on public.appointments (service_id, organization_id);
create index appointments_resource_org_idx on public.appointments (resource_id, organization_id);
create index appointments_location_id_idx on public.appointments (location_id, organization_id);

-- La cita encaja con lo que se reserva: el recurso es del local y hace el
-- servicio, el servicio se ofrece allí, y la hora de fin sale de la duración.
-- Lo que la identifica no cambia; cancelar es definitivo (volver a reservar es
-- otra cita) y solo se mueve una cita viva. Para todos los roles; security
-- definer para leer el recurso y el servicio reales.
create function private.validate_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration int;
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.contact_id, new.idempotency_key, new.booked_by, new.created_at)
       is distinct from (old.organization_id, old.contact_id, old.idempotency_key, old.booked_by, old.created_at) then
      raise exception 'la organización, el contacto y el origen de una cita no cambian' using errcode = '42501';
    end if;
    if old.status <> 'booked' and (new.status, new.starts_at, new.resource_id, new.service_id, new.location_id)
       is distinct from (old.status, old.starts_at, old.resource_id, old.service_id, old.location_id) then
      raise exception 'una cita cancelada, completada o perdida ya no cambia' using errcode = '42501';
    end if;
  end if;

  -- Al reservar o mover: el recurso y el servicio, activos y del local; la hora
  -- de fin, de la duración. Cancelar o cerrar una cita no vuelve a comprobarlo
  -- (un recurso que ya no hace el servicio no impide cancelar).
  if tg_op = 'INSERT' or (new.starts_at, new.resource_id, new.service_id, new.location_id)
     is distinct from (old.starts_at, old.resource_id, old.service_id, old.location_id) then
    select s.duration_minutes into v_duration
    from public.services s
    where s.id = new.service_id and s.organization_id = new.organization_id and s.active
      and (s.location_id is null or s.location_id = new.location_id);
    if v_duration is null then
      raise exception 'el servicio no se ofrece en ese local' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.booking_resources r
      join public.resource_services rs on rs.resource_id = r.id and rs.service_id = new.service_id
      where r.id = new.resource_id and r.organization_id = new.organization_id
        and r.location_id = new.location_id and r.active
    ) then
      raise exception 'el recurso no es de ese local, no está activo o no hace ese servicio' using errcode = '23514';
    end if;
    new.ends_at := new.starts_at + make_interval(mins => v_duration);
  else
    new.ends_at := old.ends_at;
  end if;

  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.validate_appointment() from public;
create trigger validate_appointment before insert or update on public.appointments
  for each row execute function private.validate_appointment();

create trigger set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.booking_resources
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. find_booking_slots
-- ---------------------------------------------------------------------------
-- Los huecos libres de un servicio en un local: cada 15 minutos dentro del
-- horario del local (opening_hours: {"mon": ["09:00", "14:00"], …}) en su zona
-- horaria, por cada recurso que hace el servicio, sin solaparse con una cita
-- viva, desde ahora y como mucho 31 días y 50 huecos. Organización, local y
-- servicio los pone el runtime. Invoker: con la clave secreta (worker) el
-- filtro explícito es lo que acota.
create function public.find_booking_slots(
  p_organization_id uuid,
  p_location_id uuid,
  p_service_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit int
)
returns table (resource_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select greatest(p_from, now()) as from_at, least(p_to, p_from + interval '31 days') as to_at
  ),
  loc as (
    select l.timezone, l.opening_hours
    from public.locations l
    where l.id = p_location_id and l.organization_id = p_organization_id and l.status = 'active'
  ),
  svc as (
    select s.duration_minutes
    from public.services s
    where s.id = p_service_id and s.organization_id = p_organization_id and s.active
      and (s.location_id is null or s.location_id = p_location_id)
  ),
  res as (
    select r.id
    from public.booking_resources r
    join public.resource_services rs on rs.resource_id = r.id and rs.service_id = p_service_id
    where r.organization_id = p_organization_id and r.location_id = p_location_id and r.active
  ),
  days as (
    select d::date as day
    from bounds, loc,
         generate_series((bounds.from_at at time zone loc.timezone)::date,
                         (bounds.to_at at time zone loc.timezone)::date, interval '1 day') d
  ),
  hours as (
    select days.day, loc.timezone, loc.opening_hours -> k.key ->> 0 as open_time, loc.opening_hours -> k.key ->> 1 as close_time
    from days, loc,
         lateral (select (array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[extract(dow from days.day)::int + 1] as key) k
    where jsonb_typeof(loc.opening_hours -> k.key) = 'array'
  ),
  windows as (
    select ((day + open_time::time) at time zone timezone) as open_at,
           ((day + close_time::time) at time zone timezone) as close_at
    from hours
    where open_time ~ '^\d{2}:\d{2}$' and close_time ~ '^\d{2}:\d{2}$'
  ),
  candidates as (
    select res.id as resource_id, g as starts_at, g + make_interval(mins => svc.duration_minutes) as ends_at
    from windows, svc, res,
         generate_series(windows.open_at, windows.close_at - make_interval(mins => svc.duration_minutes), interval '15 minutes') g
  )
  select c.resource_id, c.starts_at, c.ends_at
  from candidates c, bounds
  where c.starts_at >= bounds.from_at and c.ends_at <= bounds.to_at
    and not exists (
      select 1 from public.appointments a
      where a.organization_id = p_organization_id and a.resource_id = c.resource_id and a.status = 'booked'
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.starts_at, c.ends_at, '[)')
    )
  order by c.starts_at, c.resource_id
  limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.find_booking_slots(uuid, uuid, uuid, timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.find_booking_slots(uuid, uuid, uuid, timestamptz, timestamptz, int) to service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS: la app solo lee, cada uno lo de su alcance
-- ---------------------------------------------------------------------------
alter table public.services enable row level security;
alter table public.services force row level security;
alter table public.booking_resources enable row level security;
alter table public.booking_resources force row level security;
alter table public.resource_services enable row level security;
alter table public.resource_services force row level security;
alter table public.appointments enable row level security;
alter table public.appointments force row level security;

-- Los servicios de toda la organización los ve cualquier miembro; los de un local, quien lo tiene en su alcance.
create policy services_select on public.services
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id)
         and (location_id is null or private.can_access_location(organization_id, location_id)));

create policy booking_resources_select on public.booking_resources
  for select to authenticated
  using ((select private.session_is_active()) and private.can_access_location(organization_id, location_id));

create policy resource_services_select on public.resource_services
  for select to authenticated
  using ((select private.session_is_active()) and exists (
    select 1 from public.booking_resources r where r.id = resource_services.resource_id and r.organization_id = resource_services.organization_id
  ));

create policy appointments_select on public.appointments
  for select to authenticated
  using ((select private.session_is_active()) and private.can_see_scope(organization_id, location_id));

create policy services_select_platform_staff on public.services
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy booking_resources_select_platform_staff on public.booking_resources
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy resource_services_select_platform_staff on public.resource_services
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));
create policy appointments_select_platform_staff on public.appointments
  for select to authenticated using ((select private.session_is_active()) and private.staff_can_read(organization_id));

revoke all on public.services, public.booking_resources, public.resource_services, public.appointments from anon, authenticated;
grant select on public.services, public.booking_resources, public.resource_services, public.appointments to authenticated;
