-- Freno a la fuerza bruta en el login de la app (hallazgo 1.1 de
-- docs/audits/2026-10-20-revision-seguridad-plataforma.md).
--
-- Por qué: el login se hace desde el servidor de la app, así que Supabase Auth
-- ve todos los intentos desde la IP del servidor y su límite por IP no frena a
-- un atacante concreto. Esto es un freno propio para el camino de la app; el de
-- las llamadas directas a la API de Auth es el CAPTCHA de Supabase (al activarlo)
-- y, más adelante, WorkOS (ADR 0022).
--
-- Reglas (ventana de 15 min; cuentan solo los fallos):
--   - email + IP: a partir de 5 fallos;
--   - email (desde cualquier IP, ataque distribuido): a partir de 20;
--   - IP (muchos emails desde la misma IP): a partir de 100 (oficinas con NAT).
-- Superado un umbral, hay que esperar 30 s × 2^(fallos de más), hasta 15 min.
-- No hay bloqueo permanente. Con el email solo se puede retrasar a una víctima
-- un máximo de 15 min, y para eso hacen falta 20 fallos.
--
-- Emails e IPs se guardan solo como hash SHA-256; los registros de más de un
-- día se purgan solos.
--
-- Clave de servidor (auditoría backend 2026-10-21, P0-1): login_throttle y
-- login_record_failure se llaman antes de iniciar sesión, así que solo pueden
-- ir como anon, y la API REST de Supabase es pública. Sin más, cualquiera con
-- la clave publicable podía registrar fallos con el email de otra persona y
-- bloquearle el login, o llenar la tabla sin límite (comprobado en local).
-- Por eso las dos funciones exigen una clave que solo conoce el servidor de la
-- app (variable LOGIN_THROTTLE_KEY, nunca NEXT_PUBLIC_). En la base de datos
-- solo se guarda su hash SHA-256, en private.server_keys; la registra la
-- plataforma con public.register_server_key (solo service_role). La clave no
-- da acceso a ningún dato: solo permite usar el freno.
-- Vuelta atrás: supabase/rollbacks/20261021090000_login_throttle.down.sql

create table private.login_failures (
  id          bigint generated always as identity primary key,
  email_hash  text        not null,
  ip_hash     text        not null,
  failed_at   timestamptz not null default now()
);
create index login_failures_email_idx on private.login_failures (email_hash, failed_at);
create index login_failures_ip_idx    on private.login_failures (ip_hash, failed_at);

-- Nadie lee ni escribe la tabla directamente: solo las funciones de abajo.
alter table private.login_failures enable row level security;
alter table private.login_failures force row level security;
revoke all on private.login_failures from public, anon, authenticated;

-- Claves de servidor (solo el hash). Nadie la lee desde la API.
create table private.server_keys (
  name       text primary key check (name ~ '^[a-z_]{1,64}$'),
  key_hash   text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now()
);
alter table private.server_keys enable row level security;
alter table private.server_keys force row level security;
revoke all on private.server_keys from public, anon, authenticated, service_role;

-- ¿p_key es la clave de servidor registrada con este nombre? Sin clave
-- registrada, siempre false (fallo cerrado).
create function private.server_key_ok(p_name text, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_key is not null
    and length(p_key) between 32 and 256
    and exists (
      select 1 from private.server_keys k
      where k.name = p_name
        and k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
    );
$$;
revoke all on function private.server_key_ok(text, text) from public;

-- Registrar o rotar una clave: solo la plataforma (service_role), con el hash.
create function public.register_server_key(p_name text, p_key_hash text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.server_keys (name, key_hash) values (p_name, lower(p_key_hash))
  on conflict (name) do update set key_hash = excluded.key_hash, rotated_at = now();
$$;
revoke all on function public.register_server_key(text, text) from public, anon, authenticated;
grant execute on function public.register_server_key(text, text) to service_role;

-- Normaliza y hashea; rechaza entradas absurdas (no son un email o una IP).
create function private.login_key(p_value text, p_max integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or length(btrim(p_value)) = 0 or length(p_value) > p_max then
    raise exception 'valor no válido' using errcode = '22023';
  end if;
  return encode(extensions.digest(lower(btrim(p_value)), 'sha256'), 'hex');
end;
$$;
revoke all on function private.login_key(text, integer) from public;

-- Segundos que hay que esperar antes de intentar entrar con este email desde
-- esta IP (0 = puede intentarlo).
create function public.login_throttle(p_email text, p_ip text, p_key text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := private.login_key(p_email, 320);
  v_ip    text := private.login_key(p_ip, 64);
  v_since timestamptz := now() - interval '15 minutes';
  v_pair  integer;
  v_mail  integer;
  v_addr  integer;
  v_last  timestamptz;
  v_excess integer;
  v_wait  interval;
begin
  if not private.server_key_ok('login_throttle', p_key) then
    raise exception 'clave de servidor no válida' using errcode = '42501';
  end if;
  select count(*) filter (where email_hash = v_email and ip_hash = v_ip),
         count(*) filter (where email_hash = v_email),
         count(*) filter (where ip_hash = v_ip),
         max(failed_at) filter (where email_hash = v_email or ip_hash = v_ip)
    into v_pair, v_mail, v_addr, v_last
    from private.login_failures
   where failed_at > v_since
     and (email_hash = v_email or ip_hash = v_ip);

  v_excess := greatest(v_pair - 5, v_mail - 20, v_addr - 100);
  if v_excess < 0 then
    return 0;
  end if;
  -- 30 s, 60 s, 120 s… con tope de 15 min (exponente acotado para no desbordar).
  v_wait := least(interval '15 minutes', interval '30 seconds' * power(2, least(v_excess, 10)));
  return greatest(0, ceil(extract(epoch from (v_last + v_wait - now()))))::integer;
end;
$$;

-- Registra un intento fallido y purga lo viejo.
create function public.login_record_failure(p_email text, p_ip text, p_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.server_key_ok('login_throttle', p_key) then
    raise exception 'clave de servidor no válida' using errcode = '42501';
  end if;
  insert into private.login_failures (email_hash, ip_hash)
  values (private.login_key(p_email, 320), private.login_key(p_ip, 64));
  delete from private.login_failures where failed_at < now() - interval '1 day';
end;
$$;

-- Tras un login correcto, borra los fallos del email de QUIEN ACABA DE ENTRAR.
-- No recibe el email por parámetro: si lo recibiera, un atacante podría borrar
-- los fallos de su víctima y seguir probando contraseñas.
create function public.login_record_success()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := (select auth.jwt()) ->> 'email';
begin
  if v_email is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  delete from private.login_failures where email_hash = private.login_key(v_email, 320);
end;
$$;

-- Supabase da EXECUTE por defecto a anon y authenticated sobre las funciones
-- nuevas de public: se quita a todos y se concede solo lo necesario.
revoke all on function public.login_throttle(text, text, text)        from public, anon, authenticated;
revoke all on function public.login_record_failure(text, text, text)  from public, anon, authenticated;
revoke all on function public.login_record_success()            from public, anon, authenticated;
-- Antes de entrar no hay sesión: comprobar y registrar el fallo los usa anon.
grant execute on function public.login_throttle(text, text, text)       to anon, authenticated;
grant execute on function public.login_record_failure(text, text, text) to anon, authenticated;
-- Borrar los fallos solo con sesión (y solo los propios).
grant execute on function public.login_record_success()           to authenticated;
