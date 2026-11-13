-- Vuelta atrás de 20261113130000_worker_supersede_reply.sql. Antes, desplegar
-- un worker sin esa migración (si no, cerrar un borrador superseded falla por
-- permisos y el código de un «unknown» se descarta sin error).

revoke update (status) on public.approvals from moodly_worker;
drop trigger guard_worker_approval on public.approvals;
drop function private.guard_worker_approval();

-- guard_delivery_status vuelve a la de 20261113120000.
create or replace function private.guard_delivery_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.direction = 'out' and new.status is distinct from old.status then
    if new.status not in ('pending', 'sent', 'delivered', 'read', 'failed', 'unknown') then
      raise exception 'un mensaje que sale no pasa a %', new.status using errcode = '23514';
    end if;
    new.status := private.next_delivery_status(old.status, new.status);
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
    new.delivery_error := old.delivery_error;
  end if;
  return new;
end;
$$;
