-- Aviso por email de las aprobaciones nuevas (auditoría de preproducción, M-02;
-- decisión de producto 10): al crearse una aprobación, las personas que pueden
-- decidirla reciben «una aprobación te espera». El envío lo hace el worker.
--
-- 1. approval.created: un evento de dominio por aprobación nueva, en la misma
--    transacción que la aprobación (outbox, ADR 0009). Solo ids: la
--    organización y el local son columnas del evento, sacadas de la fila.
--
-- 2. approval_notification: lo que el worker necesita para el aviso, de una
--    sola organización: la aprobación, el agente, el local y a quién se envía.
--    A quién se envía sale solo de la base de datos y con la misma regla que
--    private.can_decide_approval (la política approvals_decide): el org_admin
--    de la organización, y quien tiene un rol igual o superior al que pide la
--    aprobación y llega a su local (region_manager por sus regiones;
--    location_manager y staff por sus locales). Sin local, solo el org_admin.
--    Lo financiero y lo destructivo no se lo pide a quien lo pidió. Tampoco a
--    una cuenta baneada, borrada o sin email confirmado, ni en una organización
--    que no está activa. Solo la ejecuta service_role, y
--    tenantDb.approvalNotification le pasa la organización de su acceso: nunca
--    la elige quien llama (como agent_turn_context).
--
-- Funciones security definer:
-- - emit_approval_created escribe en domain_events (service_role no tiene
--   INSERT en la tabla), como emit_approval_decided: una sola fila, con la
--   organización y el local de la aprobación recién creada y sin datos
--   personales. Es un trigger y nadie la puede llamar directamente. Las
--   aprobaciones solo las crea la plataforma (authenticated no tiene INSERT).
-- - approval_notification solo lee; corre como su dueño para leer el email de
--   auth.users, que la API no expone. Solo service_role la ejecuta.
-- Tests en negativo en 40_approval_created.
--
-- Vuelta atrás:
--   drop function public.approval_notification(uuid, uuid);
--   drop trigger emit_approval_created on public.approvals;
--   drop function private.emit_approval_created();
--   (los eventos approval.created ya escritos se quedan: sin consumidor, el
--   worker de la versión anterior solo los registra)

-- ---------------------------------------------------------------------------
-- 1. approval.created
-- ---------------------------------------------------------------------------
create function private.emit_approval_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_events (organization_id, location_id, type, payload, source_run_id)
  select new.organization_id, new.location_id, 'approval.created',
         jsonb_build_object('approval_id', new.id, 'execution_id', new.execution_id, 'run_id', e.run_id),
         e.run_id
  from public.executions e
  where e.id = new.execution_id;
  return null;
end;
$$;

revoke all on function private.emit_approval_created() from public, anon, authenticated, service_role;

create trigger emit_approval_created after insert on public.approvals
  for each row
  when (new.status = 'pending')
  execute function private.emit_approval_created();

-- ---------------------------------------------------------------------------
-- 2. approval_notification
-- ---------------------------------------------------------------------------
create function public.approval_notification(p_organization_id uuid, p_approval_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'approval', jsonb_build_object(
      'id', ap.id,
      'status', ap.status,
      'reason', ap.reason,
      'created_at', ap.created_at,
      'expires_at', ap.expires_at,
      'location_id', ap.location_id
    ),
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
      where m.organization_id = ap.organization_id
        and o.status = 'active'
        and au.email is not null
        and au.email_confirmed_at is not null
        and au.deleted_at is null
        and (au.banned_until is null or au.banned_until <= now())
        and private.member_role_rank(m.role) >= private.member_role_rank(ap.required_role)
        and (
          m.role = 'org_admin'
          or (l.id is not null and m.role = 'region_manager' and l.region_id = any (m.scope_region_ids))
          or (l.id is not null and m.role in ('location_manager', 'staff') and l.id = any (m.scope_location_ids))
        )
        and (ap.effect_class not in ('financial', 'destructive') or ap.requested_by is distinct from m.user_id)
    ), '[]'::jsonb)
  )
  from public.approvals ap
  join public.executions e on e.id = ap.execution_id and e.organization_id = ap.organization_id
  join public.agent_runs r on r.id = e.run_id and r.organization_id = ap.organization_id
  join public.agents a on a.id = r.agent_id and a.organization_id = ap.organization_id
  join public.agent_types t on t.id = a.agent_type_id
  join public.organizations o on o.id = ap.organization_id
  left join public.locations l on l.id = ap.location_id and l.organization_id = ap.organization_id
  where ap.id = p_approval_id and ap.organization_id = p_organization_id;
$$;

revoke all on function public.approval_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approval_notification(uuid, uuid) to service_role;
