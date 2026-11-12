-- El libro de consumo (PL-ledger; MANUAL §4 y §15.1, ADR 0033 §7, ADR 0051 §6):
-- una fila por llamada a un modelo, con quién la hizo, por qué vía y región,
-- cuántos tokens y cuánto costó. De aquí salen el gasto del día y del mes que
-- el enrutador mira antes de cada llamada, el informe de residencia y, cuando
-- llegue la facturación (B5), el saldo de créditos (lo concedido frente a esto).
--
-- 1. usage_records: particionada por mes desde la primera migración (MANUAL §4).
--    Solo la escribe la plataforma (service_role, INSERT): no se actualiza ni se
--    borra (append-only); se pierde solo con su organización. Las particiones
--    viven en el esquema private (fuera de la API); se lee siempre por la tabla
--    padre, con su RLS. El coste va en euros a precio de lista (USD_TO_EUR de
--    @repo/config); el margen de plataforma lo aplica la facturación (un crédito
--    es 1 € de consumo a precio de lista más ese margen, MANUAL §18.0 #5).
-- 2. Quién lo ve: el org_admin de la organización (como su política de modelos)
--    y el equipo interno con permiso de soporte. Nadie más del equipo.
-- 3. usage_summary: la vista para el org_admin, por día, local, agente, origen y
--    modelo. Con security_invoker: aplica la RLS de quien la consulta.
-- 4. usage_spend: el gasto del día y del mes de una organización, sumado en la
--    base de datos. Solo service_role; tenantDb.usageSpend le pasa la organización
--    de su acceso.
-- 5. org_model_settings.budget_per_month_eur: el tope del mes, junto a los del
--    run y del día que ya miraba el enrutador. La gestiona el org_admin con aal2,
--    como los otros topes, y queda en audit_logs.
--
-- Funciones security definer: solo private.audit_org_model_settings, que ya lo
-- era (escribe en audit_logs por quien cambia la política) y que aquí se
-- redefine para anotar también el tope del mes. No escribe en ninguna tabla de
-- tenant nueva. Tests en 41_usage_records.
--
-- Las organizaciones que ya tienen política toman como tope del mes 300 € o 31
-- días de su tope del día, lo que sea mayor (private.default_month_budget):
-- así la comprobación «día <= mes» no rompe la migración.
--
-- Particiones: de noviembre de 2026 a diciembre de 2027, más una por defecto
-- para lo que caiga fuera. private.create_usage_records_partition(mes) crea la
-- de un mes (idempotente); antes de enero de 2028 hay que crear las siguientes
-- (y, si la por defecto ya tiene filas de ese mes, moverlas antes).
--
-- Vuelta atrás:
--   drop view public.usage_summary;
--   drop function public.usage_spend(uuid, timestamptz, timestamptz);
--   drop table public.usage_records cascade;  -- con sus particiones
--   drop function private.create_usage_records_partition(date);
--   drop function private.validate_usage_record();
--   drop function private.default_month_budget(numeric);
--   alter table public.org_model_settings drop column budget_per_month_eur;
--   (y volver a crear private.audit_org_model_settings y los grants de
--   org_model_settings como en 20261030120000)

-- ---------------------------------------------------------------------------
-- 1. usage_records
-- ---------------------------------------------------------------------------
create table public.usage_records (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- El local, el run y el agente, si los hay. Si se borran, el gasto se queda.
  location_id uuid references public.locations (id) on delete set null,
  run_id uuid references public.agent_runs (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  -- Qué lo gastó: el turno de un agente, la indexación del conocimiento…
  source text not null check (source in ('agent_turn', 'embedding')),
  -- La medida (MANUAL §4): tokens de un modelo de texto o de embeddings.
  metric text not null check (metric in ('llm_tokens', 'embedding_tokens')),
  quantity bigint not null check (quantity >= 0),
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  cost_eur numeric(12, 6) not null check (cost_eur >= 0),
  -- Por dónde fue (ADR 0051): proveedor real, vía, región y modelo.
  provider text not null check (provider ~ '^[a-z][a-z0-9-]{1,39}$'),
  via text not null check (via ~ '^[a-z][a-z0-9_-]{1,39}$'),
  region text not null check (region in ('eu', 'us', 'other')),
  model text not null check (length(model) between 1 and 200),
  model_key text check (model_key is null or model_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- El orden de la llamada en su run: con run_id y occurred_at, la hace única
  -- (un reintento de la entrega no la anota dos veces).
  call_index smallint check (call_index is null or call_index >= 0),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id, occurred_at),
  constraint usage_records_call_once unique (run_id, call_index, occurred_at),
  constraint usage_records_metric_quantity check (quantity = tokens_in + tokens_out)
) partition by range (occurred_at);

create index usage_records_org_occurred_idx on public.usage_records (organization_id, occurred_at desc);
create index usage_records_location_idx on public.usage_records (location_id) where location_id is not null;
create index usage_records_run_idx on public.usage_records (run_id) where run_id is not null;
create index usage_records_agent_idx on public.usage_records (agent_id) where agent_id is not null;

-- La partición de un mes, en private. Idempotente.
create function private.create_usage_records_partition(p_month date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_name text := 'usage_records_' || to_char(v_from, 'YYYYMM');
begin
  execute format(
    'create table if not exists private.%I partition of public.usage_records for values from (%L) to (%L)',
    v_name, v_from, (v_from + interval '1 month')::date);
  execute format('revoke all on private.%I from public, anon, authenticated, service_role', v_name);
end;
$$;
revoke all on function private.create_usage_records_partition(date) from public, anon, authenticated, service_role;

select private.create_usage_records_partition(m::date)
from generate_series(date '2026-11-01', date '2027-12-01', interval '1 month') as m;

create table private.usage_records_default partition of public.usage_records default;
revoke all on private.usage_records_default from public, anon, authenticated, service_role;

-- El local, el run y el agente son de la organización de la fila.
create function private.validate_usage_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'el local del consumo no es de su organización' using errcode = '23514';
  end if;
  if new.run_id is not null and not exists (
    select 1 from public.agent_runs r where r.id = new.run_id and r.organization_id = new.organization_id
  ) then
    raise exception 'el run del consumo no es de su organización' using errcode = '23514';
  end if;
  if new.agent_id is not null and not exists (
    select 1 from public.agents a where a.id = new.agent_id and a.organization_id = new.organization_id
  ) then
    raise exception 'el agente del consumo no es de su organización' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_usage_record() from public;
create trigger validate_usage_record before insert on public.usage_records
  for each row execute function private.validate_usage_record();

-- ---------------------------------------------------------------------------
-- 2. Quién lo ve y quién lo escribe
-- ---------------------------------------------------------------------------
alter table public.usage_records enable row level security;
alter table public.usage_records force row level security;

create policy usage_records_select on public.usage_records
  for select to authenticated
  using ((select private.session_is_active()) and private.has_org_role(organization_id, array['org_admin']));

create policy usage_records_select_platform_staff on public.usage_records
  for select to authenticated
  using ((select private.session_is_active()) and private.staff_can_read(organization_id));

revoke all on public.usage_records from anon, authenticated, service_role;
grant select on public.usage_records to authenticated;
-- La plataforma anota y lee; nunca cambia ni borra lo anotado.
grant select, insert on public.usage_records to service_role;

-- ---------------------------------------------------------------------------
-- 3. usage_summary
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. usage_spend
-- ---------------------------------------------------------------------------
create function public.usage_spend(p_organization_id uuid, p_day_start timestamptz, p_month_start timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'day_eur', coalesce(sum(cost_eur) filter (where occurred_at >= p_day_start), 0),
    'month_eur', coalesce(sum(cost_eur) filter (where occurred_at >= p_month_start), 0)
  )
  from public.usage_records
  where organization_id = p_organization_id
    and occurred_at >= least(p_day_start, p_month_start);
$$;

revoke all on function public.usage_spend(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.usage_spend(uuid, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 5. El tope del mes
-- ---------------------------------------------------------------------------
-- El tope del mes por defecto para un tope del día: 300 €, o 31 días del tope
-- del día si es mayor (una organización con 500 €/día no puede quedarse con un
-- tope del mes de 300). Lo usa la migración para las filas que ya existen.
create function private.default_month_budget(p_day_eur numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(greatest(300::numeric, p_day_eur * 31), 1000000::numeric);
$$;
revoke all on function private.default_month_budget(numeric) from public, anon, authenticated, service_role;

-- Primero la columna con su valor por defecto; al final de la migración (con la
-- auditoría ya al día), las filas que ya existen pasan a su tope según su día,
-- y solo entonces entra la comprobación de orden.
alter table public.org_model_settings
  add column budget_per_month_eur numeric(12, 4) not null default 300
    check (budget_per_month_eur > 0 and budget_per_month_eur <= 1000000);


grant insert (budget_per_month_eur) on public.org_model_settings to authenticated;
grant update (budget_per_month_eur) on public.org_model_settings to authenticated;

create or replace function private.audit_org_model_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed jsonb := '{}'::jsonb;
  -- Quién cambió lo decide la guarda (que ve el rol real); aquí, como security
  -- definer, current_user es el dueño de la función y no sirve para eso.
  v_actor uuid := new.updated_by;
begin
  if tg_op = 'INSERT' then
    v_changed := jsonb_build_object('residency', new.residency, 'allowed_providers', new.allowed_providers,
      'model_by_task', new.model_by_task, 'connection', new.connection,
      'budget_per_run_eur', new.budget_per_run_eur, 'budget_per_day_eur', new.budget_per_day_eur,
      'budget_per_month_eur', new.budget_per_month_eur);
  else
    if new.residency is distinct from old.residency then v_changed := v_changed || jsonb_build_object('residency', new.residency); end if;
    if new.allowed_providers is distinct from old.allowed_providers then v_changed := v_changed || jsonb_build_object('allowed_providers', new.allowed_providers); end if;
    if new.model_by_task is distinct from old.model_by_task then v_changed := v_changed || jsonb_build_object('model_by_task', new.model_by_task); end if;
    if new.connection is distinct from old.connection then v_changed := v_changed || jsonb_build_object('connection', new.connection); end if;
    if new.budget_per_run_eur is distinct from old.budget_per_run_eur then v_changed := v_changed || jsonb_build_object('budget_per_run_eur', new.budget_per_run_eur); end if;
    if new.budget_per_day_eur is distinct from old.budget_per_day_eur then v_changed := v_changed || jsonb_build_object('budget_per_day_eur', new.budget_per_day_eur); end if;
    if new.budget_per_month_eur is distinct from old.budget_per_month_eur then v_changed := v_changed || jsonb_build_object('budget_per_month_eur', new.budget_per_month_eur); end if;
    if v_changed = '{}'::jsonb then return null; end if;
  end if;
  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target, metadata)
  values (new.organization_id,
          case when v_actor is null then 'system' else 'user' end,
          v_actor,
          'model_settings.' || lower(tg_op),
          jsonb_build_object('organization_id', new.organization_id),
          jsonb_build_object('changed', v_changed));
  return null;
end;
$$;

-- Las organizaciones que ya tenían política: su tope del mes según su día. Lo
-- cambia la plataforma (queda en audit_logs como «system»). Después, la
-- comprobación «día <= mes».
update public.org_model_settings
  set budget_per_month_eur = private.default_month_budget(budget_per_day_eur)
  where budget_per_month_eur < private.default_month_budget(budget_per_day_eur);

alter table public.org_model_settings
  add constraint org_model_settings_budget_month_order check (budget_per_day_eur <= budget_per_month_eur);
