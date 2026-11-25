#!/usr/bin/env bash
# PL-prod: simulacro de restauración de la base de datos de staging.
#
# Demuestra de verdad que se puede reconstruir la base de datos desde un volcado
# propio: vuelca (esquema, datos y roles) con `supabase db dump`, lo restaura en
# un Postgres desechable y comprueba el resultado. NO toca el origen (solo lo lee)
# y no hace DDL en ningún proyecto alojado.
#
# Lo que imprime: solo recuentos, códigos SQLSTATE, nombres de tablas y tiempos.
# Nunca datos, y los errores de la restauración de datos salen solo como SQLSTATE
# (un mensaje de Postgres puede llevar el valor de una fila). El volcado puede
# contener datos personales: vive en un directorio 0700 que se borra al salir, y
# no se sube a ningún sitio.
#
# Entradas (variables de entorno):
#   DRILL_TARGET_URL  obligatoria. URL de un superusuario del Postgres desechable
#                     (la imagen de Supabase, la misma versión mayor que el proyecto).
#   DRILL_SOURCE      `linked` (por defecto: el proyecto enlazado con `supabase link`,
#                     con SUPABASE_DB_PASSWORD) o `local` (el Supabase local, para
#                     ensayar el simulacro sin tocar staging).
#   DRILL_DB_DIR      directorio del CLI de Supabase (por defecto packages/db).
#   DRILL_SCHEMAS     esquemas a volcar (por defecto, los de la plataforma).
#
# Sale con 0 solo si todo se comprueba; con 1 si algo no cuadra.
set -euo pipefail

SOURCE="${DRILL_SOURCE:-linked}"
TARGET_URL="${DRILL_TARGET_URL:?falta DRILL_TARGET_URL (superusuario del Postgres desechable)}"
DB_DIR="${DRILL_DB_DIR:-packages/db}"
SCHEMAS="${DRILL_SCHEMAS:-auth,storage,public,private,dbos,partitions,supabase_migrations}"
MIGRATIONS_DIR="$DB_DIR/supabase/migrations"

case "$SOURCE" in
  linked) SOURCE_FLAG="--linked" ;;
  local) SOURCE_FLAG="--local" ;;
  *) echo "::error::DRILL_SOURCE debe ser linked o local" >&2; exit 2 ;;
esac

# Directorio de trabajo 0700 (lo crea main; las pruebas de scripts/supabase/tests
# lo fijan ellas al cargar las funciones con `source`).
WORK=""
cleanup() { if [ -n "$WORK" ]; then rm -rf "$WORK"; fi; }

fail=0
problem() { echo "✗ $1"; fail=1; }
ok() { echo "✓ $1"; }
now() { date +%s; }
declare -A PHASE
timed() { # timed <nombre> <comando…>
  local name="$1" start rc=0
  shift
  start=$(now)
  "$@" || rc=$?
  PHASE[$name]=$(( $(now) - start ))
  return $rc
}

# Cada orden lleva su `|| return/exit`: `set -e` no actúa dentro de una función
# que se llama con `||` (como hace `timed`), y sin esto un volcado que falla a
# medias quedaba tapado por el último, que sí sale bien.
dump() {
  ( cd "$DB_DIR" || exit 1
    supabase db dump "$SOURCE_FLAG" --role-only -f "$WORK/roles.sql" > /dev/null || exit 1
    supabase db dump "$SOURCE_FLAG" -s "$SCHEMAS" -f "$WORK/schema.sql" > /dev/null || exit 1
    supabase db dump "$SOURCE_FLAG" --data-only --use-copy -s "$SCHEMAS" -f "$WORK/data.sql" > /dev/null || exit 1 )
}

# La imagen trae sus propios `auth` y `storage` (los de GoTrue y Storage de su
# versión): se tiran para que entren los del origen, tal como los recrea
# Supabase al restaurar un proyecto. Y las extensiones que crean nuestras
# migraciones (el volcado no las incluye).
prepare_target() {
  export PGOPTIONS='-c client_min_messages=warning'
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 -c 'drop schema if exists auth cascade' -c 'drop schema if exists storage cascade' -c 'create schema if not exists extensions' || return 1
  local ext
  for ext in $(grep -rhoiE 'create extension( if not exists)? +"?[a-z_0-9-]+"?' "$MIGRATIONS_DIR" | awk '{print $NF}' | tr -d '"' | sort -u); do
    psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 -c "create extension if not exists \"$ext\" with schema extensions" || return 1
  done
}

restore() {
  # Los errores de SQL se miran aparte (verify): la restauración sigue hasta el
  # final y se cuentan. Con ON_ERROR_STOP=0 psql solo sale con código distinto de
  # 0 si no puede ni conectar o se cae: eso sí corta la fase.
  local rc=0
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -f "$WORK/roles.sql" > "$WORK/roles.out" 2>&1 || rc=$?
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -f "$WORK/schema.sql" > "$WORK/schema.out" 2>&1 || rc=$?
  # Datos: solo el código SQLSTATE de cada error, nunca el mensaje.
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -v VERBOSITY=sqlstate -f "$WORK/data.sql" > "$WORK/data.out" 2>&1 || rc=$?
  return $rc
}

# Filas de cada tabla que lleva el volcado de datos: «esquema.tabla filas».
dump_counts() {
  awk '/^COPY /{ t=$2; gsub(/"/, "", t); n=0; inc=1; next }
       /^\\\.$/ { if (inc) print t, n; inc=0; next }
       inc { n++ }' "$WORK/data.sql"
}

verify() {
  local errors
  # Roles y esquema: sus mensajes no llevan datos de clientes. Solo se tolera lo
  # propio de la plataforma que no existe en un Postgres desechable.
  # Además de «ERROR», un FATAL, un «psql: error:» (la conexión que se cae a
  # mitad de la restauración) o un error del propio psql al leer el fichero
  # («psql:<fichero>:<línea>: error: invalid command …», en minúsculas) también
  # son errores.
  errors=$(grep -hE 'ERROR|FATAL|psql: error|: error:' "$WORK/roles.out" "$WORK/schema.out" | grep -v 'supabase_realtime_admin' || true)
  if [ -n "$errors" ]; then
    problem "errores al restaurar roles o esquema ($(printf '%s\n' "$errors" | wc -l)):"
    printf '%s\n' "$errors" | sed 's/^/    /' | head -20
  else
    ok "roles y esquema restaurados sin errores"
  fi
  # Datos: solo el SQLSTATE de cada error de SQL y, de la conexión, cuántos (su
  # texto no se enseña: el de un error de datos puede llevar el valor de una fila).
  # Con `psql -f` cada error sale como «psql:<fichero>:<línea>: ERROR:  <código>»,
  # con el prefijo delante: se busca `ERROR:` en cualquier sitio de la línea.
  local codes sql_errors unknown conn_errors
  sql_errors=$(grep -c 'ERROR:' "$WORK/data.out" || true)
  codes=$(sed -n 's/.*ERROR:  *\([0-9A-Z]\{5\}\)$/\1/p' "$WORK/data.out" | sort | uniq -c | sort -rn)
  unknown=$(( sql_errors - $(grep -cE 'ERROR:  *[0-9A-Z]{5}$' "$WORK/data.out" || true) ))
  # Los de psql al leer el fichero (« : error: ») pueden citar una línea de datos:
  # solo se cuentan.
  conn_errors=$(grep -cE 'FATAL|psql: error|: error:' "$WORK/data.out" || true)
  if [ "$sql_errors" -gt 0 ] || [ "$conn_errors" -gt 0 ]; then
    problem "errores al restaurar datos:"
    if [ -n "$codes" ]; then echo "    por SQLSTATE:"; printf '%s\n' "$codes" | sed 's/^/      /' | head -20; fi
    if [ "$unknown" -gt 0 ]; then echo "    sin código reconocible (no se enseña su texto): $unknown"; fi
    if [ "$conn_errors" -gt 0 ]; then echo "    de conexión o de psql: $conn_errors"; fi
  else
    ok "datos restaurados sin errores"
  fi

  # Recuento por tabla: el volcado frente a lo restaurado.
  local total=0 bad=0 tables=0 table rows restored
  echo "Filas por tabla (volcado → restaurado):"
  while read -r table rows; do
    tables=$((tables + 1))
    restored=$(psql "$TARGET_URL" -X -At -c "select count(*) from $table" 2>/dev/null || echo "sin tabla")
    total=$((total + rows))
    if [ "$restored" = "$rows" ]; then
      printf '    %-52s %8s → %s\n' "$table" "$rows" "$restored"
    else
      printf '    %-52s %8s → %s   ✗\n' "$table" "$rows" "$restored"
      bad=$((bad + 1))
    fi
  done < <(dump_counts)
  if [ "$tables" -eq 0 ]; then problem "el volcado de datos no trae ninguna tabla"; fi
  if [ "$bad" -gt 0 ]; then problem "$bad de $tables tablas no cuadran"; else ok "$tables tablas con datos cuadran ($total filas)"; fi

  # Invariantes del esquema.
  local no_rls no_force policies expected_policies public_tables expected_public
  expected_public=$(grep -cE '^CREATE TABLE (IF NOT EXISTS )?"public"\.' "$WORK/schema.sql" || true)
  public_tables=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')")
  no_rls=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity")
  no_force=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relforcerowsecurity")
  # «0 tablas sin RLS» no vale si public está vacío: el destino tiene que traer
  # al menos las tablas de public que crea el esquema del origen.
  if [ "$expected_public" -lt 1 ]; then
    problem "el esquema del origen no crea ninguna tabla en public (¿volcado vacío?)"
  elif [ "$public_tables" -lt "$expected_public" ]; then
    problem "public tiene $public_tables tablas en el destino y el esquema del origen crea $expected_public"
  elif [ "$no_rls" = "0" ] && [ "$no_force" = "0" ]; then
    ok "RLS activado y forzado en las $public_tables tablas de public (el origen crea $expected_public)"
  else
    problem "tablas de public sin RLS: $no_rls; sin RLS forzado: $no_force"
  fi

  policies=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_policies where schemaname in ('public','private','dbos','storage','auth')")
  expected_policies=$(grep -c '^CREATE POLICY' "$WORK/schema.sql" || true)
  if [ "$policies" = "$expected_policies" ]; then ok "políticas: $policies (las del volcado)"; else problem "políticas restauradas $policies, el volcado trae $expected_policies"; fi

  # Roles propios: los que crea el volcado de roles del ORIGEN (los de la
  # plataforma, anon, authenticated…, ya vienen en la imagen y no prueban nada).
  # Cada uno tiene que existir en el destino con los mismos atributos que en el
  # origen: un rol con BYPASSRLS de más se salta RLS.
  local own_roles must role line attr have mismatches="" checked=0
  own_roles=$(sed -n 's/^CREATE ROLE "\(.*\)";$/\1/p' "$WORK/roles.sql")
  for must in dbos_worker moodly_worker; do
    if ! grep -qx "$must" <<< "$own_roles"; then problem "el volcado de roles del origen no trae $must"; fi
  done
  for role in $own_roles; do
    checked=$((checked + 1))
    line=$(grep -m1 "^ALTER ROLE \"$role\" WITH " "$WORK/roles.sql" || true)
    if [ -z "$line" ]; then
      # Sin sus atributos en el origen no hay nada con qué comparar: falla cerrado.
      mismatches="$mismatches $role(sin ALTER ROLE … WITH en el origen)"
      continue
    fi
    have=$(psql "$TARGET_URL" -X -At -c "select concat_ws(' ', case when rolsuper then 'SUPERUSER' else 'NOSUPERUSER' end, case when rolinherit then 'INHERIT' else 'NOINHERIT' end, case when rolcreaterole then 'CREATEROLE' else 'NOCREATEROLE' end, case when rolcreatedb then 'CREATEDB' else 'NOCREATEDB' end, case when rolcanlogin then 'LOGIN' else 'NOLOGIN' end, case when rolreplication then 'REPLICATION' else 'NOREPLICATION' end, case when rolbypassrls then 'BYPASSRLS' else 'NOBYPASSRLS' end) from pg_roles where rolname = '$role'")
    if [ -z "$have" ]; then
      mismatches="$mismatches $role(no existe)"
      continue
    fi
    for attr in $(grep -oE '\b(NO)?(SUPERUSER|INHERIT|CREATEROLE|CREATEDB|LOGIN|REPLICATION|BYPASSRLS)\b' <<< "$line"); do
      [[ " $have " == *" $attr "* ]] || mismatches="$mismatches $role($attr en el origen)"
    done
  done
  if [ -z "$mismatches" ] && [ "$checked" -gt 0 ]; then
    ok "roles propios del origen presentes y con sus atributos ($checked: $(tr '\n' ' ' <<< "$own_roles" | sed 's/ $//'))"
  elif [ "$checked" -eq 0 ]; then
    problem "el volcado de roles del origen no trae ningún rol propio"
  else
    problem "roles propios que no cuadran con el origen:$mismatches"
  fi

  # Migraciones aplicadas = las del repositorio.
  local repo_versions applied_versions
  repo_versions=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -printf '%f\n' | sed 's/_.*//' | sort)
  applied_versions=$(psql "$TARGET_URL" -X -At -c "select version from supabase_migrations.schema_migrations order by 1" 2>/dev/null | sort || true)
  if [ "$repo_versions" = "$applied_versions" ]; then
    ok "migraciones aplicadas = las del repositorio ($(printf '%s\n' "$repo_versions" | wc -l))"
  else
    problem "las migraciones aplicadas no son las del repositorio"
    echo "    solo en el repositorio: $(comm -23 <(printf '%s\n' "$repo_versions") <(printf '%s\n' "$applied_versions") | tr '\n' ' ')"
    echo "    solo en la base de datos: $(comm -13 <(printf '%s\n' "$repo_versions") <(printf '%s\n' "$applied_versions") | tr '\n' ' ')"
  fi
}

main() {
  WORK="$(mktemp -d)"
  chmod 700 "$WORK"
  trap cleanup EXIT

  START=$(now)
  echo "Simulacro de restauración · origen: $SOURCE · esquemas: $SCHEMAS"
  # Si una fase falla, las siguientes no corren y el simulacro termina en FALLA.
  phase() { timed "$@" || { problem "la fase «$1» ha fallado"; return 1; }; }
  if phase volcado dump; then
    echo "Volcado: roles $(stat -c %s "$WORK/roles.sql") B, esquema $(stat -c %s "$WORK/schema.sql") B, datos $(stat -c %s "$WORK/data.sql") B (no se imprime ni se sube su contenido)"
    phase preparar prepare_target && phase restaurar restore && phase comprobar verify
  fi
  TOTAL=$(( $(now) - START ))
  
  echo
  echo "Tiempos: volcado ${PHASE[volcado]:--} s · preparar el destino ${PHASE[preparar]:--} s · restaurar ${PHASE[restaurar]:--} s · comprobar ${PHASE[comprobar]:--} s · total ${TOTAL} s"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Simulacro de restauración ($SOURCE)"
      echo "| Fase | Segundos |"
      echo "|---|---|"
      echo "| Volcado | ${PHASE[volcado]:--} |"
      echo "| Preparar el destino | ${PHASE[preparar]:--} |"
      echo "| Restaurar | ${PHASE[restaurar]:--} |"
      echo "| Comprobar | ${PHASE[comprobar]:--} |"
      echo "| **Total (RTO del simulacro lógico)** | **${TOTAL}** |"
      echo
      [ "$fail" -eq 0 ] && echo "Resultado: **todo cuadra**." || echo "Resultado: **hay diferencias** (ver el log)."
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  
  if [ "$fail" -ne 0 ]; then
    echo "RESULTADO: FALLA"
    exit 1
  fi
  echo "RESULTADO: OK"
}

# Se ejecuta solo si se lanza el script; con `source` (las pruebas) solo se cargan las funciones.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
