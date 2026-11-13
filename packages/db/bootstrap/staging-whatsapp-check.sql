-- Qué pasó de verdad por WhatsApp en staging (workflow «Staging · WhatsApp»,
-- acción check; docs/runbooks/whatsapp-staging.md). Lee la cuenta del número de
-- prueba de la organización de demo y su conversación más reciente.
--
-- Sin datos personales: ni teléfonos ni textos de los mensajes, solo estados,
-- horas y si hay wamid. Las comprobaciones:
--   webhook       llegó al menos un mensaje de Meta en las últimas 2 horas;
--   procesado     el último que llegó se convirtió en mensaje de la conversación;
--   respuesta     la última respuesta del agente salió con wamid de Meta (sent o más);
--   entregada     Meta avisó de que llegó al teléfono (delivered o read);
--   un_mensaje    gate M1: si los dos últimos mensajes del cliente llegaron
--                 seguidos (sin respuesta entre ellos), hay exactamente una
--                 respuesta después del segundo y ninguna entre los dos; null si
--                 no hay dos seguidos.
with account as (
  select id, status
  from public.channel_accounts
  where id = 'd5a3b7c2-1f4e-4c8a-9b6d-2e7f0a1c3e22' and channel = 'whatsapp'
),
events as (
  select e.status, e.received_at, e.conversation_id
  from public.inbound_events e
  where e.channel_account_id = (select id from account) and e.received_at > now() - interval '2 hours'
),
conversation as (
  select c.id, c.mode, c.agent_id
  from public.conversations c
  where c.channel_account_id = (select id from account)
  order by c.created_at desc
  limit 1
),
msgs as (
  select m.id, m.direction, m.author, m.status, m.external_message_id, m.delivery_error, m.created_at
  from public.messages m
  where m.conversation_id = (select id from conversation)
  order by m.created_at desc
  limit 20
),
contact_last as (
  select id, created_at, row_number() over (order by created_at desc) as n
  from msgs where author = 'contact'
),
last_reply as (
  select * from msgs where direction = 'out' and author = 'agent' order by created_at desc limit 1
),
pair as (
  select
    (select created_at from contact_last where n = 2) as first_at,
    (select created_at from contact_last where n = 1) as second_at
),
gate as (
  select
    count(*) filter (where m.created_at > p.first_at and m.created_at < p.second_at) as between_them,
    count(*) filter (where m.created_at > p.second_at) as after_second
  from pair p
  left join msgs m on m.direction = 'out' and m.author = 'agent'
  where p.first_at is not null
)
select
  (select status from account) as cuenta,
  (select count(*) from events) as webhooks_2h,
  (select json_object_agg(status, n) from (select status, count(*) as n from events group by status) s) as webhooks_por_estado,
  (select mode from conversation) as conversacion,
  (select a.status from public.agents a where a.id = (select agent_id from conversation)) as agente,
  (select coalesce(json_agg(json_build_object(
      'cuando', to_char(m.created_at at time zone 'UTC', 'HH24:MI:SS'),
      'quien', m.author,
      'estado', m.status,
      'wamid', m.external_message_id is not null,
      'error', m.delivery_error,
      'run', (select r.status from public.agent_runs r where r.trigger_ref = m.id::text limit 1)
    ) order by m.created_at), '[]'::json) from msgs m) as mensajes,
  (select coalesce(json_agg(json_build_object('skill', e.skill_key, 'estado', e.status, 'aprobacion', a.status) order by e.created_at), '[]'::json)
     from public.executions e
     join public.agent_runs r on r.id = e.run_id
     left join public.approvals a on a.execution_id = e.id
     where r.trigger_ref in (select id::text from msgs where author = 'contact')
       and e.status in ('drafted', 'needs_approval')) as pendientes_de_aprobar,
  json_build_object(
    'webhook', (select count(*) from events) > 0,
    'procesado', (select status = 'processed' from events order by received_at desc limit 1),
    'respuesta', (select status in ('sent', 'delivered', 'read') and external_message_id is not null from last_reply),
    'entregada', (select status in ('delivered', 'read') from last_reply),
    'un_mensaje', case when (select first_at from pair) is null then null
                       else (select between_them = 0 and after_second = 1 from gate) end
  ) as comprobaciones;
