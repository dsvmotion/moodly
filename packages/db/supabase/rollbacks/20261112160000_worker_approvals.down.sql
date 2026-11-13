-- Vuelta atrás de 20261112160000_worker_approvals.sql. Antes, desplegar un
-- worker que pida y cierre las aprobaciones por PostgREST.
create or replace function private.guard_worker_execution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'moodly_worker' and new.status in ('approved', 'rejected')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'el worker no aprueba ni rechaza: eso lo decide una persona' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke insert on public.approvals from moodly_worker;
revoke select on public.approvals from moodly_worker;
