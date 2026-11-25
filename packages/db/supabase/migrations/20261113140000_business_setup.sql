-- Ajustes del negocio desde la app (OA04): servicios con su precio, equipo y
-- recursos, qué servicios hace cada uno y el horario de cada local. Decisión de
-- producto n.º 13 (MANUAL §17): «Horarios, servicios y precios, como admin y
-- con MFA».
--
-- - services: precio en céntimos (null = sin precio publicado) y moneda de una
--   lista corta. El agente todavía no lo dice: eso llega en otro PR, con evals.
-- - services, booking_resources y resource_services: el org_admin con aal2 los
--   crea y los cambia; nadie más desde la app. No se borran servicios ni
--   recursos (las citas apuntan a ellos): se desactivan con active = false. Lo
--   que hace cada recurso (resource_services) sí se quita.
-- - Qué columnas se pueden escribir lo dicen los grants por columna: la
--   organización, el local y la referencia externa no cambian desde la app.
-- - Lo sincronizado desde una integración (external_ref) no se toca desde la
--   app: la próxima sincronización lo pisaría. Guarda guard_synced_*.
-- - locations.opening_hours: un CHECK con el formato que ya leen
--   find_booking_slots y la validación de citas: {"mon": ["09:00", "14:00"], …},
--   días mon…sun, horas HH:MM y apertura antes del cierre. Se añade NOT VALID
--   (vale para toda escritura nueva) y se valida en la misma migración si todas
--   las filas ya lo cumplen; si alguna no, la migración no falla y avisa (ver §3).
--
-- - public.set_resource_services: cambia lo que hace un recurso en una sola
--   transacción (invoker, con RLS y guardas).
--
-- Vuelta atrás: rollbacks/20261113140000_business_setup.down.sql (quita la
-- función, políticas, grants, guardas, el CHECK y las columnas de precio). No hay datos
-- de clientes todavía.

-- ---------------------------------------------------------------------------
-- 1. Precio de los servicios
-- ---------------------------------------------------------------------------
alter table public.services
  add column price_cents int check (price_cents between 0 and 10000000),
  add column currency text not null default 'EUR' check (currency in ('EUR', 'GBP', 'USD'));

comment on column public.services.price_cents is 'Precio en céntimos de currency; null = sin precio publicado (OA04).';
comment on column public.services.currency is 'Moneda del precio (ISO 4217), de una lista corta (OA04).';

-- ---------------------------------------------------------------------------
-- 2. Lo sincronizado desde una integración no se cambia desde la app
-- ---------------------------------------------------------------------------
-- Solo para authenticated (ADR 0003): el worker que sincroniza sí lo cambia.
create function private.guard_synced_booking_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and old.external_ref is not null then
    raise exception 'esto viene de una integración: se cambia allí' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_synced_booking_row() from public;

create trigger guard_synced before update on public.services
  for each row execute function private.guard_synced_booking_row();
create trigger guard_synced before update on public.booking_resources
  for each row execute function private.guard_synced_booking_row();

-- Qué hace un recurso sincronizado, o quién hace un servicio sincronizado,
-- también viene de la integración. Invoker: lee con los permisos de quien
-- escribe (el org_admin ve toda su organización).
create function private.guard_synced_resource_service()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  row_ public.resource_services := case when tg_op = 'DELETE' then old else new end;
begin
  if current_user = 'authenticated' and (
    exists (select 1 from public.booking_resources r
            where r.id = row_.resource_id and r.organization_id = row_.organization_id and r.external_ref is not null)
    or exists (select 1 from public.services s
               where s.id = row_.service_id and s.organization_id = row_.organization_id and s.external_ref is not null)
  ) then
    raise exception 'esto viene de una integración: se cambia allí' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.guard_synced_resource_service() from public;

create trigger guard_synced before insert or delete on public.resource_services
  for each row execute function private.guard_synced_resource_service();

-- ---------------------------------------------------------------------------
-- 3. Formato del horario de los locales
-- ---------------------------------------------------------------------------
create function private.valid_opening_hours(hours jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(hours) = 'object'
    and not exists (
      select 1
      from jsonb_each(hours) as d(day, span)
      where d.day not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
         or jsonb_typeof(d.span) <> 'array'
         or jsonb_array_length(d.span) <> 2
         or jsonb_typeof(d.span -> 0) <> 'string'
         or jsonb_typeof(d.span -> 1) <> 'string'
         or (d.span ->> 0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (d.span ->> 1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (d.span ->> 0) >= (d.span ->> 1)
    );
$$;
revoke all on function private.valid_opening_hours(jsonb) from public;
grant execute on function private.valid_opening_hours(jsonb) to authenticated, service_role;

-- NOT VALID: vale ya para toda escritura nueva, sin depender de lo que hay.
alter table public.locations
  add constraint locations_opening_hours_format check (private.valid_opening_hours(opening_hours)) not valid;

-- Si todo lo que hay ya lo cumple (staging: '{}' o el horario de lunes a viernes
-- de bootstrap/staging-agent.sql), se valida aquí. Si no, la migración no falla:
-- avisa, y esas filas siguen como están hasta que alguien las arregle (cualquier
-- cambio de esa fila exigirá un horario válido).
do $$
declare
  invalid int;
begin
  select count(*) into invalid from public.locations where not private.valid_opening_hours(opening_hours);
  if invalid = 0 then
    alter table public.locations validate constraint locations_opening_hours_format;
  else
    raise warning 'locations_opening_hours_format queda NOT VALID: % local(es) con un horario fuera de formato', invalid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Quién escribe: el org_admin, con aal2
-- ---------------------------------------------------------------------------
create policy services_insert on public.services
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy services_update on public.services
  for update to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy booking_resources_insert on public.booking_resources
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy booking_resources_update on public.booking_resources
  for update to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy resource_services_insert on public.resource_services
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy resource_services_delete on public.resource_services
  for delete to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']));

-- Por columna: lo que no está aquí no se escribe desde la app.
grant insert (organization_id, location_id, name, duration_minutes, active, price_cents, currency) on public.services to authenticated;
grant update (name, duration_minutes, active, price_cents, currency) on public.services to authenticated;
grant insert (organization_id, location_id, name, kind, active) on public.booking_resources to authenticated;
grant update (name, kind, active) on public.booking_resources to authenticated;
grant insert (organization_id, resource_id, service_id), delete on public.resource_services to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Qué hace un recurso, de una vez
-- ---------------------------------------------------------------------------
-- La app cambia los servicios de un recurso en una sola transacción: o todo o
-- nada (V10). Invoker: corre como quien llama, con RLS, los grants y las
-- guardas de siempre (solo el org_admin con aal2; nada sincronizado). Si RLS
-- dejara sin quitar alguno de los que hay que quitar, falla entera en vez de
-- quedarse a medias. Devuelve cuántos vínculos cambiaron.
create function public.set_resource_services(p_resource_id uuid, p_service_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_expected int;
  v_removed int;
  v_added int;
begin
  select organization_id into v_org from public.booking_resources where id = p_resource_id;
  if v_org is null then
    raise exception 'ese recurso no existe o no es tuyo' using errcode = '42501';
  end if;

  select count(*) into v_expected
  from public.resource_services
  where resource_id = p_resource_id and not (service_id = any (coalesce(p_service_ids, '{}')));
  delete from public.resource_services
  where resource_id = p_resource_id and not (service_id = any (coalesce(p_service_ids, '{}')));
  get diagnostics v_removed = row_count;
  if v_removed <> v_expected then
    raise exception 'no se pueden quitar los servicios de este recurso' using errcode = '42501';
  end if;

  -- Solo los que faltan: volver a insertar uno que ya está pasaría por las guardas sin necesidad.
  insert into public.resource_services (organization_id, resource_id, service_id)
  select v_org, p_resource_id, s.id
  from (select distinct unnest(coalesce(p_service_ids, '{}')) as id) s
  where not exists (select 1 from public.resource_services rs where rs.resource_id = p_resource_id and rs.service_id = s.id);
  get diagnostics v_added = row_count;

  return v_removed + v_added;
end;
$$;
revoke all on function public.set_resource_services(uuid, uuid[]) from public, anon;
grant execute on function public.set_resource_services(uuid, uuid[]) to authenticated;
