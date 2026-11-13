-- El paso a una persona, con aviso (CU3): cuando el agente pasa una
-- conversación a una persona, el equipo se entera. Hoy el paso solo pasaba por
-- un fallo técnico y no avisaba a nadie.
--
-- Todas las causas del paso acaban en lo mismo: conversations.mode pasa de
-- 'agent' a 'human' por la plataforma (el worker: el modelo falla, la respuesta
-- se rechaza, el tope del 100 % del gasto, lo retenido de R-02, y las que se
-- añadan). Por eso el aviso sale de esa transición, aquí, y no del turno.
--
-- 1. conversation.handed_off: un evento de dominio por paso, en la misma
--    transacción que el cambio de modo (outbox, ADR 0009). Solo ids: la
--    organización y el local son columnas del evento, sacadas de la fila.
--    - Solo si lo cambia la plataforma (current_user distinto de authenticated,
--      en el WHEN del trigger, que se evalúa con el rol de quien actualiza):
--      una persona que toma el control desde la bandeja no avisa a nadie.
--    - Uno por paso, por construcción: el trigger solo dispara al cambiar de
--      'agent' a 'human'. Si el worker repite el paso, la fila ya está en
--      'human' y no dispara. Si se la devuelven al agente y la vuelve a pasar,
--      es otro paso y otro aviso.
--    - Ni en el chat de pruebas de la app (canal test): quien prueba ya está
--      mirando; sin evento no hay email ni aviso en la bandeja (V10).
--    - Y un Broadcast privado «handoff» al tema de la bandeja de su local
--      (#216, ADR 0054), solo con el id: la bandeja abierta lo enseña al momento.
--
-- 2. handoff_notification: lo que el worker necesita para el email, de una
--    sola organización: la conversación, su cliente, su agente, su local y a
--    quién se envía. A quién se envía sale solo de la base de datos y con la
--    misma regla con la que RLS deja tomar el control (conversations_takeover:
--    private.can_see_scope): el org_admin de la organización, y quien llega a
--    su local (region_manager por sus regiones; location_manager y staff por
--    sus locales). Sin local, solo el org_admin. Las mismas exclusiones que el
--    aviso de las aprobaciones (M-02): ni una cuenta baneada, borrada o sin
--    email confirmado, ni una organización que no está activa. Solo la ejecuta
--    service_role, y tenantDb.handoffNotification le pasa la organización de
--    su acceso: nunca la elige quien llama.
--
-- Funciones security definer:
-- - emit_conversation_handed_off escribe en domain_events (service_role no
--   tiene INSERT en la tabla), como emit_approval_created: una sola fila, con
--   la organización y el local de la conversación y sin datos personales, y
--   manda el Broadcast. No escribe en ninguna otra tabla de tenants. Es un
--   trigger y nadie la puede llamar directamente.
-- - handoff_notification solo lee; corre como su dueño para leer el email de
--   auth.users, que la API no expone. Solo service_role la ejecuta.
-- Tests en negativo en 51_conversation_handed_off.
--
-- Vuelta atrás (rollbacks/20261112200000_conversation_handed_off.down.sql):
--   drop function public.handoff_notification(uuid, uuid);
--   drop trigger emit_conversation_handed_off on public.conversations;
--   drop function private.emit_conversation_handed_off();
--   (los eventos conversation.handed_off ya escritos se quedan: sin consumidor,
--   el worker de la versión anterior solo los registra)

-- ---------------------------------------------------------------------------
-- 1. conversation.handed_off
-- ---------------------------------------------------------------------------
create function private.emit_conversation_handed_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_events (organization_id, location_id, type, payload)
  values (new.organization_id, new.location_id, 'conversation.handed_off',
          jsonb_build_object('conversation_id', new.id, 'agent_id', new.agent_id));
  -- Como broadcast_inbox_change: si Realtime falla, el paso y el evento se
  -- guardan igual (realtime.send no corta la transacción) y queda el email.
  perform realtime.send(
    jsonb_build_object('conversation_id', new.id),
    'handoff', private.inbox_topic(new.organization_id, new.location_id), true);
  return null;
end;
$$;

revoke all on function private.emit_conversation_handed_off() from public, anon, authenticated, service_role;

create trigger emit_conversation_handed_off after update of mode on public.conversations
  for each row
  when (old.mode = 'agent' and new.mode = 'human' and current_user <> 'authenticated'
        and new.channel is distinct from 'test')
  execute function private.emit_conversation_handed_off();

-- ---------------------------------------------------------------------------
-- 2. handoff_notification
-- ---------------------------------------------------------------------------
create function public.handoff_notification(p_organization_id uuid, p_conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', c.id,
      'mode', c.mode,
      'channel', c.channel,
      'location_id', c.location_id
    ),
    'contact', jsonb_build_object('display_name', ct.display_name),
    'agent', jsonb_build_object('display_name', a.display_name, 'type_key', t.key, 'type_name', t.name),
    'organization', jsonb_build_object('default_locale', o.default_locale),
    'location', case when l.id is null then null
                     else jsonb_build_object('name', l.name, 'timezone', l.timezone) end,
    'recipients', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', au.email, 'locale', u.locale)
                       order by m.user_id)
      from public.memberships m
      join public.users u on u.id = m.user_id
      join auth.users au on au.id = m.user_id
      where m.organization_id = c.organization_id
        and o.status = 'active'
        and au.email is not null
        and au.email_confirmed_at is not null
        and au.deleted_at is null
        and (au.banned_until is null or au.banned_until <= now())
        and (
          m.role = 'org_admin'
          or (l.id is not null and m.role = 'region_manager' and l.region_id = any (m.scope_region_ids))
          or (l.id is not null and m.role in ('location_manager', 'staff') and l.id = any (m.scope_location_ids))
        )
    ), '[]'::jsonb)
  )
  from public.conversations c
  join public.contacts ct on ct.id = c.contact_id and ct.organization_id = c.organization_id
  join public.agents a on a.id = c.agent_id and a.organization_id = c.organization_id
  join public.agent_types t on t.id = a.agent_type_id
  join public.organizations o on o.id = c.organization_id
  left join public.locations l on l.id = c.location_id and l.organization_id = c.organization_id
  where c.id = p_conversation_id and c.organization_id = p_organization_id;
$$;

revoke all on function public.handoff_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.handoff_notification(uuid, uuid) to service_role;
