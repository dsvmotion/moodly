-- El resultado del último envío y el freno de envíos de clave
-- (20261124100000, int-koibox; ADR 0055, decisiones de producto del
-- 2026-11-24): el resultado solo lo escribe el worker, junto con la marca; una
-- persona no lo toca; y como mucho 5 envíos por integración en 15 minutos,
-- contados en la organización de la fila, nunca en las de otras.
begin;
\ir _fixtures/tenants.psql
select plan(37);

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres: las guardas no actúan)
-- ---------------------------------------------------------------------------
-- X, Y, Z y W: de A, pendientes. B: de B, pendiente. P: de plataforma, de A.
insert into public.integrations (organization_id, provider, kind, status)
values (:org_a, 'koibox', 'native', 'pending') returning id as int_x \gset
insert into public.integrations (organization_id, location_id, provider, kind, status)
values (:org_a, :loc_a1, 'koibox', 'native', 'pending') returning id as int_y \gset
insert into public.integrations (organization_id, location_id, provider, kind, status)
values (:org_a, :loc_a2, 'koibox', 'native', 'pending') returning id as int_z \gset
insert into public.integrations (organization_id, location_id, provider, kind, status)
values (:org_a, :loc_a3, 'koibox', 'native', 'pending') returning id as int_w \gset
insert into public.integrations (organization_id, provider, kind, status)
values (:org_b, 'koibox', 'native', 'pending') returning id as int_b \gset
insert into public.integrations (organization_id, provider, kind, status, external_connection_id)
values (:org_a, 'google-calendar', 'platform', 'active', 'conn-61-a') returning id as plat_a \gset

-- ===========================================================================
-- 1. Estructura y privilegios
-- ===========================================================================
select col_type_is('public', 'integrations', 'last_submission_result', 'text', 'integrations.last_submission_result es texto');
select throws_ok(format($$update public.integrations set last_submission_result = 'applied' where id = %L$$, :'int_x'),
  '23514', null, 'sin marca no hay resultado');
select throws_ok(format($$update public.integrations set last_submission_at = now(), last_submission_id = gen_random_uuid(),
  last_submission_result = 'otro' where id = %L$$, :'int_x'),
  '23514', null, 'y el resultado es applied o rejected');
select ok(has_column_privilege('moodly_worker', 'public.integrations', 'last_submission_result', 'select')
          and has_column_privilege('moodly_worker', 'public.integrations', 'last_submission_result', 'update'),
  'el worker lee y escribe el resultado');
select ok(not has_column_privilege('authenticated', 'public.integrations', 'last_submission_result', 'update')
          and not has_column_privilege('authenticated', 'public.integrations', 'last_submission_result', 'insert'),
  'la app no lo escribe (ni al crear ni al cambiar la integración)');
select ok(has_column_privilege('authenticated', 'public.integrations', 'last_submission_result', 'select'),
  'pero sí lo lee, para la pantalla');
select is(
  (select array_agg(format('%s:%s:%s', p.proname, p.prosecdef, p.proconfig::text) order by p.proname::text collate "C") from pg_proc p
   where p.oid in ('private.limit_secret_submissions()'::regprocedure,
                   'private.recent_key_submissions(uuid, uuid, timestamptz)'::regprocedure)),
  array['limit_secret_submissions:f:{"search_path=\"\""}', 'recent_key_submissions:t:{"search_path=\"\""}'],
  'el trigger del freno es invoker (como las guardas) y la cuenta, security definer (la app no lee domain_events); las dos con search_path vacío');
select is(
  (select array_agg(r order by r)
   from unnest(array['anon', 'authenticated', 'service_role', 'moodly_worker']) as r
   where has_function_privilege(r, 'private.recent_key_submissions(uuid, uuid, timestamptz)', 'execute')),
  array['authenticated'], 'la cuenta solo la ejecuta authenticated (el trigger corre como quien inserta)');
select is(
  (select array_agg(t.tgname::text order by t.tgname::text collate "C") from pg_trigger t
   where t.tgrelid = 'public.integration_secret_submissions'::regclass and not t.tgisinternal
     and (t.tgtype & 2) = 2 and (t.tgtype & 4) = 4),
  array['guard_secret_submission', 'limit_secret_submissions'],
  'el freno va después de la guarda (orden alfabético de los BEFORE INSERT): created_at ya es la hora del servidor');

-- ===========================================================================
-- 2. Una persona no toca el resultado (guard_integration_write)
-- ===========================================================================
select pg_temp.login_mfa(:a_admin) as s_a \gset
select throws_ok(format($$update public.integrations set last_submission_result = 'applied' where id = %L$$, :'int_x'),
  '42501', null, 'el org_admin con MFA no pone el resultado');
select throws_ok(format($$insert into public.integrations (organization_id, location_id, provider, kind, status, last_submission_result)
  values (%L, %L, 'koibox', 'native', 'pending', 'applied')$$, :org_b, :loc_b1),
  '42501', null, 'ni crea una integración con resultado');
select throws_ok(format($$select private.recent_key_submissions(%L, %L, now())$$, :org_b, :'int_b'),
  '42501', null, 'la cuenta no responde por otra organización (no deja saber cuántos envíos tiene)');
select is(private.recent_key_submissions(:org_a, :'int_x', now()), 0, 'y por la suya, sí');
reset role;

-- La guarda también, por si un día la app tuviera el privilegio de la columna.
update public.integrations set last_submission_at = now(), last_submission_id = gen_random_uuid(),
  last_submission_result = 'rejected' where id = :'int_w';
grant update (last_submission_result) on public.integrations to authenticated;
select pg_temp.login_mfa(:a_admin) as s_a2 \gset
select throws_ok(format($$update public.integrations set last_submission_result = 'applied' where id = %L$$, :'int_w'),
  '42501', 'esa columna de la integración no la cambia una persona',
  'con el privilegio de la columna, la lista blanca de la app sigue sin dejarle cambiar el resultado');
reset role;
revoke update (last_submission_result) on public.integrations from authenticated;

-- ===========================================================================
-- 3. El worker: el resultado va con la marca (guard_worker_integration)
-- ===========================================================================
-- Como en 60: postgres puede actuar como el worker solo dentro de este test (rollback).
grant moodly_worker to postgres with set true;
grant usage on schema extensions to moodly_worker;
set local role moodly_worker;
select set_config('moodly.organization_id', :org_a, true) as _org \gset
select throws_ok(format($$update public.integrations set last_submission_at = now(), last_submission_id = gen_random_uuid() where id = %L$$, :'int_x'),
  '42501', 'la marca del último envío avanza con su resultado', 'la marca no avanza sin resultado');
select lives_ok(format($$update public.integrations set last_submission_at = now(), last_submission_id = '00000000-0000-4000-8000-000000000001',
  last_submission_result = 'rejected' where id = %L$$, :'int_x'),
  'avanza con «rejected»');
select throws_ok(format($$update public.integrations set last_submission_result = 'applied' where id = %L$$, :'int_x'),
  '42501', 'el resultado del último envío solo cambia con la marca', 'el resultado no cambia sin que avance la marca');
select throws_ok(format($$update public.integrations set last_submission_id = '00000000-0000-4000-8000-000000000000',
  last_submission_result = 'applied' where id = %L$$, :'int_x'),
  '42501', 'la marca del último envío solo avanza', 'ni con una marca que retrocede');
select throws_ok(format($$update public.integrations set last_submission_result = null where id = %L$$, :'int_x'),
  '42501', null, 'ni se borra');
select lives_ok(format($$update public.integrations set last_submission_id = '00000000-0000-4000-8000-000000000002',
  last_submission_result = 'applied' where id = %L$$, :'int_x'),
  'el envío siguiente deja «applied»');
select throws_ok(format($$update public.integrations set last_submission_at = now(), last_submission_id = gen_random_uuid(),
  last_submission_result = 'applied' where id = %L$$, :'plat_a'),
  '42501', 'una integración de plataforma no recibe claves', 'una de plataforma no tiene resultado');
select results_eq(format($$with w as (update public.integrations set last_submission_at = now(), last_submission_id = gen_random_uuid(),
  last_submission_result = 'applied' where id = %L returning id) select count(*)::int from w$$, :'int_b'),
  $$values (0)$$, 'ni toca la de otra organización');
reset role;
select is((select last_submission_result from public.integrations where id = :'int_x'), 'applied', 'queda el resultado del último envío');

-- ===========================================================================
-- 4. El freno: 5 envíos por integración en 15 minutos
-- ===========================================================================
-- Otra organización con 5 eventos recientes que dicen ser de Y (un evento con
-- un integration_id que no es suyo): no cuentan para A.
insert into public.domain_events (organization_id, type, payload)
select :org_b, 'integration.key_submitted', jsonb_build_object('submission_id', gen_random_uuid(), 'integration_id', :'int_y', 'provider', 'koibox')
from generate_series(1, 5);
-- Z: 5 envíos de hace más de 15 minutos: ya no cuentan.
insert into public.domain_events (organization_id, type, payload, created_at)
select :org_a, 'integration.key_submitted', jsonb_build_object('submission_id', gen_random_uuid(), 'integration_id', :'int_z', 'provider', 'koibox'),
       now() - interval '16 minutes'
from generate_series(1, 5);

create function pg_temp.submit(p_org uuid, p_integration uuid) returns void language sql as $$
  insert into public.integration_secret_submissions (id, organization_id, integration_id, provider, key_ref, encrypted_data_key, ciphertext)
  values (gen_random_uuid(), p_org, p_integration, 'koibox', 'local:v1', 'ZGVr', 'Y2lw');
$$;
grant execute on function pg_temp.submit(uuid, uuid) to authenticated;

select pg_temp.login_mfa(:a_admin) as s_a3 \gset
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'), 'X: 1.º envío');
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'), 'X: 2.º');
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'), 'X: 3.º');
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'), 'X: 4.º');
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'), 'X: 5.º');
select throws_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'),
  '54000', 'demasiados envíos de clave para esta integración: espera unos minutos', 'X: el 6.º falla con 54000');
select throws_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'),
  '54000', null, 'y el 7.º también');
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_y'),
  'otra integración de la misma organización no se ve afectada (y los eventos de otra organización con su id no cuentan)');
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_z'),
  'los envíos de hace más de 15 minutos no cuentan');
reset role;

select pg_temp.login_mfa(:b_admin) as s_b \gset
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_b, :'int_b'),
  'otra organización no se ve afectada');
reset role;

select is(
  (select count(*)::int from public.integration_secret_submissions where integration_id = :'int_x'),
  5, 'de X quedan solo los 5 envíos que pasaron (los rechazados no dejan fila)…');
select is(
  (select count(*)::int from public.domain_events where type = 'integration.key_submitted' and organization_id = :org_a
     and payload->>'integration_id' = :'int_x'),
  5, '…ni evento');

-- El freno no escribe nada: el 6.º no deja rastro en ninguna tabla (lo dicen
-- las dos aserciones de arriba) y el freno, como postgres (la plataforma), no actúa.
select lives_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'),
  'la plataforma (postgres) no pasa por el freno, como las guardas');

-- Con un worker que ya ha borrado los envíos, los eventos siguen contando.
delete from public.integration_secret_submissions where integration_id = :'int_x';
select pg_temp.login_mfa(:a_admin) as s_a4 \gset
select throws_ok(format($$select pg_temp.submit(%L, %L)$$, :org_a, :'int_x'),
  '54000', null, 'borrar los envíos procesados no reabre el freno');
reset role;

select * from finish();
rollback;
