-- Paso 4d-2: el agente contesta en las conversaciones (MANUAL §5.1).
--
-- 1. El catálogo de la plataforma: las skills de Recepción (paso 4c) y reply,
--    la respuesta del agente (paso 4d). Son de código y están publicadas. Su
--    clase de efecto, su versión y su autonomía por defecto son las de su
--    definición en @repo/skills (un test del worker comprueba que coinciden).
--    La entrada la valida el código (kind = 'code'): input_schema queda vacío.
-- 2. private.default_agent_skills: qué skills de la plataforma trae de serie
--    cada tipo de agente. Recepción: buscar, ver, reservar, mover y cancelar
--    citas, y responder. Atención al cliente: responder.
-- 3. Cada agente nace con ellas, con su autonomía por defecto: leer, sola;
--    escribir y responder, en draft (B1: «en draft al principio»). Lo mismo
--    para los agentes que ya existen.
-- 4. messages.idempotency_key: la ejecución que escribió el mensaje del agente
--    (reply). Con ella, un reintento devuelve el mensaje que ya existe en vez de
--    escribir otro. No puede ser única (messages está particionada por
--    created_at): el worker la busca antes de escribir, y DBOS garantiza que
--    cada workflow lo ejecuta un solo proceso a la vez.
-- 5. message.received: cada mensaje de un cliente (author = 'contact') emite
--    un evento de dominio en la misma transacción. La organización y el local
--    salen de la conversación (de las filas, nunca del contenido) y el payload
--    solo lleva ids. El worker lo consume (agent.converse) y ejecuta el turno.
--
-- Funciones security definer:
-- - emit_message_received escribe en domain_events, como emit_invitation_created:
--   un evento por mensaje de cliente, con el tenant de la conversación. Es un
--   trigger y nadie la puede llamar directamente.
-- - attach_default_skills y attach_default_skills_to no lo son: corren como
--   quien crea el agente, que solo puede ser la plataforma (authenticated no
--   tiene INSERT en agents).
--
-- Vuelta atrás:
--   alter table public.messages drop column idempotency_key;
--   drop trigger emit_message_received on public.messages;
--   drop function private.emit_message_received();
--   drop trigger attach_default_skills on public.agents;
--   drop function private.attach_default_skills(), private.attach_default_skills_to(uuid);
--   delete from public.agent_skills where skill_id in (select id from public.skills where organization_id is null and kind = 'code');
--   delete from public.skills where organization_id is null and kind = 'code';
--   drop table private.default_agent_skills;

-- ---------------------------------------------------------------------------
-- 1. Las skills de código de la plataforma.
-- ---------------------------------------------------------------------------
insert into public.skills
  (organization_id, key, version, kind, name, description, effect_class, default_autonomy, max_autonomy,
   restricted_to_agent_types, status)
values
  (null, 'find_slots', 1, 'code', 'Find free slots',
   'Finds free slots for a service at the location, up to 14 days ahead.',
   'read', 'autonomous', 'autonomous', '{reception}', 'published'),
  (null, 'list_my_appointments', 1, 'code', 'List the customer''s appointments',
   'Lists the upcoming appointments of the person the agent is talking to.',
   'read', 'autonomous', 'autonomous', '{reception}', 'published'),
  (null, 'book_appointment', 1, 'code', 'Book an appointment',
   'Books an appointment for the person the agent is talking to.',
   'internal_write', 'draft', 'autonomous', '{reception}', 'published'),
  (null, 'reschedule_appointment', 1, 'code', 'Reschedule an appointment',
   'Moves an appointment of the person the agent is talking to.',
   'internal_write', 'draft', 'autonomous', '{reception}', 'published'),
  (null, 'cancel_appointment', 1, 'code', 'Cancel an appointment',
   'Cancels an appointment of the person the agent is talking to.',
   'internal_write', 'draft', 'autonomous', '{reception}', 'published'),
  (null, 'reply', 1, 'code', 'Reply in the conversation',
   'Sends the agent''s reply to the person, in the conversation it is having.',
   'external_message', 'draft', 'autonomous', '{}', 'published');

-- ---------------------------------------------------------------------------
-- 2. Qué trae de serie cada tipo de agente.
-- ---------------------------------------------------------------------------
create table private.default_agent_skills (
  agent_type_key text not null check (agent_type_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  skill_key      text not null check (skill_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  primary key (agent_type_key, skill_key)
);

revoke all on private.default_agent_skills from public, anon, authenticated, service_role;

insert into private.default_agent_skills (agent_type_key, skill_key) values
  ('reception', 'find_slots'),
  ('reception', 'list_my_appointments'),
  ('reception', 'book_appointment'),
  ('reception', 'reschedule_appointment'),
  ('reception', 'cancel_appointment'),
  ('reception', 'reply'),
  ('customer', 'reply');

-- ---------------------------------------------------------------------------
-- 3. Cada agente nace con las suyas, con su autonomía por defecto. Solo las
--    publicadas de la plataforma, en su versión más alta.
-- ---------------------------------------------------------------------------
-- Idempotente: devuelve cuántas añadió (0 si ya las tenía). La usan el trigger
-- y la puesta al día de los agentes que ya existen.
create function private.attach_default_skills_to(p_agent_id uuid)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_added int;
begin
  insert into public.agent_skills (agent_id, skill_id, organization_id, autonomy_level)
  select distinct on (s.key) a.id, s.id, a.organization_id, s.default_autonomy
  from public.agents a
  join public.agent_types t on t.id = a.agent_type_id and t.organization_id is null
  join private.default_agent_skills d on d.agent_type_key = t.key
  join public.skills s on s.key = d.skill_key and s.organization_id is null and s.status = 'published'
  where a.id = p_agent_id
  order by s.key, s.version desc
  on conflict (agent_id, skill_id) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function private.attach_default_skills_to(uuid) from public, anon, authenticated, service_role;

create function private.attach_default_skills()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.attach_default_skills_to(new.id);
  return null;
end;
$$;

revoke all on function private.attach_default_skills() from public, anon, authenticated, service_role;

create trigger attach_default_skills after insert on public.agents
  for each row execute function private.attach_default_skills();

-- Los agentes que ya existen.
select private.attach_default_skills_to(id) from public.agents;

-- ---------------------------------------------------------------------------
-- 4. messages.idempotency_key.
-- ---------------------------------------------------------------------------
alter table public.messages
  add column idempotency_key text check (idempotency_key is null or length(idempotency_key) between 1 and 200),
  add constraint messages_idempotency_key_only_out check (idempotency_key is null or direction = 'out');
create index messages_idempotency_key_idx on public.messages (organization_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- 5. message.received.
-- ---------------------------------------------------------------------------
create function private.emit_message_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author <> 'contact' then
    return null;
  end if;
  -- La organización es la del mensaje y el local, el de su conversación: la
  -- fila manda (control 3.7).
  insert into public.domain_events (organization_id, location_id, type, payload)
  select new.organization_id, c.location_id, 'message.received',
         jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
  from public.conversations c
  where c.id = new.conversation_id and c.organization_id = new.organization_id;
  return null;
end;
$$;

revoke all on function private.emit_message_received() from public, anon, authenticated, service_role;

create trigger emit_message_received
  after insert on public.messages
  for each row execute function private.emit_message_received();
