-- [M0][R-08] La hora que elige el modelo se valida en la base de datos.
--
-- Hasta ahora, una cita reservada por un agente solo comprobaba que el recurso
-- y el servicio encajaran y que no se solapara con otra: el modelo podía
-- reservar en el pasado o a las 3 de la madrugada. Ahora, al reservar o mover
-- una cita viva de un agente (booked_by = 'agent'), la hora tiene que ser un
-- hueco libre de find_booking_slots: en el futuro, dentro del horario del local
-- en su zona horaria, en la cuadrícula de 15 minutos de su ventana y con el
-- recurso libre. Es la misma lógica que usan los huecos que se ofrecen: no se
-- duplica; find_booking_slots gana un último parámetro opcional para no contar
-- la propia cita cuando se mueve.
--
-- Solo para las vías de la API (current_setting('role'): service_role, que es
-- por donde reserva el worker, authenticated y anon). Una conexión directa de
-- plataforma (migraciones, seed, mantenimiento: role 'none') no queda bloqueada,
-- como en las demás guardas (ADR 0003): quien la usa responde por lo que escribe.
-- Solo las citas de agentes: el equipo (booked_by = 'user') puede apuntar una
-- cita fuera de horario o ya pasada (una visita sin cita), y las que llegan de
-- un calendario externo (booked_by = 'sync') reflejan lo que ya existe allí.
-- Cancelar o cerrar una cita no vuelve a comprobarlo. Un hueco ocupado sigue
-- fallando con 23P01 (appointments_no_overlap) y se lo cuenta al modelo como
-- «hueco ocupado»; este check falla con SQLSTATE BK001.
--
-- validate_appointment sigue siendo SECURITY DEFINER como antes (ver
-- 20261108090000): no escribe nada, solo lee locations, services, resources y
-- appointments para decidir; no cambia lo que escribe en tablas de tenants.
--
-- Vuelta atrás:
--   validate_appointment: la versión de 20261108090000_appointment_reminders.sql;
--   drop function public.find_booking_slots(uuid, uuid, uuid, timestamptz, timestamptz, int, uuid);
--   y find_booking_slots de 20261109090000_waitlist.sql (con sus grants).

-- ---------------------------------------------------------------------------
-- 1. find_booking_slots: sin contar una cita (la que se mueve).
-- ---------------------------------------------------------------------------
-- El cuerpo es el de 20261109090000_waitlist.sql (con los huecos ofrecidos
-- retenidos) más el parámetro p_exclude_appointment.
drop function public.find_booking_slots(uuid, uuid, uuid, timestamptz, timestamptz, int);

create function public.find_booking_slots(
  p_organization_id uuid,
  p_location_id uuid,
  p_service_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit int,
  p_exclude_appointment uuid default null
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
        and a.id is distinct from p_exclude_appointment
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
revoke all on function public.find_booking_slots(uuid, uuid, uuid, timestamptz, timestamptz, int, uuid) from public, anon, authenticated;
grant execute on function public.find_booking_slots(uuid, uuid, uuid, timestamptz, timestamptz, int, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. validate_appointment: la hora de una cita de un agente es un hueco libre.
-- ---------------------------------------------------------------------------
create or replace function private.validate_appointment()
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
    -- La conversación de la reserva tampoco; solo se queda sin ella si se borra.
    if new.conversation_id is distinct from old.conversation_id and new.conversation_id is not null then
      raise exception 'la conversación en la que se reservó una cita no cambia' using errcode = '42501';
    end if;
    if old.status <> 'booked' and (new.status, new.starts_at, new.resource_id, new.service_id, new.location_id)
       is distinct from (old.status, old.starts_at, old.resource_id, old.service_id, old.location_id) then
      raise exception 'una cita cancelada, completada o perdida ya no cambia' using errcode = '42501';
    end if;
  end if;

  -- Al reservar: la conversación, si la hay, es la del contacto de la cita.
  if tg_op = 'INSERT' and new.conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id and c.contact_id = new.contact_id
  ) then
    raise exception 'la conversación no es del contacto de la cita' using errcode = '23514';
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

    -- La hora que elige un agente: un hueco libre, en el futuro. Si el recurso
    -- ya está ocupado a esa hora no se dice aquí: lo rechaza appointments_no_overlap
    -- (23P01), que es «hueco ocupado» y no «hora no disponible».
    if new.booked_by = 'agent' and new.status = 'booked'
       and current_setting('role', true) in ('service_role', 'authenticated', 'anon') then
      if new.starts_at <= now() then
        raise exception 'la hora de la cita ya ha pasado' using errcode = 'BK001';
      end if;
      if not exists (
        select 1
        from public.find_booking_slots(
          new.organization_id, new.location_id, new.service_id, new.starts_at, new.ends_at, 50,
          case when tg_op = 'UPDATE' then new.id end
        ) s
        where s.resource_id = new.resource_id and s.starts_at = new.starts_at
      ) and not exists (
        -- El hueco que se le ofreció a este mismo contacto desde la lista de espera:
        -- find_booking_slots lo retiene para los demás, no para quien lo tiene ofrecido.
        select 1 from public.waitlist_entries w
        where w.organization_id = new.organization_id and w.contact_id = new.contact_id and w.status = 'offered'
          and w.offer_expires_at > now() and w.offered_resource_id = new.resource_id and w.offered_starts_at = new.starts_at
      ) and not exists (
        select 1 from public.appointments a
        where a.organization_id = new.organization_id and a.resource_id = new.resource_id and a.status = 'booked'
          and a.id is distinct from new.id
          and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      ) then
        raise exception 'esa hora no es un hueco libre: fuera del horario del local o fuera de la cuadrícula de 15 minutos' using errcode = 'BK001';
      end if;
    end if;
  else
    new.ends_at := old.ends_at;
  end if;

  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;
