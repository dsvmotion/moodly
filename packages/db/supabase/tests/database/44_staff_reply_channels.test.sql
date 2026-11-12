-- M-01 (20261112040700): el equipo solo escribe al cliente desde la bandeja por
-- un canal que hace llegar el mensaje (hoy el chat web y el de pruebas). Por los
-- demás, la base de datos lo rechaza; la plataforma (el worker) sigue pudiendo
-- escribir por cualquiera.
begin;
\ir _fixtures/tenants.psql
select plan(9);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset

-- Una conversación de A1, en manos del equipo, por cada canal.
create temp table rt_conv (channel text primary key, conv uuid);
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
select :org_a, :loc_a1, ch, 'rc-' || ch, 'customer', 'active'
from unnest(array['webchat', 'whatsapp', 'instagram', 'email', 'voice']) ch;
with c as (
  insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
  select :org_a, :loc_a1, :'c_ana', a.id, :'agent_a', 'human'
  from public.channel_accounts a where a.organization_id = :org_a and a.external_id like 'rc-%'
  returning id, channel
)
insert into rt_conv select channel, id from c;
grant select on rt_conv to authenticated, service_role;

create function pg_temp.staff_writes(p_channel text) returns void language sql as $$
  insert into public.messages (organization_id, conversation_id, content)
  select c.organization_id, c.id, 'Hola, soy Laura del equipo'
  from rt_conv r join public.conversations c on c.id = r.conv where r.channel = p_channel;
$$;

select pg_temp.login(:a_staff1) as s \gset
select lives_ok($$select pg_temp.staff_writes('webchat')$$, 'por el chat web, el equipo escribe al cliente');
select throws_ok($$select pg_temp.staff_writes('whatsapp')$$, '42501', null, 'por WhatsApp, no (todavía no hay envío)');
select throws_ok($$select pg_temp.staff_writes('instagram')$$, '42501', null, 'por Instagram, no');
select throws_ok($$select pg_temp.staff_writes('email')$$, '42501', null, 'por email, no');
select throws_ok($$select pg_temp.staff_writes('voice')$$, '42501', null, 'por voz, no');
reset role;

select results_eq(
  $$select m.status from public.messages m join rt_conv r on r.conv = m.conversation_id where r.channel = 'webchat'$$,
  $$values ('sent'::text)$$,
  'lo del chat web nace enviado (el widget lee la fila)');
select is(
  (select count(*)::int from public.messages m join rt_conv r on r.conv = m.conversation_id where r.channel <> 'webchat'),
  0, 'y por los demás canales no queda ningún mensaje pendiente para siempre');

-- La plataforma no queda bloqueada: el worker escribe por cualquier canal.
set local role service_role;
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           select %L, conv, 'out', 'agent', 'Hola, soy el agente', 'pending' from rt_conv where channel = 'whatsapp'$$, :org_a),
  'el worker sigue escribiendo por WhatsApp (lo envía su canal)');
reset role;
select is(
  (select status from public.messages m join rt_conv r on r.conv = m.conversation_id where r.channel = 'whatsapp'),
  'pending', 'y su mensaje queda pendiente de enviar, como antes');

select * from finish();
rollback;
