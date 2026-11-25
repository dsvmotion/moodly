-- La cuenta de WhatsApp de la organización de demo de staging, con el número de
-- prueba de Meta (O-01, docs/runbooks/whatsapp-staging.md). La ejecuta el
-- workflow manual «Staging · WhatsApp» (acción setup), nunca a mano, después de
-- staging-agent.sql (que deja el servicio, la sala y Recepción en testing).
--
-- El workflow sustituye __PHONE_NUMBER_ID__ por el phone_number_id del número
-- de prueba (solo dígitos, lo comprueba antes): es el id que Meta pone en cada
-- webhook (metadata.phone_number_id) y del que sale la organización
-- (channel_accounts.external_id). No es un secreto.
--
-- Corre como postgres (plataforma): RLS no aplica y las guardas solo actúan con
-- `authenticated` (ADR 0003). Idempotente: con id fijo; si el número de prueba
-- cambia, actualiza external_id. Si ese phone_number_id ya es de otra cuenta,
-- falla (la clave única por canal y external_id): un número es de una sola
-- organización. Sin datos personales: el teléfono de quien prueba no se guarda
-- aquí, llega con su primer mensaje.

do $$
declare
  org_id     constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01';
  centro_id  constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d21';
  account_id constant uuid := 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e22';
  number_id  constant text := '__PHONE_NUMBER_ID__';
begin
  if number_id !~ '^[0-9]{5,30}$' then
    raise exception 'phone_number_id no válido';
  end if;
  if not exists (select 1 from public.organizations where id = org_id) then
    raise exception 'No existe la organización de demo: lanza antes «Staging · organización de demo».';
  end if;

  insert into public.channel_accounts (id, organization_id, location_id, channel, external_id, default_agent_type, status)
  values (account_id, org_id, centro_id, 'whatsapp', number_id, 'reception', 'active')
  on conflict (id) do update
    set external_id = excluded.external_id, status = 'active', updated_at = now()
    where public.channel_accounts.channel = 'whatsapp';
end
$$;
