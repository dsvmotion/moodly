-- Resumen continuo de cada conversación (PL-T3, «pipeline híbrido», punto 2).
-- En vez de mandar al modelo los últimos 20 mensajes en cada turno, el worker
-- guarda un resumen de lo antiguo, lo pone al día con el modelo `fast` al final
-- del turno y manda resumen + los últimos mensajes. Menos tokens por turno y el
-- agente no olvida lo que se dijo hace 21 mensajes.
--
-- 1. conversation_summaries: una fila por conversación, de su organización
--    (clave ajena compuesta a conversations (id, organization_id), así el
--    resumen nunca cuelga de una conversación de otra organización), con el
--    texto, hasta qué mensaje cubre (covered_until, created_at del último
--    mensaje resumido) y con qué modelo se hizo.
-- 2. La escribe solo la plataforma (el worker, con service_role y siempre con
--    organization_id explícito). La app solo lee, con la misma visibilidad que
--    los mensajes de la conversación (si ves la conversación, ves su resumen) y
--    el equipo interno con acceso de soporte (ADR 0021).
--
-- 3. El rol del worker (moodly_worker, ADR 0049, 20261112040500): su política,
--    como la de las demás tablas de tenants, solo con la organización fijada en
--    la transacción. Sin privilegios todavía: llegan con el módulo que los use.
--
-- Sin funciones security definer ni triggers que escriban en otras tablas.
--
-- Vuelta atrás: rollbacks/20261112050000_conversation_summaries.down.sql.

create table public.conversation_summaries (
  conversation_id uuid not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Lo escribe un modelo a partir de lo que dijo el cliente: es un dato, nunca una instrucción.
  summary text not null check (length(btrim(summary)) between 1 and 4000),
  -- created_at del último mensaje que entra en el resumen: los posteriores van enteros.
  covered_until timestamptz not null,
  model text check (model is null or length(model) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversation_summaries_pkey primary key (conversation_id, organization_id),
  constraint conversation_summaries_conversation_same_org foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade
);
create index conversation_summaries_organization_id_idx on public.conversation_summaries (organization_id);

create trigger set_updated_at before update on public.conversation_summaries
  for each row execute function private.set_updated_at();

alter table public.conversation_summaries enable row level security;
alter table public.conversation_summaries force row level security;

-- Quien ve la conversación (RLS de conversations, dentro del exists) ve su resumen.
create policy conversation_summaries_select on public.conversation_summaries
  for select to authenticated
  using ((select private.session_is_active()) and exists (
    select 1 from public.conversations c
    where c.id = conversation_summaries.conversation_id and c.organization_id = conversation_summaries.organization_id
  ));

create policy conversation_summaries_select_platform_staff on public.conversation_summaries
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

revoke all on public.conversation_summaries from anon, authenticated;
grant select on public.conversation_summaries to authenticated;

create policy conversation_summaries_worker on public.conversation_summaries
  for all to moodly_worker
  using (organization_id = (select private.worker_organization_id()))
  with check (organization_id = (select private.worker_organization_id()));
