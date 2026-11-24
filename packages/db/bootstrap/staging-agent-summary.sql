-- Qué hizo el agente con el último mensaje del contacto de prueba (workflow
-- «Staging · agente»). Sin datos personales: es una conversación de prueba.
-- `estado` es null mientras el worker no ha creado el run.
with last_in as (
  select id
  from public.messages
  where conversation_id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e41' and author = 'contact'
  order by created_at desc
  limit 1
),
run as (
  select r.*
  from public.agent_runs r
  where r.organization_id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3d01' and r.trigger_ref = (select id::text from last_in)
)
select
  (select status from run) as estado,
  (select model from run) as modelo,
  (select tokens_in from run) as tokens_entrada,
  (select tokens_out from run) as tokens_salida,
  (select cost_eur from run) as coste_eur,
  (select mode from public.conversations where id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e41') as conversacion,
  -- El precio de la primera visita en Ajustes (OA04): con el mensaje «precio», el
  -- workflow solo da por bueno un paso a una persona si no tiene precio.
  (select price_cents from public.services where id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e01') as precio_primera_visita,
  (select a.status from public.agents a join public.conversations c on c.agent_id = a.id
    where c.id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e41') as agente,
  (select coalesce(json_agg(json_build_object(
      'skill', e.skill_key, 'estado', e.status, 'autonomia', e.autonomy_applied, 'resumen', e.preview ->> 'summary'
    ) order by e.created_at), '[]'::json)
    from public.executions e where e.run_id = (select id from run)) as ejecuciones;
