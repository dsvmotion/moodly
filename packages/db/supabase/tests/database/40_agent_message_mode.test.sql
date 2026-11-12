-- El agente solo escribe en una conversación que lleva él (20261111220000,
-- auditoría de preproducción R-02). Que «tomar el control» y el mensaje del
-- agente no se crucen con dos conexiones a la vez lo prueba el worker
-- (agents/converse.integration.ts); aquí, la regla y sus excepciones.
begin;
\ir _fixtures/tenants.psql
select plan(16);

select id as agent_a from public.agents where organization_id = :org_a order by id limit 1 \gset
select id as agent_b from public.agents where organization_id = :org_b order by id limit 1 \gset

-- Datos (la plataforma, como el worker).
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-a1', 'customer', 'active') returning id as ca_a \gset
insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_b, :loc_b1, 'webchat', 'web-b1', 'customer', 'active') returning id as ca_b \gset
insert into public.contacts (organization_id, display_name) values (:org_a, 'Ana') returning id as c_ana \gset
insert into public.contacts (organization_id, display_name) values (:org_b, 'Bea') returning id as c_bea \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a') returning id as conv \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
values (:org_a, :loc_a1, :'c_ana', :'ca_a', :'agent_a', 'closed') returning id as conv_closed \gset
insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id)
values (:org_b, :loc_b1, :'c_bea', :'ca_b', :'agent_b') returning id as conv_b \gset

-- ===========================================================================
-- 1. Con la conversación en manos del agente, escribe
-- ===========================================================================
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
           values (%L, %L, 'out', 'agent', 'Hola, Ana', 'sent', 'run-1:reply')$$, :org_a, :'conv'),
  'con la conversación en manos del agente, su mensaje se guarda');

-- ===========================================================================
-- 2. Con la conversación en manos de una persona, no
-- ===========================================================================
-- Toma el control alguien del equipo del local, como desde la bandeja.
select pg_temp.login(:a_staff1) as s \gset
update public.conversations set mode = 'human' where id = :'conv';
reset role;

select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
           values (%L, %L, 'out', 'agent', 'Te reservo a las 9', 'sent', 'run-2:reply')$$, :org_a, :'conv'),
  '55000', null,
  'después de tomar el control, el mensaje del agente no se guarda (ni con la clave secreta del worker)');
select is((select count(*)::int from public.messages where idempotency_key = 'run-2:reply'), 0, 'y no queda nada');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
           values (%L, %L, 'out', 'agent', 'Recordatorio: mañana a las 9', 'sent', 'reminder:1')$$, :org_a, :'conv'),
  '55000', null, 'tampoco un recordatorio ni una oferta: cualquier mensaje del agente');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           values (%L, %L, 'out', 'agent', 'Sin clave', 'sent')$$, :org_a, :'conv'),
  '55000', null, 'ni uno sin clave de ejecución');

-- Lo demás sigue entrando.
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content)
           values (%L, %L, 'in', 'contact', '¿Sigues ahí?')$$, :org_a, :'conv'),
  'el cliente sigue escribiendo');
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           values (%L, %L, 'out', 'system', 'El equipo ha tomado el control.', 'sent')$$, :org_a, :'conv'),
  'y los avisos del sistema');
select pg_temp.login(:a_staff1) as s \gset
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, content) values (%L, %L, 'Hola Ana, soy del equipo')$$, :org_a, :'conv'),
  'y el equipo, que es quien la lleva');
reset role;
select is((select author from public.messages where content = 'Hola Ana, soy del equipo'), 'user', 'como equipo, no como agente');

-- La confirmación de la baja de los recordatorios (4e-3) se contesta aunque la lleve una persona.
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
           values (%L, %L, 'out', 'agent', 'Hecho: ya no te enviaremos recordatorios de tus citas.', 'sent', %L)$$,
         :org_a, :'conv', 'opt-out:' || gen_random_uuid()),
  'la confirmación de la baja (clave opt-out:) sí sale: es de la plataforma, no del modelo');

-- ===========================================================================
-- 3. Cerrada, de otra organización o que no existe: tampoco
-- ===========================================================================
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           values (%L, %L, 'out', 'agent', 'x', 'sent')$$, :org_a, :'conv_closed'),
  '55000', null, 'en una conversación cerrada, el agente no escribe');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           values (%L, %L, 'out', 'agent', 'x', 'sent')$$, :org_a, :'conv_b'),
  '55000', null, 'con la organización de otra conversación, no se guarda (la de B, aunque la lleve su agente)');
select throws_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status)
           values (%L, %L, 'out', 'agent', 'x', 'sent')$$, :org_a, gen_random_uuid()),
  '55000', null, 'ni en una conversación que no existe');

-- ===========================================================================
-- 4. Al devolverla, el agente vuelve a escribir
-- ===========================================================================
select pg_temp.login(:a_staff1) as s \gset
update public.conversations set mode = 'agent' where id = :'conv';
reset role;
select lives_ok(
  format($$insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
           values (%L, %L, 'out', 'agent', 'Aquí estoy de nuevo', 'sent', 'run-3:reply')$$, :org_a, :'conv'),
  'devuelta al agente, su mensaje vuelve a guardarse');

-- ===========================================================================
-- 5. La función
-- ===========================================================================
select is((select prosecdef from pg_proc where oid = 'private.guard_agent_message_mode()'::regprocedure), false,
  'no es security definer: se ejecuta con los permisos de quien inserta');
select ok(
  not has_function_privilege('authenticated', 'private.guard_agent_message_mode()', 'execute')
  and not has_function_privilege('anon', 'private.guard_agent_message_mode()', 'execute'),
  'y nadie la llama directamente');

select * from finish();
rollback;
