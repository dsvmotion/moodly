-- Vuelta atrás de 20261112090000_budget_notices.sql: fuera los avisos del tope
-- (sus funciones y su tabla) y cost_eur vuelve a 6 decimales. Los eventos
-- usage.budget_threshold ya escritos se quedan: sin consumidor, el worker de la
-- versión anterior solo los registra.

drop function public.budget_notification(uuid, date, smallint);
drop function public.check_budget_thresholds(uuid);
drop table private.budget_notices;

drop view public.usage_summary;

-- Redondea a 6 decimales lo que tuviera más (las llamadas muy pequeñas pueden quedar en 0).
alter table public.usage_records alter column cost_eur type numeric(12, 6);

create view public.usage_summary
with (security_invoker = on) as
select
  organization_id,
  (occurred_at at time zone 'UTC')::date as day,
  location_id,
  agent_id,
  source,
  provider,
  region,
  model,
  count(*)::integer as calls,
  sum(tokens_in)::bigint as tokens_in,
  sum(tokens_out)::bigint as tokens_out,
  sum(cost_eur)::numeric(14, 6) as cost_eur
from public.usage_records
group by organization_id, (occurred_at at time zone 'UTC')::date, location_id, agent_id, source, provider, region, model;

revoke all on public.usage_summary from anon, authenticated, service_role;
grant select on public.usage_summary to authenticated, service_role;
