-- La clave de modelo `balanced` (B-01; producto, 2026-11-11: cada agente conversa
-- con el modelo más barato que pasa sus evals). Entre `fast` y `smart`: la que
-- se probará con Recepción, que con `fast` no llega al 90 % de comportamiento.
-- Qué modelo es lo dice GATEWAY_MODELS en @repo/config; aquí solo se admite el
-- nombre de la clave, para que una organización pueda elegirla en
-- org_model_settings.model_by_task. No cambia el modelo de nadie.
--
-- Solo se redefine private.validate_org_model_settings con la lista nueva; el
-- resto de la función es la de 20261030120000_org_model_settings_secrets.
--
-- Vuelta atrás: volver a crear la función con la lista ('fast', 'smart',
-- 'embedding') de 20261030120000, después de cambiar a otra clave las filas de
-- org_model_settings que usen `balanced`:
--   update public.org_model_settings
--     set model_by_task = (select coalesce(jsonb_object_agg(key, case when value = '"balanced"' then '"smart"'::jsonb else value end), '{}') from jsonb_each(model_by_task))
--     where model_by_task::text like '%"balanced"%';

create or replace function private.validate_org_model_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_task text;
  v_key text;
begin
  if exists (select 1 from unnest(new.allowed_providers) p where p !~ '^[a-z][a-z0-9-]{1,39}$')
     or cardinality(new.allowed_providers) > 20
     or cardinality(new.allowed_providers) <> (select count(distinct p) from unnest(new.allowed_providers) p) then
    raise exception 'allowed_providers: nombres en minúsculas, sin repetir, como mucho 20' using errcode = '23514';
  end if;
  for v_task, v_key in select key, value #>> '{}' from jsonb_each(new.model_by_task) loop
    if v_task not in ('classify', 'extract', 'converse', 'reason', 'embed')
       or jsonb_typeof(new.model_by_task -> v_task) <> 'string'
       or v_key not in ('fast', 'balanced', 'smart', 'embedding') then
      raise exception 'model_by_task: tarea o clave de modelo desconocida (%)', v_task using errcode = '23514';
    end if;
  end loop;
  -- Los embeddings solo con la clave de embeddings, y la conversación nunca con ella.
  if (new.model_by_task ? 'embed' and new.model_by_task ->> 'embed' <> 'embedding')
     or exists (select 1 from jsonb_each_text(new.model_by_task) t where t.key <> 'embed' and t.value = 'embedding') then
    raise exception 'model_by_task: embed usa siempre la clave embedding, y solo embed' using errcode = '23514';
  end if;
  return new;
end;
$$;
