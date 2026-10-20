-- Freno a la fuerza bruta en el login (20261021090000_login_throttle.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Actuar como anon (antes de entrar) o como un usuario con email en el JWT.
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.as_user(p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'email', p_email)::text, true);
  select set_config('role', 'authenticated', true);
$$;
-- N fallos de golpe (como superusuario, para preparar el escenario).
create function pg_temp.fail(p_email text, p_ip text, n integer) returns void language sql as $$
  select public.login_record_failure(p_email, p_ip) from generate_series(1, n);
$$;

-- ---------------------------------------------------------------------------
-- Quién puede hacer qué
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'public.login_throttle(text, text)', 'execute'),
  'anon puede consultar la espera (aún no hay sesión al entrar)');
select ok(has_function_privilege('anon', 'public.login_record_failure(text, text)', 'execute'),
  'anon puede registrar un fallo');
select ok(not has_function_privilege('anon', 'public.login_record_success()', 'execute'),
  'anon NO puede borrar fallos');
select ok(not has_table_privilege('anon', 'private.login_failures', 'select')
      and not has_table_privilege('authenticated', 'private.login_failures', 'select'),
  'nadie lee la tabla de fallos directamente');
select ok(not has_table_privilege('authenticated', 'private.login_failures', 'delete'),
  'nadie borra la tabla de fallos directamente');

-- ---------------------------------------------------------------------------
-- Umbral email + IP (5) y espera creciente con tope
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select is(public.login_throttle('ana@demo.test', '203.0.113.1'), 0, 'sin fallos: puede intentarlo');
select pg_temp.fail('ana@demo.test', '203.0.113.1', 4);
select is(public.login_throttle('ana@demo.test', '203.0.113.1'), 0, '4 fallos: aún puede intentarlo');
select public.login_record_failure('ana@demo.test', '203.0.113.1');
select ok(public.login_throttle('ana@demo.test', '203.0.113.1') between 1 and 30, '5 fallos: espera hasta 30 s');
select pg_temp.fail('ana@demo.test', '203.0.113.1', 2);
select ok(public.login_throttle('ana@demo.test', '203.0.113.1') between 61 and 120, '7 fallos: la espera crece (hasta 120 s)');
select pg_temp.fail('ana@demo.test', '203.0.113.1', 20);
select ok(public.login_throttle('ana@demo.test', '203.0.113.1') between 1 and 900, 'la espera nunca pasa de 15 min');
select is(public.login_throttle('ANA@demo.test ', '203.0.113.1') > 0, true, 'el email se normaliza (mayúsculas y espacios)');

-- ---------------------------------------------------------------------------
-- Los umbrales no se mezclan
-- ---------------------------------------------------------------------------
select pg_temp.fail('bea@demo.test', '203.0.113.2', 5);
select is(public.login_throttle('bea@demo.test', '198.51.100.9'), 0, 'mismo email desde otra IP: no frena con solo 5 fallos');
select is(public.login_throttle('otra@demo.test', '203.0.113.2'), 0, 'otro email desde la misma IP: no frena');
select pg_temp.fail('carla@demo.test', ip, 1) from (select '198.51.100.' || g as ip from generate_series(1, 20) g) ips;
select ok(public.login_throttle('carla@demo.test', '192.0.2.77') > 0, 'ataque distribuido: 20 fallos del mismo email desde IPs distintas frenan');

-- ---------------------------------------------------------------------------
-- Datos guardados solo como hash, y purga
-- ---------------------------------------------------------------------------
reset role;
select is((select count(*)::int from private.login_failures where email_hash like '%@%' or ip_hash like '%.%'), 0,
  'ni emails ni IPs en claro');
insert into private.login_failures (email_hash, ip_hash, failed_at) values ('viejo', 'viejo', now() - interval '2 days');
select public.login_record_failure('dani@demo.test', '203.0.113.3');
select is((select count(*)::int from private.login_failures where email_hash = 'viejo'), 0, 'los fallos de más de un día se purgan');

-- ---------------------------------------------------------------------------
-- Login correcto: solo borra los fallos propios
-- ---------------------------------------------------------------------------
select pg_temp.as_user('ana@demo.test');
select public.login_record_success();
reset role;
select is((select count(*)::int from private.login_failures where email_hash = encode(extensions.digest('ana@demo.test', 'sha256'), 'hex')), 0,
  'al entrar, se borran los fallos de su email');
select ok((select count(*)::int from private.login_failures where email_hash = encode(extensions.digest('bea@demo.test', 'sha256'), 'hex')) = 5,
  'los fallos de otros emails siguen ahí');

select pg_temp.as_user(null);
select throws_ok('select public.login_record_success()', '42501', null, 'sin email en el token: error');

-- ---------------------------------------------------------------------------
-- Entradas absurdas
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok(format('select public.login_throttle(%L, %L)', repeat('a', 400), '203.0.113.1'), '22023', null,
  'un email de más de 320 caracteres se rechaza');

select * from finish();
rollback;
