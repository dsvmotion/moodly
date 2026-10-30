-- Conocimiento del negocio (paso 3d; ADR 0037, sobre el 0025). Solo modelo de
-- datos y recuperación: no activa ningún proveedor de embeddings ni ingiere
-- nada todavía.
--
-- - knowledge_sources: de dónde sale el conocimiento (FAQ, precios, políticas,
--   web...), de toda la organización o de un local. La gestiona el org_admin
--   con aal2; la ingesta (estado, fragmentos) es de la plataforma.
-- - knowledge_chunks: los fragmentos, con su embedding, el modelo que lo hizo
--   y su dimensión (nunca se mezclan modelos en una consulta) y su tsvector.
--   El alcance lo copia la base de datos de su fuente: nunca lo pone quien
--   inserta.
-- - search_knowledge: la única búsqueda. Organización, local y modelo del
--   runtime; filtra antes de ordenar; híbrida (vector + texto) con Reciprocal
--   Rank Fusion. Escalón de búsqueda exacta del ADR 0025 (sin índice
--   aproximado: recall del 100 % para las pymes).
--
-- Vuelta atrás: drop de search_knowledge, de knowledge_chunks y
-- knowledge_sources y de sus funciones private.*_knowledge_*. La extensión
-- vector se queda (no molesta y otras tablas la usarán). No hay datos de
-- clientes todavía.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. knowledge_sources
-- ---------------------------------------------------------------------------
create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = toda la organización.
  location_id uuid references public.locations (id) on delete cascade,
  type text not null check (type in ('faq', 'pricing', 'policy', 'catalog', 'document', 'website', 'human_answer')),
  title text not null check (length(btrim(title)) between 1 and 200),
  -- La ingesta la mueve: pending → processing → ready (o error). Solo se busca en ready.
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  storage_path text check (length(storage_path) between 1 and 500),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_sources_id_organization_id_key unique (id, organization_id)
);
create index knowledge_sources_organization_id_idx on public.knowledge_sources (organization_id, location_id);
create index knowledge_sources_location_id_idx on public.knowledge_sources (location_id);
create index knowledge_sources_created_by_idx on public.knowledge_sources (created_by);

create trigger set_updated_at before update on public.knowledge_sources
  for each row execute function private.set_updated_at();

-- El local es de su organización y el alcance no cambia (los fragmentos lo
-- copian). Para todos los roles; security definer para comprobar contra los
-- datos reales. Solo lee.
create function private.validate_knowledge_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local de la fuente no es de su organización' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.organization_id, new.location_id, new.created_by, new.created_at)
     is distinct from (old.organization_id, old.location_id, old.created_by, old.created_at) then
    raise exception 'la organización, el local y el autor de una fuente no cambian' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_knowledge_source() from public;
create trigger validate_knowledge_source before insert or update on public.knowledge_sources
  for each row execute function private.validate_knowledge_source();

-- Desde la app, el autor y el estado los pone la base de datos (ADR 0003).
create function private.guard_knowledge_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.status := 'pending';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_knowledge_source() from public;
create trigger guard_knowledge_source before insert on public.knowledge_sources
  for each row execute function private.guard_knowledge_source();

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_sources force row level security;

-- La ve quien ve su alcance: toda la organización, o ese local.
create policy knowledge_sources_select on public.knowledge_sources
  for select to authenticated
  using ((select private.session_is_active()) and (
    (location_id is null and private.has_org_role(organization_id))
    or (location_id is not null and private.can_access_location(organization_id, location_id))
  ));

create policy knowledge_sources_select_platform_staff on public.knowledge_sources
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

create policy knowledge_sources_insert on public.knowledge_sources
  for insert to authenticated
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy knowledge_sources_update on public.knowledge_sources
  for update to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']))
  with check ((select private.session_is_active()) and (select private.session_is_aal2())
              and private.has_org_role(organization_id, array['org_admin']));

create policy knowledge_sources_delete on public.knowledge_sources
  for delete to authenticated
  using ((select private.session_is_active()) and (select private.session_is_aal2())
         and private.has_org_role(organization_id, array['org_admin']));

revoke all on public.knowledge_sources from anon, authenticated;
grant select, delete on public.knowledge_sources to authenticated;
grant insert (organization_id, location_id, type, title, storage_path) on public.knowledge_sources to authenticated;
grant update (title) on public.knowledge_sources to authenticated;

-- ---------------------------------------------------------------------------
-- 2. knowledge_chunks
-- ---------------------------------------------------------------------------
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_id uuid not null,
  -- Copia del de la fuente (copy_knowledge_chunk_scope): para filtrar antes de ordenar.
  location_id uuid,
  ordinal int not null check (ordinal >= 0),
  content text not null check (length(content) between 1 and 8000),
  -- Sin dimensión fija: cada fila dice con qué modelo y cuántas dimensiones,
  -- y una consulta solo compara vectores de un mismo modelo (ADR 0025 §3).
  embedding extensions.vector not null,
  embedding_model text not null check (embedding_model ~ '^[a-z0-9][a-z0-9._:/-]{1,99}$'),
  embedding_dim int not null check (embedding_dim between 1 and 4000),
  -- 'simple': sin raíces de un idioma (inglés por defecto, español como alternativa).
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint knowledge_chunks_source_same_org foreign key (source_id, organization_id)
    references public.knowledge_sources (id, organization_id) on delete cascade,
  constraint knowledge_chunks_dim_matches check (extensions.vector_dims(embedding) = embedding_dim),
  constraint knowledge_chunks_source_ordinal_model_key unique (source_id, ordinal, embedding_model)
);
-- Escalón de búsqueda exacta (ADR 0025 §2): el planificador lee solo las filas
-- del tenant, del modelo y del alcance, y calcula la distancia exacta.
create index knowledge_chunks_scope_idx on public.knowledge_chunks (organization_id, embedding_model, location_id);
create index knowledge_chunks_source_id_idx on public.knowledge_chunks (source_id, organization_id);
create index knowledge_chunks_tsv_idx on public.knowledge_chunks using gin (tsv);

-- El alcance de un fragmento es el de su fuente: lo copia la base de datos,
-- nunca lo pone quien inserta (un fragmento de un local no puede quedar
-- visible para toda la organización). Security definer para leer la fuente
-- real; solo lee.
create function private.copy_knowledge_chunk_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select s.location_id into new.location_id
  from public.knowledge_sources s
  where s.id = new.source_id and s.organization_id = new.organization_id;
  return new;
end;
$$;
revoke all on function private.copy_knowledge_chunk_scope() from public;
create trigger copy_knowledge_chunk_scope before insert or update on public.knowledge_chunks
  for each row execute function private.copy_knowledge_chunk_scope();

alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_chunks force row level security;

create policy knowledge_chunks_select on public.knowledge_chunks
  for select to authenticated
  using ((select private.session_is_active()) and (
    (location_id is null and private.has_org_role(organization_id))
    or (location_id is not null and private.can_access_location(organization_id, location_id))
  ));

create policy knowledge_chunks_select_platform_staff on public.knowledge_chunks
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

-- Los fragmentos los escribe la ingesta del worker; la app solo los lee.
revoke all on public.knowledge_chunks from anon, authenticated;
grant select on public.knowledge_chunks to authenticated;

-- ---------------------------------------------------------------------------
-- 3. search_knowledge: la única búsqueda (ADR 0025 §1)
-- ---------------------------------------------------------------------------
-- Organización, local y modelo los pone el runtime. Un run de organización
-- (p_location_id null) solo ve lo de toda la organización; uno de local, eso y
-- lo de su local, nunca lo de otros locales. Invoker: con la clave secreta
-- (worker) no hay RLS y el filtro explícito es lo que acota; desde la app,
-- además, RLS.
create function public.search_knowledge(
  p_organization_id uuid,
  p_location_id uuid,
  p_embedding_model text,
  p_query_embedding extensions.vector,
  p_query text,
  p_k int
)
returns table (chunk_id uuid, source_id uuid, source_type text, source_title text, content text, score double precision)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select c.id, c.source_id, s.type, s.title, c.content, c.embedding, c.tsv
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id and s.organization_id = c.organization_id
    where c.organization_id = p_organization_id
      and c.embedding_model = p_embedding_model
      and (c.location_id is null or c.location_id = p_location_id)
      and s.status = 'ready'
      and (c.valid_until is null or c.valid_until > now())
  ),
  semantic as (
    select id, row_number() over (order by embedding operator(extensions.<=>) p_query_embedding, id) as rank
    from candidates
    order by embedding operator(extensions.<=>) p_query_embedding, id
    limit least(greatest(p_k, 1), 50) * 4
  ),
  lexical as (
    select id, row_number() over (order by ts_rank_cd(tsv, q) desc, id) as rank
    from candidates, websearch_to_tsquery('simple', coalesce(p_query, '')) q
    where tsv @@ q
    order by ts_rank_cd(tsv, q) desc, id
    limit least(greatest(p_k, 1), 50) * 4
  )
  -- Reciprocal Rank Fusion (k = 60): un fragmento que sale en las dos listas sube.
  select c.id, c.source_id, c.type, c.title, c.content,
         coalesce(1.0 / (60 + sem.rank), 0) + coalesce(1.0 / (60 + lex.rank), 0) as score
  from candidates c
  left join semantic sem on sem.id = c.id
  left join lexical lex on lex.id = c.id
  where sem.id is not null or lex.id is not null
  order by score desc, c.id
  limit least(greatest(p_k, 1), 50);
$$;
revoke all on function public.search_knowledge(uuid, uuid, text, extensions.vector, text, int) from public, anon, authenticated;
grant execute on function public.search_knowledge(uuid, uuid, text, extensions.vector, text, int) to service_role;
