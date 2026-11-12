-- Vuelta atrás de 20261112062000_worker_usage_spend.sql. Antes, desplegar un
-- worker que lea el gasto por public.usage_spend.
revoke select on public.usage_records from moodly_worker;
drop policy usage_records_worker on public.usage_records;
