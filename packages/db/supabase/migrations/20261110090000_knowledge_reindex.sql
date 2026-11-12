-- «Volver a indexar» una fuente de conocimiento en error (paso B20-3, ADR 0048,
-- «Consecuencias»). Hasta ahora, una fuente en error (falló el proveedor de
-- embeddings o la política de modelos no lo permitía) solo se reindexaba
-- cambiando su texto.
--
-- - La app puede escribir knowledge_sources.status, pero la guarda
--   (guard_knowledge_source, solo con authenticated, ADR 0003) solo deja un
--   cambio: de error a pending. Cualquier otro cambio de estado desde la app
--   sigue dando 42501, como antes.
-- - Lo puede quien ya podía cambiar la fuente: el org_admin con aal2 (las
--   políticas de 20261031120000, sin cambios).
-- - Volver a pending emite knowledge_source.pending (emit_knowledge_source_event,
--   sin cambios) y el worker la indexa otra vez.
--
-- Sin funciones security definer nuevas: guard_knowledge_source sigue siendo invoker.
--
-- Vuelta atrás:
--   revoke update (status) on public.knowledge_sources from authenticated;
--   guard_knowledge_source: la versión de 20261109180000.

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
    else
      -- El único cambio de estado que pide la app: volver a indexar una fuente en error.
      if new.status is distinct from old.status and not (old.status = 'error' and new.status = 'pending') then
        raise exception 'desde la app, una fuente solo vuelve a indexarse desde error' using errcode = '42501';
      end if;
      if new.body is distinct from old.body then
        new.status := 'pending';
      end if;
    end if;
  end if;
  return new;
end;
$$;

grant update (status) on public.knowledge_sources to authenticated;
