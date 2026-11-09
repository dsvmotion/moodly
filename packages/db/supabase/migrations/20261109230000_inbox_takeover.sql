-- La bandeja de conversaciones y «tomar el control» (MANUAL §5.9; línea V2 de
-- docs/WORKSTREAMS.md, que construye la pantalla encima).
--
-- 1. conversations.channel: el canal de la conversación (whatsapp, webchat,
--    test…), para quien ve la conversación. Hasta ahora solo estaba en
--    channel_accounts, que solo ve el org_admin. Lo copia la base de datos de
--    su cuenta al insertar (validate_conversation) y no cambia nunca. La
--    bandeja lo usa para no mostrar el chat de pruebas (test).
-- 2. Tomar y devolver el control: la app puede cambiar conversations.mode
--    entre agent y human, y nada más. La guarda (guard_conversation_mode) pone
--    assigned_user_id: quien la toma, o null al devolverla. Puede quien ve la
--    conversación (can_see_scope); el org_admin, con aal2, y el resto del
--    equipo sin ella, como al decidir aprobaciones (20261030090000). Cerrar o
--    reabrir no entra todavía.
-- 3. Mensajes del equipo: con la conversación en human, quien la ve puede
--    escribir en ella. La app solo da el texto (organization_id,
--    conversation_id, content); la guarda (guard_staff_message) pone
--    direction = 'out', author = 'user', author_user_id = quien escribe y el
--    estado (sent en el chat web y el de pruebas, que leen la fila; pending en
--    el resto, hasta que el worker lo envíe por su canal). No emite
--    message.received (solo los mensajes del contacto lo hacen).
--
-- Funciones security definer:
-- - validate_conversation ya lo era (lee la cuenta real); ahora además copia
--   el canal al insertar y no deja cambiarlo.
-- - touch_conversation pasa a serlo: al escribir un mensaje, actualiza
--   last_message_at de SU conversación (la del mensaje, de su misma
--   organización) y nada más. Antes era invoker porque solo escribía el
--   worker; ahora también escribe el equipo, que no puede tocar esa columna.
--   Es un trigger y nadie la puede llamar directamente (tests en negativo en
--   37_inbox_takeover).
--
-- Vuelta atrás:
--   drop policy messages_insert_staff on public.messages;
--   drop trigger guard_staff_message on public.messages; drop function private.guard_staff_message();
--   revoke insert (organization_id, conversation_id, content) on public.messages from authenticated;
--   drop policy conversations_takeover on public.conversations;
--   drop trigger guard_conversation_mode on public.conversations; drop function private.guard_conversation_mode();
--   revoke update (mode) on public.conversations from authenticated;
--   touch_conversation: la versión invoker de 20261031130000;
--   validate_conversation: la versión de 20261031130000;
--   alter table public.conversations drop column channel;

-- ---------------------------------------------------------------------------
-- 1. El canal de cada conversación
-- ---------------------------------------------------------------------------
alter table public.conversations add column channel text;
update public.conversations c
   set channel = a.channel
  from public.channel_accounts a
 where a.id = c.channel_account_id and a.organization_id = c.organization_id;
alter table public.conversations alter column channel set not null;
alter table public.conversations
  add constraint conversations_channel_check check (channel in ('whatsapp', 'instagram', 'email', 'webchat', 'voice', 'test'));
create index conversations_channel_idx on public.conversations (organization_id, channel, last_message_at desc);

create or replace function private.validate_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_location uuid;
  v_account_channel text;
begin
  select a.location_id, a.channel into v_account_location, v_account_channel
  from public.channel_accounts a
  where a.id = new.channel_account_id and a.organization_id = new.organization_id;
  if v_account_location is not null and new.location_id is distinct from v_account_location then
    raise exception 'una cuenta de un local solo abre conversaciones de ese local' using errcode = '23514';
  end if;
  if new.assigned_user_id is not null and not exists (
    select 1 from public.memberships m where m.user_id = new.assigned_user_id and m.organization_id = new.organization_id
  ) then
    raise exception 'quien atiende la conversación no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    -- El canal es el de su cuenta, lo diga quien lo diga.
    new.channel := v_account_channel;
  else
    if (new.organization_id, new.contact_id, new.channel_account_id, new.channel, new.created_at)
       is distinct from (old.organization_id, old.contact_id, old.channel_account_id, old.channel, old.created_at) then
      raise exception 'la organización, el contacto y el canal de una conversación no cambian' using errcode = '42501';
    end if;
    if old.location_id is not null and new.location_id is distinct from old.location_id then
      raise exception 'el local de una conversación se resuelve una vez y no cambia' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tomar y devolver el control
-- ---------------------------------------------------------------------------
-- Desde la app, solo entre agent y human; quien la atiende lo pone la base de
-- datos (ADR 0003: solo actúa con authenticated).
create function private.guard_conversation_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if old.mode not in ('agent', 'human') or new.mode not in ('agent', 'human') then
      raise exception 'desde la app, una conversación solo pasa entre el agente y una persona' using errcode = '42501';
    end if;
    new.assigned_user_id := case when new.mode = 'human' then (select auth.uid()) end;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_conversation_mode() from public;
create trigger guard_conversation_mode before update on public.conversations
  for each row execute function private.guard_conversation_mode();

create policy conversations_takeover on public.conversations
  for update to authenticated
  using ((select private.session_is_active())
         and private.can_see_scope(organization_id, location_id)
         and ((select private.session_is_aal2()) or not private.has_org_role(organization_id, array['org_admin'])))
  with check ((select private.session_is_active())
              and private.can_see_scope(organization_id, location_id)
              and ((select private.session_is_aal2()) or not private.has_org_role(organization_id, array['org_admin'])));

grant update (mode) on public.conversations to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Mensajes del equipo
-- ---------------------------------------------------------------------------
-- La app solo da el texto; quién lo escribe, en qué sentido y su estado los pone
-- la base de datos. Solo actúa con authenticated (ADR 0003).
create function private.guard_staff_message()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_channel text;
begin
  if current_user = 'authenticated' then
    if length(btrim(new.content)) = 0 then
      raise exception 'el mensaje está vacío' using errcode = '23514';
    end if;
    select c.channel into v_channel
    from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id;
    new.direction := 'out';
    new.author := 'user';
    new.author_user_id := (select auth.uid());
    new.attachments := '[]'::jsonb;
    new.external_message_id := null;
    new.idempotency_key := null;
    -- El chat web y el de pruebas leen la fila; el resto lo envía el worker por su canal.
    new.status := case when v_channel in ('webchat', 'test') then 'sent' else 'pending' end;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_staff_message() from public;
create trigger guard_staff_message before insert on public.messages
  for each row execute function private.guard_staff_message();

-- Solo en una conversación en manos de una persona y que quien escribe ve (la
-- subconsulta pasa por la RLS de conversations).
create policy messages_insert_staff on public.messages
  for insert to authenticated
  with check ((select private.session_is_active())
              and exists (
                select 1 from public.conversations c
                where c.id = messages.conversation_id and c.organization_id = messages.organization_id and c.mode = 'human'
              )
              and ((select private.session_is_aal2()) or not private.has_org_role(organization_id, array['org_admin'])));

grant insert (organization_id, conversation_id, content) on public.messages to authenticated;

-- last_message_at, también cuando escribe el equipo: solo el de la conversación
-- del mensaje, de su misma organización.
create or replace function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
     set last_message_at = new.created_at
   where c.id = new.conversation_id
     and c.organization_id = new.organization_id
     and (c.last_message_at is null or c.last_message_at < new.created_at);
  return null;
end;
$$;
revoke all on function private.touch_conversation() from public, anon, authenticated, service_role;
