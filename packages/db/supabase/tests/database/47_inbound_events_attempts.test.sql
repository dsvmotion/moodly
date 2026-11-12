-- Los intentos de un evento de entrada (20261112080000): empiezan en 0, solo
-- crecen, tienen techo, y los cambia el worker, nadie de la app.
begin;
\ir _fixtures/tenants.psql
select plan(8);

insert into public.channel_accounts (organization_id, location_id, channel, external_id, default_agent_type, status)
values (:org_a, :loc_a1, 'webchat', 'web-a1', 'customer', 'active') returning id as ca_a \gset
insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload)
values (:org_a, :'ca_a', 'evt-1', '{}') returning id as evt \gset

select is((select attempts from public.inbound_events where id = :'evt'), 0::smallint, 'un evento nace sin intentos');
select throws_ok(
  format($$insert into public.inbound_events (organization_id, channel_account_id, provider_event_id, payload, attempts)
           values (%L, %L, 'evt-2', '{}', 3)$$, :org_a, :'ca_a'),
  '23514', null, 'y no se puede insertar con intentos');

set local role service_role;
select lives_ok(
  format($$update public.inbound_events set attempts = 2, status = 'failed', error_code = 'timeout' where id = %L$$, :'evt'),
  'el worker apunta los intentos fallidos');
select throws_ok(
  format($$update public.inbound_events set attempts = 1 where id = %L$$, :'evt'),
  '42501', null, 'los intentos no bajan');
select throws_ok(
  format($$update public.inbound_events set attempts = 21 where id = %L$$, :'evt'),
  '23514', null, 'y tienen techo');
select lives_ok(
  format($$update public.inbound_events set attempts = 5, error_code = 'dead_letter' where id = %L$$, :'evt'),
  'al agotarlos queda como fallido para siempre (dead_letter)');
reset role;

select pg_temp.login_mfa(:a_admin) as s \gset
select throws_ok(
  format($$update public.inbound_events set attempts = 6 where id = %L$$, :'evt'),
  '42501', null, 'nadie de la app los cambia, ni el org_admin');
reset role;
select is((select prosecdef from pg_proc where oid = 'private.guard_inbound_event_attempts()'::regprocedure), false,
  'la guarda no es security definer');

select * from finish();
rollback;
