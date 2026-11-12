-- Avisos del tope mensual de IA al 80 % y al 100 % (PL-ledger, MANUAL §15.1;
-- producto, 2026-11-12: el evento de dominio y un email a los org_admin; el
-- aviso dentro de la app llega con el centro de avisos).
--
-- 1. usage_records.cost_eur pasa a numeric(16, 9): con 6 decimales, una llamada
--    de embeddings pequeña (0,02 $ por millón de tokens) se redondeaba a 0 (nota
--    de V10 a #253). usage_summary depende de la columna: se vuelve a crear igual,
--    con la suma a 9 decimales.
--
-- 2. private.budget_notices: un aviso por organización, mes (UTC) y umbral. La
--    clave primaria es lo que hace que un aviso salga una sola vez: un paso que se
--    repite o dos workflows a la vez no avisan dos veces (insert … on conflict do
--    nothing). En private: no se expone por la API.
--
-- 3. check_budget_thresholds(org): suma lo gastado este mes en usage_records, lo
--    compara con budget_per_month_eur de org_model_settings (o con el de
--    plataforma, 300 €, el de PLATFORM_MODEL_POLICY, si la organización no tiene
--    política) y anota los umbrales que ya se pasaron. Si pasa los dos de golpe,
--    anota los dos pero avisa solo del más alto (un email, no dos). Por cada aviso
--    nuevo escribe un evento usage.budget_threshold (outbox, ADR 0009) con el mes
--    y el umbral, sin importes ni datos personales. Devuelve los umbrales de los
--    que avisó. Solo en organizaciones activas.
--
-- 4. budget_notification(org, mes, umbral): lo que el worker necesita para el
--    email: la organización, el aviso (lo gastado y el tope al pasarlo) y a quién
--    se envía: solo los org_admin (los que gestionan el tope), con el email
--    confirmado y sin banear ni borrar, de una organización activa. null si ese
--    aviso no existe o no se avisó de él.
--
-- Funciones security definer:
-- - check_budget_thresholds escribe en private.budget_notices y en
--   domain_events (service_role no tiene INSERT en ninguna de las dos), solo de
--   la organización que recibe, con lo que calcula de la base de datos (nada del
--   que llama, salvo la organización). Solo la ejecuta service_role, y
--   tenantDb.checkBudgetThresholds le pasa la organización de su acceso.
-- - budget_notification solo lee; corre como su dueño para leer el email de
--   auth.users y private.budget_notices. Solo service_role.
-- Tests en negativo en 46_budget_notices.
--
-- Vuelta atrás: rollbacks/20261112090000_budget_notices.down.sql.

-- ---------------------------------------------------------------------------
-- 1. cost_eur con 9 decimales
-- ---------------------------------------------------------------------------
drop view public.usage_summary;

alter table public.usage_records alter column cost_eur type numeric(16, 9);

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
  sum(cost_eur)::numeric(18, 9) as cost_eur
from public.usage_records
group by organization_id, (occurred_at at time zone 'UTC')::date, location_id, agent_id, source, provider, region, model;

revoke all on public.usage_summary from anon, authenticated, service_role;
grant select on public.usage_summary to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. private.budget_notices
-- ---------------------------------------------------------------------------
create table private.budget_notices (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- El primer día del mes (UTC) al que se refiere.
  month date not null check (month = date_trunc('month', month)::date),
  threshold smallint not null check (threshold in (80, 100)),
  -- Lo gastado y el tope cuando se pasó el umbral.
  spent_eur numeric(16, 9) not null check (spent_eur >= 0),
  budget_eur numeric(12, 4) not null check (budget_eur > 0),
  -- false: se pasó junto con uno más alto y solo se avisó de ese.
  notified boolean not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, month, threshold)
);

revoke all on private.budget_notices from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. check_budget_thresholds
-- ---------------------------------------------------------------------------
create function public.check_budget_thresholds(p_organization_id uuid)
returns smallint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_from timestamptz := v_month::timestamp at time zone 'UTC';
  v_to timestamptz := (v_month + interval '1 month')::timestamp at time zone 'UTC';
  v_budget numeric;
  v_spent numeric;
  v_top smallint;
  v_notified smallint[];
begin
  if not exists (select 1 from public.organizations where id = p_organization_id and status = 'active') then
    return '{}'::smallint[];
  end if;

  -- Sin política propia, el tope de plataforma (PLATFORM_MODEL_POLICY.budget.perMonthEur).
  v_budget := coalesce(
    (select s.budget_per_month_eur from public.org_model_settings s where s.organization_id = p_organization_id),
    300
  );
  if v_budget <= 0 then
    return '{}'::smallint[];
  end if;

  select coalesce(sum(u.cost_eur), 0) into v_spent
  from public.usage_records u
  where u.organization_id = p_organization_id and u.occurred_at >= v_from and u.occurred_at < v_to;

  select max(t) into v_top
  from unnest(array[80, 100]::smallint[]) as t
  where v_spent >= v_budget * t / 100;
  if v_top is null then
    return '{}'::smallint[];
  end if;

  with inserted as (
    insert into private.budget_notices (organization_id, month, threshold, spent_eur, budget_eur, notified)
    select p_organization_id, v_month, t, v_spent, v_budget, t = v_top
    from unnest(array[80, 100]::smallint[]) as t
    where t <= v_top
    on conflict (organization_id, month, threshold) do nothing
    returning threshold, notified
  )
  select array_agg(threshold order by threshold) into v_notified from inserted where notified;

  if v_notified is not null then
    insert into public.domain_events (organization_id, type, payload)
    select p_organization_id, 'usage.budget_threshold', jsonb_build_object('month', v_month, 'threshold', t)
    from unnest(v_notified) as t;
  end if;

  return coalesce(v_notified, '{}'::smallint[]);
end;
$$;

revoke all on function public.check_budget_thresholds(uuid) from public, anon, authenticated;
grant execute on function public.check_budget_thresholds(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. budget_notification
-- ---------------------------------------------------------------------------
create function public.budget_notification(p_organization_id uuid, p_month date, p_threshold smallint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object('name', o.name, 'default_locale', o.default_locale),
    'notice', jsonb_build_object(
      'month', n.month,
      'threshold', n.threshold,
      'spent_eur', n.spent_eur,
      'budget_eur', n.budget_eur,
      'created_at', n.created_at
    ),
    'recipients', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', au.email, 'locale', u.locale)
                       order by m.user_id)
      from public.memberships m
      join public.users u on u.id = m.user_id
      join auth.users au on au.id = m.user_id
      where m.organization_id = n.organization_id
        and m.role = 'org_admin'
        and o.status = 'active'
        and au.email is not null
        and au.email_confirmed_at is not null
        and au.deleted_at is null
        and (au.banned_until is null or au.banned_until <= now())
    ), '[]'::jsonb)
  )
  from private.budget_notices n
  join public.organizations o on o.id = n.organization_id
  where n.organization_id = p_organization_id
    and n.month = p_month
    and n.threshold = p_threshold
    and n.notified;
$$;

revoke all on function public.budget_notification(uuid, date, smallint) from public, anon, authenticated;
grant execute on function public.budget_notification(uuid, date, smallint) to service_role;
