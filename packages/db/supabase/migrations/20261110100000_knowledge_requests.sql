-- Solicitudes de conocimiento (paso B20-4a, MANUAL §5.9 «No improvisar» y §17
-- «Bucle de aprendizaje v0»). Cuando el agente no encuentra un dato en el
-- conocimiento del negocio, no lo inventa: deja una pregunta al equipo y le
-- dice al cliente que una persona le contestará (eso lo hace el worker, en
-- B20-4b). Aquí, la tabla y lo que pasa cuando una persona contesta.
--
-- 1. knowledge_requests: la pregunta, de qué organización, local, agente, run y
--    conversación, y a qué rol va (el local la contesta su equipo; sin local,
--    solo el org_admin). Una por ejecución (idempotency_key). La escribe el worker (service_role); la app solo lee y
--    contesta o descarta.
-- 2. Contestar (status = answered, con la respuesta) o descartar (dismissed),
--    una vez, solo desde open. Quién: el mismo criterio que las aprobaciones
--    (can_decide_approval: el rol que pide o uno superior, que llegue a su
--    local); el org_admin, con aal2, y el resto del equipo sin ella.
--    answered_by y answered_at los pone la base de datos (guard_knowledge_request).
-- 3. Al contestar, la base de datos (answer_knowledge_request):
--    - guarda la respuesta como fuente de conocimiento human_answer, del mismo
--      alcance que la pregunta (su local, o toda la organización), con la
--      pregunta como título; entra pending y el worker la indexa
--      (knowledge_source.pending), así la próxima vez el agente ya lo sabe;
--    - manda la respuesta al cliente en su conversación, como mensaje de la
--      persona que contestó (sent en el chat web y el de pruebas; pending en el
--      resto, hasta que el worker lo envíe por su canal);
--    - deja la entrada de auditoría.
--
-- Funciones security definer (escriben en tablas de tenants):
-- - validate_knowledge_request (antes de insertar): solo lee, para comprobar
--   contra los datos reales que el run, el agente y la conversación son de la
--   organización y el local de la pregunta.
-- - answer_knowledge_request (antes de actualizar, solo de open a answered y
--   después de guard_knowledge_request): quien contesta no puede escribir
--   fuentes de conocimiento (solo el org_admin), ni mensajes de una
--   conversación que no ha tomado, ni en audit_logs. Escribe exactamente tres
--   filas, todas de la organización de la pregunta y derivadas de ella: la
--   fuente (su alcance, su pregunta, su respuesta), el mensaje (en su
--   conversación) y la auditoría. No la puede llamar nadie: es un trigger sin
--   EXECUTE para ningún rol de la app. Tests en negativo en 39_knowledge_requests.
--
-- Vuelta atrás:
--   drop table public.knowledge_requests;
--   drop function private.validate_knowledge_request(), private.guard_knowledge_request(),
--     private.answer_knowledge_request();

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------
create table public.knowledge_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = de toda la organización (la contesta un org_admin).
  location_id uuid,
  agent_id uuid not null,
  run_id uuid references public.agent_runs (id) on delete set null,
  conversation_id uuid,
  question text not null check (length(btrim(question)) between 1 and 500),
  assigned_role text not null check (assigned_role in ('org_admin', 'region_manager', 'location_manager', 'staff')),
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  answer text check (answer is null or length(btrim(answer)) between 1 and 4000),
  answered_by uuid references public.users (id) on delete set null,
  answered_at timestamptz,
  resulting_source_id uuid,
  -- La clave de la ejecución que la creó: si el paso del worker se repite, no se duplica.
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_requests_location_same_org foreign key (location_id, organization_id)
    references public.locations (id, organization_id) on delete cascade,
  constraint knowledge_requests_agent_same_org foreign key (agent_id, organization_id)
    references public.agents (id, organization_id) on delete cascade,
  constraint knowledge_requests_conversation_same_org foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete set null (conversation_id),
  constraint knowledge_requests_source_same_org foreign key (resulting_source_id, organization_id)
    references public.knowledge_sources (id, organization_id) on delete set null (resulting_source_id),
  -- Sin local, la pregunta es de toda la organización: solo la contesta un org_admin.
  constraint knowledge_requests_org_level_needs_admin check (location_id is not null or assigned_role = 'org_admin'),
  constraint knowledge_requests_answer_only_answered check ((status = 'answered') = (answer is not null)),
  constraint knowledge_requests_closed_at check ((status <> 'open') = (answered_at is not null)),
  constraint knowledge_requests_idempotency_key unique (organization_id, idempotency_key)
);
create index knowledge_requests_open_idx on public.knowledge_requests (organization_id, status, created_at desc);
create index knowledge_requests_location_id_idx on public.knowledge_requests (location_id, organization_id);
create index knowledge_requests_agent_id_idx on public.knowledge_requests (agent_id, organization_id);
create index knowledge_requests_run_id_idx on public.knowledge_requests (run_id);
create index knowledge_requests_conversation_id_idx on public.knowledge_requests (conversation_id, organization_id);
create index knowledge_requests_answered_by_idx on public.knowledge_requests (answered_by);
create index knowledge_requests_resulting_source_id_idx on public.knowledge_requests (resulting_source_id, organization_id);

create trigger set_updated_at before update on public.knowledge_requests
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Nace abierta y coherente con su run y su conversación
-- ---------------------------------------------------------------------------
create function private.validate_knowledge_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.run_id is not null and not exists (
    select 1 from public.agent_runs r
    where r.id = new.run_id and r.organization_id = new.organization_id
      and r.agent_id = new.agent_id and r.location_id is not distinct from new.location_id
  ) then
    raise exception 'la pregunta no coincide con su run (organización, agente o local)' using errcode = '23514';
  end if;
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id
      and c.location_id is not distinct from new.location_id
  ) then
    raise exception 'la pregunta no coincide con su conversación (organización o local)' using errcode = '23514';
  end if;
  if new.status <> 'open' or new.answer is not null or new.answered_by is not null
     or new.answered_at is not null or new.resulting_source_id is not null then
    raise exception 'una pregunta nace abierta y sin respuesta' using errcode = '23514';
  end if;
  new.question := btrim(new.question);
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.validate_knowledge_request() from public;
create trigger validate_knowledge_request before insert on public.knowledge_requests
  for each row execute function private.validate_knowledge_request();

-- ---------------------------------------------------------------------------
-- 3. Qué cambia, para todos los roles
-- ---------------------------------------------------------------------------
-- - La pregunta y su contexto, nunca (el run, la conversación y la fuente solo
--   pasan a null cuando se borran).
-- - El estado solo sale de open, y una vez.
-- - answered, solo una persona con su sesión y con respuesta; dismissed, una
--   persona o la plataforma. answered_by y answered_at los pone la base de datos.
-- - La respuesta, solo al contestar. resulting_source_id lo pone
--   answer_knowledge_request.
create function private.guard_knowledge_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.organization_id, new.location_id, new.agent_id, new.question, new.assigned_role, new.idempotency_key, new.created_at)
     is distinct from
     (old.organization_id, old.location_id, old.agent_id, old.question, old.assigned_role, old.idempotency_key, old.created_at) then
    raise exception 'la pregunta no cambia' using errcode = '42501';
  end if;
  -- El run y la conversación tampoco; solo los pone a null su clave foránea al borrarlos.
  if (new.run_id is distinct from old.run_id and (new.run_id is not null or current_user = 'authenticated'))
     or (new.conversation_id is distinct from old.conversation_id
         and (new.conversation_id is not null or current_user = 'authenticated')) then
    raise exception 'la pregunta no cambia' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then
    -- Quién contestó y la fuente solo pasan a null al borrarse la persona o la fuente.
    if (new.answer, new.answered_at) is distinct from (old.answer, old.answered_at)
       or (new.answered_by is distinct from old.answered_by
           and (current_user = 'authenticated' or new.answered_by is not null))
       or (new.resulting_source_id is distinct from old.resulting_source_id
           and (current_user = 'authenticated' or new.resulting_source_id is not null)) then
      raise exception 'la respuesta de una pregunta no cambia' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status <> 'open' then
    raise exception 'una pregunta ya contestada o descartada no cambia' using errcode = '42501';
  end if;
  if new.resulting_source_id is not null then
    raise exception 'la fuente la pone la base de datos' using errcode = '42501';
  end if;
  if new.status = 'answered' then
    if current_user <> 'authenticated' or (select auth.uid()) is null then
      raise exception 'solo una persona con su sesión contesta' using errcode = '42501';
    end if;
    if new.answer is null then
      raise exception 'contestar pide una respuesta' using errcode = '23514';
    end if;
    new.answer := btrim(new.answer);
  elsif new.answer is not null then
    raise exception 'descartar no lleva respuesta' using errcode = '23514';
  end if;
  new.answered_by := case when current_user = 'authenticated' then (select auth.uid()) end;
  new.answered_at := now();
  return new;
end;
$$;
revoke all on function private.guard_knowledge_request() from public;
create trigger guard_knowledge_request before update on public.knowledge_requests
  for each row execute function private.guard_knowledge_request();

-- ---------------------------------------------------------------------------
-- 4. Contestar: conocimiento, mensaje al cliente y auditoría
-- ---------------------------------------------------------------------------
-- Después de guard_knowledge_request (los triggers before van por nombre).
create function private.answer_knowledge_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
begin
  insert into public.knowledge_sources (organization_id, location_id, type, title, body, status, created_by)
  values (new.organization_id, new.location_id, 'human_answer', left(new.question, 200), new.answer, 'pending', new.answered_by)
  returning id into new.resulting_source_id;

  if new.conversation_id is not null then
    select c.channel into v_channel
    from public.conversations c
    where c.id = new.conversation_id and c.organization_id = new.organization_id;
    insert into public.messages (organization_id, conversation_id, direction, author, author_user_id, content, status)
    values (new.organization_id, new.conversation_id, 'out', 'user', new.answered_by, new.answer,
            case when v_channel in ('webchat', 'test') then 'sent' else 'pending' end);
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target, metadata)
  values (new.organization_id, 'user', new.answered_by, 'knowledge_request.answered',
          jsonb_build_object('knowledge_request_id', new.id, 'knowledge_source_id', new.resulting_source_id),
          jsonb_build_object('location_id', new.location_id, 'assigned_role', new.assigned_role,
                             'message_sent', new.conversation_id is not null));
  return new;
end;
$$;
revoke all on function private.answer_knowledge_request() from public, anon, authenticated, service_role;
create trigger knowledge_request_answered before update of status on public.knowledge_requests
  for each row
  when (old.status = 'open' and new.status = 'answered')
  execute function private.answer_knowledge_request();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.knowledge_requests enable row level security;
alter table public.knowledge_requests force row level security;

-- La ve quien ve su alcance: las de toda la organización, el org_admin; las de
-- un local, quien tiene ese local.
create policy knowledge_requests_select on public.knowledge_requests
  for select to authenticated
  using ((select private.session_is_active()) and (
    (location_id is null and private.has_org_role(organization_id, array['org_admin']))
    or (location_id is not null and private.can_access_location(organization_id, location_id))));

create policy knowledge_requests_select_platform_staff on public.knowledge_requests
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- Contestar o descartar: abierta, con el rol y el alcance que pide, y con aal2
-- si es un org_admin (como en todo lo que administra, 13_admin_mfa).
create policy knowledge_requests_answer on public.knowledge_requests
  for update to authenticated
  using ((select private.session_is_active())
         and status = 'open'
         and private.can_decide_approval(organization_id, location_id, assigned_role)
         and ((select private.session_is_aal2()) or not private.has_org_role(organization_id, array['org_admin'])))
  with check ((select private.session_is_active())
              and private.can_decide_approval(organization_id, location_id, assigned_role)
              and ((select private.session_is_aal2()) or not private.has_org_role(organization_id, array['org_admin'])));

revoke all on public.knowledge_requests from anon, authenticated;
grant select on public.knowledge_requests to authenticated;
grant update (status, answer) on public.knowledge_requests to authenticated;
