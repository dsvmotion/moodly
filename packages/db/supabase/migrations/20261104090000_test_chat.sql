-- Paso 4d-3e: el chat de pruebas dentro de la app (MANUAL §5.1 y §9.6, paso 5).
--
-- Una persona del equipo prueba un agente desde la app como si fuera un
-- cliente, sin WhatsApp: escribe, el worker contesta con el modelo de verdad y
-- lo que el agente propone llega a la bandeja de aprobaciones, como en una
-- conversación real.
--
-- 1. El canal 'test' (channel_accounts) y la identidad 'test'
--    (contact_identities): la conversación de prueba de cada persona se
--    distingue de las de los clientes por su canal, y su contacto por la
--    identidad, que es el id de la persona. Nada sale de la plataforma: la
--    respuesta se guarda en la conversación, como en el chat web.
-- 2. public.send_test_message: el mensaje de la persona como contacto de
--    prueba. Si hace falta, crea la cuenta del canal del local, el contacto de
--    prueba de la persona y su conversación con el agente. El mensaje emite
--    message.received (private.emit_message_received) y lo contesta el worker.
-- 3. public.close_test_conversation: «empezar de nuevo». Cierra la
--    conversación de prueba de la persona; el siguiente mensaje abre otra, sin
--    el historial de la anterior.
--
-- Funciones security definer que escriben en tablas de tenants (CLAUDE.md,
-- «Base de datos: guardas»). La app solo lee conversaciones y mensajes, así que
-- estas dos funciones son la única vía de la app para escribirlos, y lo hacen
-- solo dentro de lo que la persona ya puede ver:
-- - Sesión viva (private.session_is_active), miembro de la organización del
--   agente, organización activa y el local en su alcance (private.can_see_scope:
--   sin local, solo un org_admin). Un org_admin, además, con el segundo factor
--   (aal2), como cualquier escritura de administración.
-- - La organización sale del agente y el contacto, de la sesión: nunca de lo
--   que pase quien llama. Un agente de otra organización da el mismo error que
--   uno que no existe.
-- - Solo el canal 'test', solo el contacto de prueba de quien llama y solo
--   mensajes de entrada (author = 'contact'): no puede escribir como el agente,
--   ni en la conversación de un cliente, ni en la de otra persona.
-- - Un agente en pausa no se prueba. En draft sí: probarlo antes de publicarlo
--   es para lo que sirve (MANUAL §9.6); el worker contesta en el canal 'test'
--   también a un agente en draft.
-- - Freno de coste: como mucho 30 mensajes por persona y organización en una
--   hora (cada turno llama al modelo de verdad).
-- Tests en negativo en 29_test_chat.
--
-- Vuelta atrás (no hay datos de clientes; las conversaciones de prueba se pueden
-- borrar):
--   drop function public.close_test_conversation(uuid);
--   drop function public.send_test_message(uuid, uuid, text);
--   delete from public.channel_accounts where channel = 'test';  -- con sus conversaciones y mensajes
--   delete from public.contact_identities where kind = 'test';   -- y sus contactos
--   y volver a los checks de channel_accounts.channel y contact_identities.kind sin 'test'.

-- ---------------------------------------------------------------------------
-- 1. El canal y la identidad de prueba
-- ---------------------------------------------------------------------------
alter table public.channel_accounts drop constraint channel_accounts_channel_check;
alter table public.channel_accounts add constraint channel_accounts_channel_check
  check (channel in ('whatsapp', 'instagram', 'email', 'webchat', 'voice', 'test'));

alter table public.contact_identities drop constraint contact_identities_kind_check;
alter table public.contact_identities add constraint contact_identities_kind_check
  check (kind in ('phone', 'email', 'instagram', 'webchat', 'test'));
-- La identidad de prueba es el id de una persona del equipo.
alter table public.contact_identities add constraint contact_identities_test_user
  check (kind <> 'test' or external_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- ---------------------------------------------------------------------------
-- 2. send_test_message
-- ---------------------------------------------------------------------------
create function public.send_test_message(p_agent_id uuid, p_location_id uuid, p_content text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user         uuid := (select auth.uid());
  v_content      text := btrim(coalesce(p_content, ''));
  v_org          uuid;
  v_status       text;
  v_type_key     text;
  v_channel      uuid;
  v_contact      uuid;
  v_conversation uuid;
  v_mode         text;
begin
  if v_user is null or not (select private.session_is_active()) then
    raise exception 'sin sesión' using errcode = '42501';
  end if;

  select a.organization_id, a.status, t.key into v_org, v_status, v_type_key
  from public.agents a
  join public.agent_types t on t.id = a.agent_type_id
  where a.id = p_agent_id;
  -- Uno que no existe y uno de otra organización dan el mismo error.
  if v_org is null
     or not exists (select 1 from public.memberships m where m.user_id = v_user and m.organization_id = v_org)
     or not private.org_is_active(v_org) then
    raise exception 'agente no encontrado' using errcode = 'P0002';
  end if;
  if p_location_id is not null
     and not exists (select 1 from public.locations l where l.id = p_location_id and l.organization_id = v_org) then
    raise exception 'agente no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_see_scope(v_org, p_location_id) then
    raise exception 'fuera de tu alcance' using errcode = '42501';
  end if;
  if private.has_org_role(v_org, array['org_admin']) and not (select private.session_is_aal2()) then
    raise exception 'hace falta el segundo factor' using errcode = '42501';
  end if;
  if v_status = 'paused' then
    raise exception 'el agente está en pausa' using errcode = '55000';
  end if;
  if length(v_content) = 0 or length(v_content) > 2000 then
    raise exception 'el mensaje tiene que tener entre 1 y 2000 caracteres' using errcode = '22023';
  end if;

  -- Una sola alta a la vez por persona y organización: sin contactos ni
  -- conversaciones duplicados si llegan dos mensajes seguidos.
  perform pg_advisory_xact_lock(hashtextextended('test_chat:' || v_org::text || ':' || v_user::text, 0));

  -- Freno de coste: 30 mensajes por hora y persona en la organización.
  if (select count(*)
      from public.messages msg
      join public.conversations c on c.id = msg.conversation_id and c.organization_id = msg.organization_id
      join public.contact_identities i on i.contact_id = c.contact_id and i.organization_id = c.organization_id
      where msg.organization_id = v_org
        and msg.created_at > now() - interval '1 hour'
        and msg.author = 'contact'
        and i.kind = 'test' and i.external_id = v_user::text) >= 30 then
    raise exception 'demasiados mensajes de prueba: espera un poco' using errcode = '54000';
  end if;

  -- La cuenta del canal de prueba del local (o de toda la organización).
  insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
  values (v_org, p_location_id, 'test', 'test:' || v_org::text || ':' || coalesce(p_location_id::text, 'org'), v_type_key, 'active')
  on conflict (channel, external_id) do nothing;
  select a.id into v_channel
  from public.channel_accounts a
  where a.channel = 'test' and a.external_id = 'test:' || v_org::text || ':' || coalesce(p_location_id::text, 'org');

  -- El contacto de prueba de la persona en esta organización.
  select i.contact_id into v_contact
  from public.contact_identities i
  where i.organization_id = v_org and i.kind = 'test' and i.external_id = v_user::text;
  if v_contact is null then
    insert into public.contacts (organization_id, display_name, locale)
    select v_org,
           left(coalesce(nullif(btrim(u.full_name), ''), 'Equipo'), 180) || ' (prueba)',
           case when u.locale ~ '^[a-z]{2}(-[A-Z]{2})?$' then u.locale end
    from public.users u where u.id = v_user
    returning id into v_contact;
    insert into public.contact_identities (organization_id, contact_id, kind, external_id)
    values (v_org, v_contact, 'test', v_user::text);
  end if;

  -- Su conversación abierta con este agente en este local, o una nueva. Si una
  -- prueba anterior la pasó a una persona, vuelve al agente: es una prueba.
  select c.id, c.mode into v_conversation, v_mode
  from public.conversations c
  where c.organization_id = v_org and c.contact_id = v_contact and c.channel_account_id = v_channel
    and c.agent_id = p_agent_id and c.mode <> 'closed'
  order by c.created_at desc
  limit 1;
  if v_conversation is null then
    insert into public.conversations (organization_id, location_id, contact_id, channel_account_id, agent_id, mode)
    values (v_org, p_location_id, v_contact, v_channel, p_agent_id, 'agent')
    returning id into v_conversation;
  elsif v_mode = 'human' then
    update public.conversations set mode = 'agent' where id = v_conversation;
  end if;

  insert into public.messages (organization_id, conversation_id, direction, author, content)
  values (v_org, v_conversation, 'in', 'contact', v_content);
  return v_conversation;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. close_test_conversation
-- ---------------------------------------------------------------------------
-- Solo la conversación de prueba de quien llama. Si no es suya, no es de
-- prueba o no existe, el mismo error. Cerrar una cerrada no hace nada.
create function public.close_test_conversation(p_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not (select private.session_is_active()) then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  update public.conversations c
  set mode = 'closed'
  from public.channel_accounts a, public.contact_identities i
  where c.id = p_conversation_id
    and a.id = c.channel_account_id and a.organization_id = c.organization_id and a.channel = 'test'
    and i.contact_id = c.contact_id and i.organization_id = c.organization_id
    and i.kind = 'test' and i.external_id = v_user::text
    and exists (select 1 from public.memberships m where m.user_id = v_user and m.organization_id = c.organization_id);
  if not found then
    raise exception 'conversación de prueba no encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Supabase concede EXECUTE por defecto a anon y authenticated en public: se
-- quita a todos y se da solo a authenticated.
revoke all on function public.send_test_message(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.close_test_conversation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.send_test_message(uuid, uuid, text) to authenticated;
grant execute on function public.close_test_conversation(uuid) to authenticated;
