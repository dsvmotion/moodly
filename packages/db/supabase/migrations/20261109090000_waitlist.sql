-- Paso 4f-1: la lista de espera de Recepción (MANUAL §5.1, decidido por
-- producto el 2026-11-08).
--
-- 1. waitlist_entries: quien quiere un servicio en un local, dentro de una
--    franja, y no encontró hueco. El agente le ofrece apuntarse (skill
--    join_waitlist). Cuando se libera un hueco (appointment.cancelled), el
--    worker lo ofrece al primero de la lista que encaje durante 30 minutos y
--    después al siguiente; si acepta, la reserva va a la bandeja de
--    aprobaciones como cualquier otra (4f-3).
--    - La escribe solo el worker (service_role); la app la lee, cada uno lo de
--      su alcance, como las citas.
--    - De la misma organización en todo (claves compuestas) y coherente:
--      la conversación es del contacto, el servicio se ofrece en el local y el
--      recurso ofrecido es del local y hace el servicio (validate_waitlist_entry).
--    - El orden de la lista es el de alta (created_at).
--    - Una sola entrada viva (esperando u ofrecida) por contacto, servicio y
--      local.
-- 2. Mientras un hueco está ofrecido, find_booking_slots no se lo da a nadie
--    más: el que lo tiene ofrecido puede reservarlo (book_appointment no mira
--    las ofertas) durante sus 30 minutos.
-- 3. La skill join_waitlist en el catálogo de la plataforma: escritura interna,
--    autonomía execute por defecto (apuntarse no compromete nada: no necesita
--    aprobación), solo de Recepción. Recepción la trae de serie, también los
--    agentes que ya existen.
--
-- Funciones security definer: validate_waitlist_entry lee las filas reales de
-- conversaciones, servicios y recursos para comprobar la coherencia y no
-- escribe en ninguna tabla. find_booking_slots sigue siendo invoker.
-- attach_default_skills_to (de 20261031150000) da la skill nueva a los agentes
-- que ya existen; no cambia.
--
-- Vuelta atrás:
--   delete from public.agent_skills where skill_id in
--     (select id from public.skills where organization_id is null and key = 'join_waitlist');
--   delete from private.default_agent_skills where skill_key = 'join_waitlist';
--   delete from public.skills where organization_id is null and key = 'join_waitlist';
--   find_booking_slots: la versión de 20261031140000_bookings.sql;
--   drop table public.waitlist_entries; drop function private.validate_waitlist_entry();

-- ---------------------------------------------------------------------------
-- 1. waitlist_entries
-- ---------------------------------------------------------------------------
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  contact_id uuid not null,
  -- Por donde se le ofrece el hueco: la conversación en la que se apuntó.
  conversation_id uuid,
  service_id uuid not null,
  -- La franja en la que le viene bien.
  wanted_from timestamptz not null,
  wanted_until timestamptz not null,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'expired', 'cancelled')),
  -- La oferta en curso: el hueco que se le guarda y hasta cuándo.
  offered_resource_id uuid,
  offered_starts_at timestamptz,
  offered_ends_at timestamptz,
  offer_expires_at timestamptz,
  -- La de la ejecución que la creó: la misma petición, una sola entrada.
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_entries_id_organization_id_key unique (id, organization_id),
  constraint waitlist_entries_idempotency_key unique (organization_id, idempotency_key),
  constraint waitlist_entries_window check (wanted_until > wanted_from and wanted_until <= wanted_from + interval '62 days'),
  -- Ofrecida, con su hueco y su plazo; reservada, con el hueco que aceptó (queda como historia).
  constraint waitlist_entries_offer check (
    status not in ('offered', 'booked') or (offered_resource_id is not null and offered_starts_at is not null
                                            and offered_ends_at is not null and offer_expires_at is not null)
  ),
  constraint waitlist_entries_offer_order check (offered_ends_at is null or offered_ends_at > offered_starts_at),
  constraint waitlist_entries_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id),
  constraint waitlist_entries_contact_same_org foreign key (contact_id, organization_id)
    references public.contacts (id, organization_id) on delete cascade,
  constraint waitlist_entries_conversation_same_org foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete set null (conversation_id),
  constraint waitlist_entries_service_same_org foreign key (service_id, organization_id)
    references public.services (id, organization_id) on delete cascade,
  constraint waitlist_entries_resource_same_org foreign key (offered_resource_id, organization_id)
    references public.booking_resources (id, organization_id)
);

-- Una entrada viva por contacto, servicio y local.
create unique index waitlist_entries_one_alive on public.waitlist_entries (organization_id, contact_id, service_id, location_id)
  where status in ('waiting', 'offered');
-- La lista de un servicio en un local, por orden de alta.
create index waitlist_entries_queue on public.waitlist_entries (organization_id, location_id, service_id, created_at)
  where status = 'waiting';
-- Las ofertas vivas, para find_booking_slots.
create index waitlist_entries_offers on public.waitlist_entries (organization_id, offered_resource_id, offered_starts_at)
  where status = 'offered';
create index waitlist_entries_contact_idx on public.waitlist_entries (contact_id, organization_id);
create index waitlist_entries_conversation_idx on public.waitlist_entries (conversation_id, organization_id) where conversation_id is not null;
create index waitlist_entries_service_idx on public.waitlist_entries (service_id, organization_id);
create index waitlist_entries_location_idx on public.waitlist_entries (location_id, organization_id);
create index waitlist_entries_resource_idx on public.waitlist_entries (offered_resource_id, organization_id) where offered_resource_id is not null;

create trigger set_updated_at before update on public.waitlist_entries
  for each row execute function private.set_updated_at();

-- La coherencia que las claves compuestas no expresan. Para todos los roles.
create function private.validate_waitlist_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.location_id, new.contact_id, new.service_id, new.idempotency_key, new.created_at)
       is distinct from (old.organization_id, old.location_id, old.contact_id, old.service_id, old.idempotency_key, old.created_at) then
      raise exception 'la organización, el local, el contacto y el servicio de una entrada de la lista no cambian' using errcode = '42501';
    end if;
    if new.conversation_id is distinct from old.conversation_id and new.conversation_id is not null then
      raise exception 'la conversación de una entrada de la lista no cambia' using errcode = '42501';
    end if;
    if old.status in ('booked', 'expired', 'cancelled') and new.status is distinct from old.status then
      raise exception 'una entrada cerrada de la lista ya no cambia' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' and new.status <> 'waiting' then
    raise exception 'una entrada nueva de la lista empieza esperando' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and new.conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id and c.contact_id = new.contact_id
  ) then
    raise exception 'la conversación no es del contacto de la entrada' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and not exists (
    select 1 from public.services s
    where s.id = new.service_id and s.organization_id = new.organization_id and s.active
      and (s.location_id is null or s.location_id = new.location_id)
  ) then
    raise exception 'el servicio no se ofrece en ese local' using errcode = '23514';
  end if;

  if new.offered_resource_id is not null
     and (tg_op = 'INSERT' or new.offered_resource_id is distinct from old.offered_resource_id) and not exists (
    select 1
    from public.booking_resources r
    join public.resource_services rs on rs.resource_id = r.id and rs.service_id = new.service_id
    where r.id = new.offered_resource_id and r.organization_id = new.organization_id and r.location_id = new.location_id
  ) then
    raise exception 'el recurso ofrecido no es del local o no hace el servicio' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_waitlist_entry() from public;
create trigger validate_waitlist_entry before insert or update on public.waitlist_entries
  for each row execute function private.validate_waitlist_entry();

alter table public.waitlist_entries enable row level security;
alter table public.waitlist_entries force row level security;

create policy waitlist_entries_select on public.waitlist_entries
  for select to authenticated
  using ((select private.session_is_active()) and private.can_see_scope(organization_id, location_id));
create policy waitlist_entries_select_platform_staff on public.waitlist_entries
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

revoke all on public.waitlist_entries from anon, authenticated;
grant select on public.waitlist_entries to authenticated;

-- ---------------------------------------------------------------------------
-- 2. find_booking_slots: un hueco ofrecido no se le da a nadie más
-- ---------------------------------------------------------------------------
create or replace function public.find_booking_slots(
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
    -- Paso 4f-1: un hueco ofrecido a alguien de la lista de espera, mientras dura la oferta.
    and not exists (
      select 1 from public.waitlist_entries w
      where w.organization_id = p_organization_id and w.offered_resource_id = c.resource_id and w.status = 'offered'
        and w.offer_expires_at > now()
        and tstzrange(w.offered_starts_at, w.offered_ends_at, '[)') && tstzrange(c.starts_at, c.ends_at, '[)')
    )
  order by c.starts_at, c.resource_id
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- 3. La skill de la lista de espera.
-- ---------------------------------------------------------------------------
insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'join_waitlist', 1, 'code', 'Join the waitlist',
   'Adds the person the agent is talking to to the waitlist for a service, when no slot suits them.',
   'internal_write', 'execute', 'autonomous', '{reception}', 'published');

insert into private.default_agent_skills (agent_type_key, skill_key) values ('reception', 'join_waitlist');

-- Los agentes de Recepción que ya existen.
select private.attach_default_skills_to(id) from public.agents;
