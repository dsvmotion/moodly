-- PL-T1, paso 3c-1 (ADR 0049): moodly_worker escribe los runs de los agentes y
-- el libro de consumo de su organización, por SQL bajo RLS, en vez de la clave
-- secreta por PostgREST (converse.ts: startRun, finishRun, recordUsage;
-- summary.ts: bookSummaryUsage).
--
-- moodly_worker no es «la plataforma»: es el rol, con menos privilegios, del
-- código que guía el LLM (decisión de V1, 2026-11-12). Por eso:
-- - Privilegios por columna, los mínimos: crear un run (sin requested_by ni
--   config_snapshot_id) y cambiar solo su estado, modelo, tokens y coste;
--   anotar consumo. Nunca DELETE, TRUNCATE ni cambiar organization_id.
-- - guard_worker_agent_run, solo para moodly_worker (decisión de V1 sobre la
--   revisión de V10, 2026-11-12). Por estado del run antes del cambio:
--     · en marcha (running): su estado solo sale hacia uno de espera o de
--       cierre (awaiting_approval, awaiting_knowledge, handed_off, completed,
--       failed); modelo, tokens y coste, libres. Un run nace siempre así.
--     · en espera (awaiting_approval, awaiting_knowledge): solo pasa a
--       completed, y ese cambio no toca nada más que el estado. Sin cambiar el
--       estado, solo puede subir tokens y coste (ver abajo).
--     · cerrado (handed_off, completed, failed): estado y modelo, fijos; tokens
--       y coste solo suben (cada uno, nuevo >= antiguo), nunca bajan.
--   Subir tokens y coste con el run ya fuera de «running» es lo que hace
--   bookSummaryUsage (summary.ts): el run se cierra antes de resumir y el coste
--   del resumen se apunta después, en valores absolutos. Si el turno dejó el
--   run esperando una aprobación, el resumen lo apunta con el run en espera:
--   por eso subir también vale ahí.
--   service_role queda igual (la plataforma, el panel interno y los tests lo
--   usan para otras transiciones).
-- - En agent_runs y usage_records no hay guardas que solo actúen para
--   authenticated: validate_agent_run y validate_usage_record (que el run, el
--   agente y el local sean de la organización de la fila) actúan para todos los
--   roles, también moodly_worker. Tests en 47_worker_runs_usage.
-- - validate_usage_record es invoker y consulta agents: moodly_worker lee los
--   agentes de su organización (la política agents_worker ya existe). Así esa
--   validación ve solo los de su organización, y un agente de otra no existe.
-- - usage_records_worker pasa de SELECT a FOR ALL (USING y WITH CHECK por la
--   organización de la transacción, como el resto de políticas del worker y como
--   pide 00_rls_enabled); lo que puede hacer lo limitan los privilegios: leer y
--   anotar.
--
-- Vuelta atrás: rollbacks/20261112063000_worker_runs_usage_writes.down.sql.

create function private.guard_worker_agent_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'moodly_worker' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'running' then
      raise exception 'el worker solo crea runs en marcha' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status = 'running' then
    if new.status is distinct from old.status
       and new.status not in ('awaiting_approval', 'awaiting_knowledge', 'handed_off', 'completed', 'failed') then
      raise exception 'el worker solo cierra runs en marcha (de % a % no)', old.status, new.status using errcode = '42501';
    end if;
    return new;
  end if;
  -- Fuera de «running», el modelo no cambia y lo apuntado no baja.
  if new.model is distinct from old.model then
    raise exception 'el worker no cambia el modelo de un run que ya no está en marcha' using errcode = '42501';
  end if;
  if new.tokens_in < old.tokens_in or new.tokens_out < old.tokens_out or new.cost_eur < old.cost_eur then
    raise exception 'el worker no baja los tokens ni el coste de un run' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status not in ('awaiting_approval', 'awaiting_knowledge') or new.status <> 'completed' then
      raise exception 'el worker no cambia el estado de un run cerrado ni lleva uno en espera a otro estado que completed (de % a % no)',
        old.status, new.status using errcode = '42501';
    end if;
    if (new.tokens_in, new.tokens_out, new.cost_eur) is distinct from (old.tokens_in, old.tokens_out, old.cost_eur) then
      raise exception 'el worker, al completar un run en espera, solo cambia su estado' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_agent_run() from public;
create trigger guard_worker_agent_run before insert or update on public.agent_runs
  for each row execute function private.guard_worker_agent_run();

grant select on public.agents to moodly_worker;
grant insert (id, organization_id, location_id, agent_id, trigger, trigger_ref, status) on public.agent_runs to moodly_worker;
grant update (status, model, tokens_in, tokens_out, cost_eur) on public.agent_runs to moodly_worker;

drop policy usage_records_worker on public.usage_records;
create policy usage_records_worker on public.usage_records
  for all to moodly_worker
  using (organization_id = (select private.worker_organization_id()))
  with check (organization_id = (select private.worker_organization_id()));
grant insert (organization_id, location_id, run_id, agent_id, source, metric, quantity, tokens_in, tokens_out,
              cost_eur, provider, via, region, model, model_key, call_index, occurred_at)
  on public.usage_records to moodly_worker;
