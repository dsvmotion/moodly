-- La entrada de los canales y los estados de entrega (20261112030000, ADR 0052
-- §2 y §4): un evento de un proveedor, una sola vez y de la organización de su
-- cuenta; lo que llegó no cambia; quién lo lee; y lo que sale solo avanza de
-- estado.
begin;
\ir _fixtures/tenants.psql
select plan(28);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset

-- Datos (la plataforma, como el proceso de entrada).
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-a1', 'customer', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'webchat', 'web-b1', 'customer', 'active') returning id as ca_b \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a') returning id as conv \gset

-- ===========================================================================
-- 1. Un evento, una vez, de la organización de su cuenta
-- ===========================================================================
select lives_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'evt-1', '{"text": "Hola"}')$$, :org_a, :'ca_a'),
  'el proceso de entrada guarda un evento');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'evt-1', '{"text": "Hola otra vez"}')$$, :org_a, :'ca_a'),
  '23505', null, 'el mismo evento de la misma cuenta no entra dos veces (el reintento del webhook)');
select lives_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'evt-1', '{"text": "Hola"}')$$, :org_b, :'ca_b'),
  'el mismo id de evento en otra cuenta es otro evento');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'evt-2', '{}')$$, :org_b, :'ca_a'),
  '23503', null, 'la organización es la de la cuenta del canal: otra no se puede poner');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'evt-3', '[]')$$, :org_a, :'ca_a'),
  '23514', null, 'el payload es un objeto (el mensaje normalizado)');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, '', '{}')$$, :org_a, :'ca_a'),
  '23514', null, 'sin id de evento no hay evento');

-- ===========================================================================
-- 2. Lo que llegó no cambia; el estado avanza
-- ===========================================================================
select id as evt from public.inbound_events where provider_event_id = 'evt-1' and organization_id = :org_a \gset
select throws_ok(
  format($$update public.inbound_events set payload = '{"text": "otra cosa"}' where id = %L$$, :'evt'),
  '42501', null, 'el payload no se cambia, ni con la clave secreta');
select throws_ok(
  format($$update public.inbound_events set provider_event_id = 'evt-x' where id = %L$$, :'evt'),
  '42501', null, 'ni el id del evento');
select lives_ok(
  format($$update public.inbound_events set status = 'failed', error_code = 'timeout' where id = %L$$, :'evt'),
  'si falla, queda como fallido con su código');
select lives_ok(
  format($$update public.inbound_events set status = 'processed', conversation_id = %L, error_code = null where id = %L$$, :'conv', :'evt'),
  'y se puede volver a intentar hasta procesarlo');
select isnt((select processed_at from public.inbound_events where id = :'evt'), null::timestamptz, 'processed_at lo pone la base de datos');
select throws_ok(
  format($$update public.inbound_events set status = 'failed' where id = %L$$, :'evt'),
  '42501', null, 'un evento procesado ya no cambia de estado');
update public.inbound_events set status = 'failed', error_code = 'timeout' where organization_id = :org_b;
select throws_ok(
  format($$update public.inbound_events set status = 'received' where organization_id = %L$$, :org_b),
  '42501', null, 'un evento fallido no vuelve a received');

-- ===========================================================================
-- 3. Quién lo lee y quién lo escribe
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s \gset
select is((select count(*)::int from public.inbound_events), 1, 'el org_admin ve los eventos de su organización y no los de otra');
reset role;
select pg_temp.login(:a_staff1) as s \gset
select is((select count(*)::int from public.inbound_events), 0, 'el resto del equipo no los ve');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'evt-falso', '{}')$$, :org_a, :'ca_a'),
  '42501', null, 'nadie de la app inventa un evento');
reset role;
select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$update public.inbound_events set status = 'ignored' where id = %L$$, :'evt'),
  '42501', null, 'ni el org_admin lo marca');
reset role;
select ok(not has_table_privilege('anon', 'public.inbound_events', 'select'), 'anon no lo lee');
select ok(not has_table_privilege('service_role', 'public.inbound_events', 'delete'), 'ni el worker lo borra');

-- ===========================================================================
-- 4. Lo que sale solo avanza de estado
-- ===========================================================================
insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
values (:org_a, :'conv', 'out', 'agent', 'Hola, Ana', 'pending', 'prov-1') returning id as m_out \gset

update public.messages set status = 'sent' where id = :'m_out';
select is((select status from public.messages where id = :'m_out'), 'sent', 'pending → sent');
select isnt((select status_changed_at from public.messages where id = :'m_out'), null::timestamptz, 'con la hora del cambio');
update public.messages set status = 'read' where id = :'m_out';
update public.messages set status = 'delivered' where id = :'m_out';
select is((select status from public.messages where id = :'m_out'), 'read', 'un «delivered» que llega después del «read» no lo hace retroceder');
update public.messages set status = 'failed', delivery_error = '131026' where id = :'m_out';
select is((select row(status, delivery_error)::text from public.messages where id = :'m_out'), row('read', null::text)::text,
  'un fallo después de leído no cuenta, ni se guarda su código');

insert into public.messages (organization_id, conversation_id, direction, author, content, status)
values (:org_a, :'conv', 'out', 'agent', 'Otro', 'sent') returning id as m_fail \gset
update public.messages set status = 'failed', delivery_error = '131047' where id = :'m_fail';
update public.messages set status = 'delivered' where id = :'m_fail';
select is((select row(status, delivery_error)::text from public.messages where id = :'m_fail'), row('failed', '131047')::text,
  'un fallo antes de entregarse es definitivo, con su código');
select throws_ok(
  format($$update public.messages set status = 'received' where id = %L$$, :'m_fail'),
  null, null, 'un mensaje que sale no pasa a received');

select is(private.next_delivery_status('pending', 'read'), 'read', 'next_delivery_status: avanza');
select is(private.next_delivery_status('delivered', 'sent'), 'delivered', 'next_delivery_status: no retrocede');
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p
   where p.oid in ('private.guard_inbound_event()'::regprocedure, 'private.guard_delivery_status()'::regprocedure,
                   'private.next_delivery_status(text, text)'::regprocedure)),
  'ninguna de las funciones nuevas es security definer');

select * from finish();
rollback;
