-- O-01 sobre PL-T1 (20261112230000): moodly_worker escribe lo que entra por un
-- canal (el evento y sus estados, el contacto y su identidad, la conversación y
-- el mensaje del cliente), solo en su organización y solo las columnas que usa
-- la entrada; las guardas de siempre actúan también para él; service_role queda
-- igual.
begin;
\ir _fixtures/tenants.psql
select plan(32);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'w51-a1', 'customer', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'webchat', 'w51-b1', 'customer', 'active') returning id as ca_b \gset
insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
values (:org_b, :'ca_b', 'e51-b', '{"text":"de B"}');
insert into public.contacts (organization_id, display_name) values (:org_b, 'Berta') returning id as c_b \gset

-- Privilegios, exactos.
select is(
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'INSERT'
     and table_name in ('contact_identities', 'contacts', 'conversations', 'inbound_events')),
  'contact_identities.contact_id, contact_identities.external_id, contact_identities.kind, contact_identities.organization_id, '
  || 'contacts.display_name, contacts.organization_id, '
  || 'conversations.agent_id, conversations.channel, conversations.channel_account_id, conversations.contact_id, conversations.location_id, conversations.organization_id, '
  || 'inbound_events.channel_account_id, inbound_events.organization_id, inbound_events.payload, inbound_events.provider_event_id',
  'lo que inserta la entrada, columna a columna (ni el modo ni la persona asignada de una conversación)');
select is(
  (select string_agg(column_name, ', ' order by column_name) from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'INSERT' and table_name = 'messages'),
  'attachments, author, content, conversation_id, direction, external_message_id, idempotency_key, organization_id, status',
  'de un mensaje, lo de la respuesta del agente y lo del mensaje del cliente');
select is(
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'UPDATE'
     and table_name in ('contact_identities', 'contacts', 'conversations', 'domain_events', 'inbound_events')),
  'conversations.mode, inbound_events.attempts, inbound_events.conversation_id, inbound_events.error_code, inbound_events.message_id, inbound_events.status',
  'de un evento solo cambia su estado y lo que creó; del contacto y su identidad, nada');
select is(
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
   from information_schema.column_privileges
   where grantee = 'moodly_worker' and privilege_type = 'SELECT' and table_name in ('contact_identities', 'contacts', 'domain_events')),
  'contact_identities.contact_id, contact_identities.external_id, contact_identities.kind, contact_identities.organization_id, '
  || 'contacts.id, contacts.organization_id, domain_events.id, domain_events.organization_id, domain_events.payload, domain_events.type',
  'lee solo lo que necesita del contacto, su identidad y el evento de su mensaje');
select ok(not has_table_privilege('moodly_worker', 'public.inbound_events', 'delete')
          and not has_table_privilege('moodly_worker', 'public.contacts', 'delete')
          and not has_table_privilege('moodly_worker', 'public.contact_identities', 'delete')
          and not has_table_privilege('moodly_worker', 'public.conversations', 'delete')
          and not has_table_privilege('moodly_worker', 'public.domain_events', 'insert')
          and not has_table_privilege('moodly_worker', 'public.inbound_events', 'truncate'),
  'no borra eventos, contactos, identidades ni conversaciones, ni escribe eventos de dominio');
select ok(not (select prosecdef from pg_proc where oid = 'private.guard_worker_message()'::regprocedure),
  'la guarda del worker sigue siendo invoker');

-- Como moodly_worker, con A fijada (solo para este test; ver 42_worker_role).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset

-- El evento.
select lives_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'e51-1', '{"text":"Hola"}')$$, :org_a, :'ca_a'),
  'guarda lo que llega a una cuenta de su organización');
select is((select count(*)::int from public.inbound_events where provider_event_id = 'e51-b'), 0, 'no ve los eventos de otra');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
           values (%L, %L, 'e51-2', '{}')$$, :org_b, :'ca_b'),
  '42501', null, 'ni guarda eventos para otra organización (RLS, WITH CHECK)');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload, status)
           values (%L, %L, 'e51-3', '{}', 'processed')$$, :org_a, :'ca_a'),
  '42501', null, 'ni elige el estado al guardarlo (columna sin privilegio)');
select lives_ok($$update public.inbound_events set status = 'failed', attempts = 1, error_code = 'x' where provider_event_id = 'e51-1'$$,
  'apunta un intento fallido');
select throws_ok($$update public.inbound_events set attempts = 0 where provider_event_id = 'e51-1'$$, '42501', null,
  'los intentos no bajan (guard_inbound_event_attempts actúa para él)');
select throws_ok($$update public.inbound_events set payload = '{"text":"otro"}' where provider_event_id = 'e51-1'$$, '42501', null,
  'no cambia lo que llegó (columna sin privilegio)');
select throws_ok($$delete from public.inbound_events where provider_event_id = 'e51-1'$$, '42501', null, 'ni lo borra');

-- El contacto y su identidad.
-- Con RETURNING id (solo puede leer el id del contacto).
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
select isnt(:'c_ana'::uuid, null, 'crea el contacto de quien escribe (y lee su id)');
select throws_ok(format($$insert into public.contacts (organization_id, display_name) values (%L, 'Otro')$$, :org_b), '42501', null,
  'no crea contactos en otra organización');
select throws_ok(format($$update public.contacts set display_name = 'Otra' where id = %L$$, :'c_ana'), '42501', null,
  'no cambia un contacto');
select throws_ok(format($$delete from public.contacts where id = %L$$, :'c_ana'), '42501', null, 'ni lo borra');
select lives_ok(
  format($$insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (%L, %L, 'webchat', 'v51-1')$$,
         :org_a, :'c_ana'),
  'guarda la identidad del contacto en el canal');
select throws_ok(
  format($$insert into public.contact_identities (organization_id, contact_id, kind, external_id) values (%L, %L, 'webchat', 'v51-2')$$,
         :org_b, :'c_b'),
  '42501', null, 'no guarda identidades en otra organización');

-- La conversación.
select lives_ok(
  format($$insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, channel, agent_id)
           values (%L, %L, %L, %L, 'webchat', %L)$$, :org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a'),
  'abre la conversación del contacto con el agente de la cuenta');
reset role;
select id as conv from public.conversations where contact_id = :'c_ana' \gset
select results_eq(format($$select mode, assigned_user_id from public.conversations where id = %L$$, :'conv'),
  $$values ('agent'::text, null::uuid)$$, 'nace con el agente y sin persona asignada');
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org2 \gset
select throws_ok(
  format($$insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, channel, agent_id, mode)
           values (%L, %L, %L, %L, 'webchat', %L, 'human')$$, :org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a'),
  '42501', null, 'no elige el modo de una conversación nueva (columna sin privilegio)');

-- El mensaje del cliente.
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
           values (%L, %L, 'in', 'contact', 'Hola', 'received', 'pm51-1')$$, :org_a, :'conv'),
  'guarda el mensaje del cliente, con la clave del proveedor');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           values (%L, %L, 'in', 'contact', 'Hola', 'received')$$, :org_a, :'conv'),
  '42501', null, 'sin la clave del proveedor no es un mensaje que entra: no lo escribe (guard_worker_message)');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
           values (%L, %L, 'out', 'agent', 'Hola', 'sent', 'pm51-2')$$, :org_a, :'conv'),
  '42501', null, 'ni una respuesta del agente con la clave de un mensaje del proveedor');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, external_message_id)
           values (%L, %L, 'in', 'contact', 'Hola', 'sent', 'pm51-3')$$, :org_a, :'conv'),
  '42501', null, 'ni un mensaje del cliente que no esté en received');

-- El evento procesado y el evento de dominio de su mensaje.
select id as msg from public.messages where external_message_id = 'pm51-1' \gset
select lives_ok(
  format($$update public.inbound_events set status = 'processed', conversation_id = %L, message_id = %L, error_code = null
           where provider_event_id = 'e51-1'$$, :'conv', :'msg'),
  'marca el evento procesado, con su conversación y su mensaje');
select throws_ok($$update public.inbound_events set status = 'failed' where provider_event_id = 'e51-1'$$, '42501', null,
  'un evento procesado ya no cambia (guard_inbound_event actúa para él)');
select is(
  (select count(*)::int from public.domain_events where type = 'message.received' and payload->>'message_id' = :'msg'),
  1, 'lee el message.received de su mensaje (para encolar el turno ya)');
select throws_ok(
  format($$insert into public.domain_events (organization_id, type, payload) values (%L, 'message.received', '{}')$$, :org_a),
  '42501', null, 'pero no escribe eventos de dominio');
reset role;

-- service_role, igual que antes.
set local role service_role;
select lives_ok(format($$delete from public.contacts where id = %L$$, :'c_b'), 'service_role puede borrar un contacto');
reset role;

select * from finish();
rollback;
