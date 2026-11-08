-- Paso 4e-1: lo que necesitan los recordatorios de las citas (MANUAL §5.1,
-- decidido por producto el 2026-11-08).
--
-- 1. appointments.conversation_id: la conversación en la que el agente hizo la
--    reserva. Reservar a través del agente cuenta como permiso para los
--    recordatorios de esa cita, y salen por el mismo canal: por esa
--    conversación. Una cita que no reservó el agente (la del equipo o una
--    sincronizada) no tiene conversación y no recibe recordatorios. La pone el
--    worker al reservar, nunca el LLM; es de la misma organización (clave
--    compuesta) y del mismo contacto que la cita (validate_appointment), y no
--    cambia después. Si se borra la conversación, la cita se queda sin ella.
-- 2. La skill appointment_reminder en el catálogo de la plataforma: clase
--    external_outreach con autonomía execute (el techo de la clase), solo de
--    Recepción. Recepción la trae de serie, también los agentes que ya
--    existen. Salen solas, sin aprobación; quien no las quiera, la desactiva.
--
-- Funciones security definer: validate_appointment ya lo era (lee el recurso,
-- el servicio y ahora la conversación reales) y no escribe en ninguna tabla.
-- attach_default_skills_to, de 20261031150000, da la skill nueva a los agentes
-- que ya existen; no cambia.
--
-- Vuelta atrás:
--   delete from public.agent_skills where skill_id in
--     (select id from public.skills where organization_id is null and key = 'appointment_reminder');
--   delete from private.default_agent_skills where skill_key = 'appointment_reminder';
--   delete from public.skills where organization_id is null and key = 'appointment_reminder';
--   validate_appointment: la versión de 20261031140000_bookings.sql;
--   alter table public.appointments drop column conversation_id;

-- ---------------------------------------------------------------------------
-- 1. La conversación de la reserva.
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column conversation_id uuid,
  add constraint appointments_conversation_same_org foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete set null (conversation_id);

create index appointments_conversation_id_idx on public.appointments (conversation_id, organization_id)
  where conversation_id is not null;

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
  else
    new.ends_at := old.ends_at;
  end if;

  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. La skill de los recordatorios.
-- ---------------------------------------------------------------------------
insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'appointment_reminder', 1, 'code', 'Appointment reminders',
   'Reminds the customer of their appointment 24 and 4 hours before, in the conversation where it was booked.',
   'external_outreach', 'execute', 'execute', '{reception}', 'published');

insert into private.default_agent_skills (agent_type_key, skill_key) values ('reception', 'appointment_reminder');

-- Los agentes de Recepción que ya existen.
select private.attach_default_skills_to(id) from public.agents;
