-- M-10 (auditoría 2026-11-10): la bandeja se pone al día con Supabase Realtime
-- en vez de pedir la página cada 5 s (~120 peticiones por minuto por pestaña).
--
-- Por qué Broadcast y no Postgres Changes: Postgres Changes lee el slot con
-- wal2json y le pide solo las tablas de la publicación (public.messages), pero
-- las filas de messages se escriben en sus particiones (partitions.messages_*),
-- y wal2json no sabe de publish_via_partition_root: el cambio se descarta antes
-- de mirar RLS (comprobado contra el Realtime local; ver el PR).
--
-- Cómo funciona:
-- - Cada alta o cambio en public.messages o public.conversations manda, desde
--   la base de datos, un mensaje Broadcast privado (realtime.send) al tema de su
--   bandeja: inbox:<organization_id>:<location_id>, o inbox:<organization_id>:org
--   para las conversaciones sin local.
-- - Solo lleva identificadores ({op, conversation_id[, message_id]}), nunca el
--   contenido ni datos personales: la web vuelve a leer con su sesión, por RLS.
-- - Quién puede escuchar un tema lo decide la política inbox_read sobre
--   realtime.messages (los canales privados de Realtime la comprueban al unirse):
--   sesión activa (session_is_active) y el mismo alcance que conversations_select
--   (can_see_scope: el local, o toda la organización si es org_admin), o el
--   equipo interno con acceso de soporte (staff_can_read). Sin política de
--   insert: nadie de la app puede emitir en esos temas.
-- - Si Realtime falla, el mensaje se guarda igual (realtime.send no corta la
--   transacción).
--
-- Cómo se suscribe la web (V2): supabase.realtime.setAuth() con la sesión y
-- canal privado: supabase.channel('inbox:<org>:<location>', { config: { private: true } })
-- .on('broadcast', { event: 'message' | 'conversation' }, …).
--
-- Security definer: private.broadcast_inbox_change() lee la conversación de un
-- mensaje (para saber su local) y escribe una fila en realtime.messages por
-- cambio (con realtime.send); no escribe en tablas de tenants y solo lleva
-- identificadores. private.can_read_inbox_topic() solo lee (los helpers de
-- alcance). Ninguna de las dos la puede llamar la app salvo
-- can_read_inbox_topic, que la necesita la política.
--
-- Vuelta atrás: rollbacks/20261112010000_realtime_inbox.down.sql.

-- ---------------------------------------------------------------------------
-- 1. El tema de una bandeja
-- ---------------------------------------------------------------------------
create function private.inbox_topic(p_org uuid, p_location uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'inbox:' || p_org::text || ':' || coalesce(p_location::text, 'org');
$$;
revoke all on function private.inbox_topic(uuid, uuid) from public, anon, authenticated, service_role;

-- Quién puede escuchar un tema: lo mismo que puede leer sus conversaciones.
-- Un tema mal formado no lo escucha nadie.
create function private.can_read_inbox_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^inbox:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|org)$'
    then private.can_see_scope(split_part(p_topic, ':', 2)::uuid, nullif(split_part(p_topic, ':', 3), 'org')::uuid)
         or private.staff_can_read(split_part(p_topic, ':', 2)::uuid)
    else false
  end;
$$;
revoke all on function private.can_read_inbox_topic(text) from public, anon;
grant execute on function private.can_read_inbox_topic(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cada alta o cambio avisa a su bandeja
-- ---------------------------------------------------------------------------
-- tg_argv[0]: 'message' o 'conversation' (en messages, tg_table_name sería el
-- nombre de la partición).
create function private.broadcast_inbox_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location uuid;
begin
  if tg_argv[0] = 'message' then
    select c.location_id into v_location
    from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id;
    perform realtime.send(
      jsonb_build_object('op', tg_op, 'conversation_id', new.conversation_id, 'message_id', new.id),
      'message', private.inbox_topic(new.organization_id, v_location), true);
  else
    perform realtime.send(
      jsonb_build_object('op', tg_op, 'conversation_id', new.id),
      'conversation', private.inbox_topic(new.organization_id, new.location_id), true);
    -- Si la conversación cambia de local, la bandeja de antes también se entera.
    if tg_op = 'UPDATE' and old.location_id is distinct from new.location_id then
      perform realtime.send(
        jsonb_build_object('op', tg_op, 'conversation_id', new.id),
        'conversation', private.inbox_topic(old.organization_id, old.location_id), true);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.broadcast_inbox_change() from public, anon, authenticated, service_role;

create trigger broadcast_inbox_change after insert or update on public.messages
  for each row execute function private.broadcast_inbox_change('message');
create trigger broadcast_inbox_change after insert or update on public.conversations
  for each row execute function private.broadcast_inbox_change('conversation');

-- ---------------------------------------------------------------------------
-- 3. Quién escucha (canales privados de Realtime)
-- ---------------------------------------------------------------------------
create policy inbox_read on realtime.messages
  for select to authenticated
  using ((select private.session_is_active())
         and extension = 'broadcast'
         and private.can_read_inbox_topic((select realtime.topic())));
