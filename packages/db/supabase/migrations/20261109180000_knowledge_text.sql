-- Paso B20-1: fuentes de conocimiento de texto y su ingesta (MANUAL §6.1,
-- ADR 0037 y ADR 0048).
--
-- 1. knowledge_sources.body: el texto de una fuente escrita en la app (las
--    preguntas frecuentes, los precios, las políticas), hasta 20.000
--    caracteres. Lo escribe el org_admin con aal2, como el título (las mismas
--    políticas de 20261031120000). Las fuentes de archivo (storage_path)
--    llegan después.
-- 2. Cambiar el texto vuelve a poner la fuente en pending (guard_knowledge_source):
--    hay que reindexarla. La app sigue sin poder tocar el estado.
-- 3. El evento knowledge_source.pending, cuando una fuente se crea o vuelve a
--    pending: el worker la trocea, saca sus embeddings y la deja ready
--    (consumidor knowledge.ingest). Solo lleva el id de la fuente; el tenant
--    sale de la fila (control 3.7).
--
-- Funciones security definer: emit_knowledge_source_event escribe en
-- domain_events, como emit_appointment_event (20261104120000): solo el evento
-- de la fila que cambia, con su organización y su local, y no la puede llamar
-- nadie directamente. guard_knowledge_source sigue siendo invoker.
--
-- Vuelta atrás:
--   drop trigger emit_knowledge_source_event on public.knowledge_sources;
--   drop function private.emit_knowledge_source_event();
--   guard_knowledge_source: la versión de 20261031120000 (solo before insert);
--   revoke insert (body), update (body) on public.knowledge_sources from authenticated;
--   alter table public.knowledge_sources drop column body;

alter table public.knowledge_sources
  add column body text check (body is null or length(btrim(body)) between 1 and 20000);

grant insert (body) on public.knowledge_sources to authenticated;
grant update (body) on public.knowledge_sources to authenticated;

-- Al crear, el autor y el estado los pone la base de datos; al cambiar el
-- texto, vuelve a pending para reindexarla. Solo para la app (ADR 0003).
create or replace function private.guard_knowledge_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.created_by := (select auth.uid());
      new.status := 'pending';
    elsif new.body is distinct from old.body then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;
drop trigger guard_knowledge_source on public.knowledge_sources;
create trigger guard_knowledge_source before insert or update on public.knowledge_sources
  for each row execute function private.guard_knowledge_source();

create function private.emit_knowledge_source_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status <> 'pending' or new.body is distinct from old.body) then
    insert into public.domain_events (organization_id, location_id, type, payload)
    values (new.organization_id, new.location_id, 'knowledge_source.pending', jsonb_build_object('source_id', new.id));
  end if;
  return null;
end;
$$;
revoke all on function private.emit_knowledge_source_event() from public, anon, authenticated, service_role;
create trigger emit_knowledge_source_event
  after insert or update on public.knowledge_sources
  for each row execute function private.emit_knowledge_source_event();
