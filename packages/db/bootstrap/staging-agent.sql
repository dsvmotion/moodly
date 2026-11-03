-- Conversación de prueba con Recepción en la organización de demo de staging
-- (paso 4d-3). La ejecuta el workflow manual «Staging · agente»
-- (.github/workflows/staging-agent.yml), nunca a mano. Idempotente: con
-- identificadores fijos, una segunda ejecución no duplica nada.
--
-- Corre como postgres (plataforma): RLS no aplica y las guardas solo actúan con
-- `authenticated` (ADR 0003), así que aquí se respetan a mano. Sin datos
-- reales: un servicio, una sala, un canal de chat web y un contacto de prueba.
-- No pisa lo que haya cambiado producto: el horario solo se pone si está
-- vacío, y el agente solo pasa de draft a testing (nunca a live, nunca despausa).
-- Un solo comando (`supabase db query --file` no admite varios).

do $$
declare
  org_id          constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01';
  centro_id       constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d21';
  service_id      constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e01';
  resource_id     constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e11';
  channel_id      constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e21';
  contact_id      constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e31';
  conversation_id constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e41';
  reception_id    uuid;
begin
  if not exists (select 1 from public.organizations where id = org_id) then
    raise exception 'No existe la organización de demo: lanza antes «Staging · organización de demo».';
  end if;
  select a.id into reception_id
  from public.agents a
  join public.agent_types t on t.id = a.agent_type_id
  where a.organization_id = org_id and t.origin = 'builtin' and t.key = 'reception';
  if reception_id is null then
    raise exception 'La organización de demo no tiene agente de Recepción.';
  end if;

  update public.locations
  set opening_hours = '{"mon": ["09:00", "14:00"], "tue": ["09:00", "14:00"], "wed": ["09:00", "14:00"], "thu": ["09:00", "14:00"], "fri": ["09:00", "14:00"]}'::jsonb,
      updated_at = now()
  where id = centro_id and opening_hours = '{}'::jsonb;

  insert into public.services (id, organization_id, location_id, name, duration_minutes)
  values (service_id, org_id, null, 'Primera visita', 30)
  on conflict (id) do nothing;
  insert into public.booking_resources (id, organization_id, location_id, name, kind)
  values (resource_id, org_id, centro_id, 'Consulta 1', 'room')
  on conflict (id) do nothing;
  insert into public.resource_services (organization_id, resource_id, service_id)
  values (org_id, resource_id, service_id)
  on conflict do nothing;

  insert into public.channel_accounts (id, organization_id, location_id, channel, external_id, default_agent_type, status)
  values (channel_id, org_id, centro_id, 'webchat', 'staging-agent-check', 'reception', 'active')
  on conflict (id) do nothing;
  insert into public.contacts (id, organization_id, display_name, locale)
  values (contact_id, org_id, 'Contacto de prueba', 'es')
  on conflict (id) do nothing;
  insert into public.conversations (id, organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
  values (conversation_id, org_id, centro_id, contact_id, channel_id, reception_id, 'agent')
  on conflict (id) do nothing;

  update public.agents set status = 'testing', updated_at = now() where id = reception_id and status = 'draft';
end
$$;
