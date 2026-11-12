-- Los intentos de procesar un evento de entrada (ADR 0052 §2; revisión de V10
-- de #229): el workflow channels.ingest reintenta un número acotado de veces y
-- después lo deja como fallido para siempre (error_code 'dead_letter').
--
-- - attempts: cuántos intentos fallaron. Lo escribe la service role; solo
--   crece (guard_inbound_event_attempts, para cualquier rol) y empieza en 0.
-- - Sin funciones security definer.
--
-- Vuelta atrás: rollbacks/20261112180000_inbound_events_attempts.down.sql.

alter table public.inbound_events
  add column attempts smallint not null default 0 check (attempts between 0 and 20);

create function private.guard_inbound_event_attempts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.attempts <> 0 then
    raise exception 'un evento de entrada empieza sin intentos' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.attempts < old.attempts then
    raise exception 'los intentos de un evento de entrada no bajan' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_inbound_event_attempts() from public;
create trigger guard_inbound_event_attempts before insert or update on public.inbound_events
  for each row execute function private.guard_inbound_event_attempts();

grant update (attempts) on public.inbound_events to service_role;
