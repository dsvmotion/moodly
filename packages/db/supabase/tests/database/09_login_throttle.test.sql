-- Freno a la fuerza bruta en el login (20261021090000_login_throttle.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Clave de servidor de prueba: la registra la plataforma (aquí, superusuario).
create function pg_temp.k() returns text language sql as $$ select 'clave-de-servidor-de-prueba-0123456789abcdef' $$;
select public.register_server_key('login_throttle', encode(extensions.digest(pg_temp.k(), 'sha256'), 'hex'));

-- Actuar como anon (antes de entrar) o como un usuario con email en el JWT.
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
  select set_config('role', 'anon', true);
$$;
-- Con email, el usuario existe en auth.users y la sesión en auth.sessions (de
-- nivel p_aal): login_record_success exige una sesión viva (G-03). Sin email,
-- solo el JWT (sin sesión). Se llama como superusuario (reset role antes).
create function pg_temp.as_user(p_email text, p_aal text default 'aal1') returns void language plpgsql as $$
declare
  v_user    uuid := (select id from auth.users where email = p_email);
  v_session uuid := gen_random_uuid();
begin
  if p_email is null then
    v_user := gen_random_uuid();
  else
    if v_user is null then
      v_user := gen_random_uuid();
      insert into auth.users (id, email, aud, role) values (v_user, p_email, 'authenticated', 'authenticated');
    end if;
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (v_session, v_user, now(), now(), p_aal::auth.aal_level);
  end if;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_user, 'role', 'authenticated', 'email', p_email,
    'session_id', v_session, 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- N fallos de golpe (como superusuario, para preparar el escenario).
create function pg_temp.fail(p_email text, p_ip text, n integer) returns void language sql as $$
  select public.login_record_failure(p_email, p_ip, pg_temp.k()) from generate_series(1, n);
$$;

-- ---------------------------------------------------------------------------
-- Quién puede hacer qué
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'public.login_throttle(text, text, text)', 'execute'),
  'anon puede consultar la espera (aún no hay sesión al entrar)');
select ok(has_function_privilege('anon', 'public.login_record_failure(text, text, text)', 'execute'),
  'anon puede llamar a la función de fallos (pero sin clave no hace nada)');
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
select is(public.login_throttle('ana@demo.test', '203.0.113.1', pg_temp.k()), 0, 'sin fallos: puede intentarlo');
select pg_temp.fail('ana@demo.test', '203.0.113.1', 4);
select is(public.login_throttle('ana@demo.test', '203.0.113.1', pg_temp.k()), 0, '4 fallos: aún puede intentarlo');
select public.login_record_failure('ana@demo.test', '203.0.113.1', pg_temp.k());
select ok(public.login_throttle('ana@demo.test', '203.0.113.1', pg_temp.k()) between 1 and 30, '5 fallos: espera hasta 30 s');
select pg_temp.fail('ana@demo.test', '203.0.113.1', 2);
select ok(public.login_throttle('ana@demo.test', '203.0.113.1', pg_temp.k()) between 61 and 120, '7 fallos: la espera crece (hasta 120 s)');
select pg_temp.fail('ana@demo.test', '203.0.113.1', 20);
select ok(public.login_throttle('ana@demo.test', '203.0.113.1', pg_temp.k()) between 1 and 900, 'la espera nunca pasa de 15 min');
select is(public.login_throttle('ANA@demo.test ', '203.0.113.1', pg_temp.k()) > 0, true, 'el email se normaliza (mayúsculas y espacios)');

-- ---------------------------------------------------------------------------
-- Los umbrales no se mezclan
-- ---------------------------------------------------------------------------
select pg_temp.fail('bea@demo.test', '203.0.113.2', 5);
select is(public.login_throttle('bea@demo.test', '198.51.100.9', pg_temp.k()), 0, 'mismo email desde otra IP: no frena con solo 5 fallos');
select is(public.login_throttle('otra@demo.test', '203.0.113.2', pg_temp.k()), 0, 'otro email desde la misma IP: no frena');
select pg_temp.fail('carla@demo.test', ip, 1) from (select '198.51.100.' || g as ip from generate_series(1, 20) g) ips;
select ok(public.login_throttle('carla@demo.test', '192.0.2.77', pg_temp.k()) > 0, 'ataque distribuido: 20 fallos del mismo email desde IPs distintas frenan');

-- ---------------------------------------------------------------------------
-- Datos guardados solo como hash, y purga
-- ---------------------------------------------------------------------------
reset role;
select is((select count(*)::int from private.login_failures where email_hash like '%@%' or ip_hash like '%.%'), 0,
  'ni emails ni IPs en claro');
insert into private.login_failures (email_hash, ip_hash, failed_at) values ('viejo', 'viejo', now() - interval '2 days');
select public.login_record_failure('dani@demo.test', '203.0.113.3', pg_temp.k());
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
-- G-03: con un segundo factor verificado, la contraseña sola (aal1) no vacía
-- el freno; hace falta haber pasado el código (aal2)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.as_user('eva@demo.test');
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
select gen_random_uuid(), id, 'totp eva', 'totp', 'verified', now(), now() from auth.users where email = 'eva@demo.test';
select pg_temp.fail('eva@demo.test', '203.0.113.4', 3);
select pg_temp.as_user('eva@demo.test', 'aal1');
select throws_ok('select public.login_record_success()', '42501', null,
  'con factor verificado y sesión aal1 (solo contraseña): no borra los fallos');
reset role;
select is((select count(*)::int from private.login_failures where email_hash = encode(extensions.digest('eva@demo.test', 'sha256'), 'hex')), 3,
  'tras el intento con aal1, sus fallos siguen ahí');
select pg_temp.as_user('eva@demo.test', 'aal2');
select lives_ok('select public.login_record_success()', 'con factor verificado y sesión aal2: sí los borra');
reset role;
select is((select count(*)::int from private.login_failures where email_hash = encode(extensions.digest('eva@demo.test', 'sha256'), 'hex')), 0,
  'tras pasar el código, sus fallos se borran');
select pg_temp.fail('fran@demo.test', '203.0.113.5', 2);
select pg_temp.as_user('fran@demo.test');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'fran@demo.test'),
  'role', 'authenticated', 'email', 'fran@demo.test', 'session_id', gen_random_uuid())::text, true);
select set_config('role', 'authenticated', true);
select throws_ok('select public.login_record_success()', '42501', null,
  'con una sesión cerrada (session_id que no existe): error');

-- ---------------------------------------------------------------------------
-- Entradas absurdas
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok(format('select public.login_throttle(%L, %L, pg_temp.k())', repeat('a', 400), '203.0.113.1'), '22023', null,
  'un email de más de 320 caracteres se rechaza');

-- ---------------------------------------------------------------------------
-- Clave de servidor (auditoría backend 2026-10-21, P0-1)
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok($$select public.login_record_failure('victima@demo.test', '10.0.0.1', null)$$, '42501', null,
  'anon sin clave no puede registrar fallos');
select throws_ok($$select public.login_record_failure('victima@demo.test', '10.0.0.1', 'clave-inventada-por-un-atacante-0000000000')$$, '42501', null,
  'anon con una clave inventada no puede registrar fallos');
select throws_ok($$select public.login_throttle('victima@demo.test', '10.0.0.1', null)$$, '42501', null,
  'anon sin clave no puede consultar la espera');
-- El ataque comprobado en la auditoría: 21 fallos con el email de la víctima
-- desde IPs inventadas. Sin clave, ninguno se registra.
create function pg_temp.try_attack() returns integer language plpgsql as $$
declare ok integer := 0;
begin
  for i in 1..21 loop
    begin
      perform public.login_record_failure('victima@demo.test', '10.0.0.' || i, null);
      ok := ok + 1;
    exception when insufficient_privilege then null;
    end;
  end loop;
  return ok;
end $$;
select is(pg_temp.try_attack(), 0, 'el ataque de bloqueo dirigido no registra ningún fallo');
select is(public.login_throttle('victima@demo.test', '203.0.113.7', pg_temp.k()), 0,
  'tras el ataque, la víctima entra sin esperar');
reset role;
select ok(not has_function_privilege('anon', 'public.register_server_key(text, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.register_server_key(text, text)', 'execute'),
  'solo la plataforma registra claves de servidor');
select ok(not has_table_privilege('anon', 'private.server_keys', 'select')
      and not has_table_privilege('authenticated', 'private.server_keys', 'select')
      and not has_table_privilege('service_role', 'private.server_keys', 'select'),
  'nadie lee las claves (ni su hash) desde la API');
-- Sin clave registrada (p. ej. un entorno sin configurar): fallo cerrado.
delete from private.server_keys where name = 'login_throttle';
select pg_temp.as_anon();
select throws_ok(format('select public.login_throttle(%L, %L, %L)', 'ana@demo.test', '203.0.113.1', pg_temp.k()), '42501', null,
  'sin clave registrada, el freno falla cerrado');
reset role;

select * from finish();
rollback;
