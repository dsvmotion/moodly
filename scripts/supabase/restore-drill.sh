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

dump() {
  ( cd "$DB_DIR"
    supabase db dump "$SOURCE_FLAG" --role-only -f "$WORK/roles.sql" > /dev/null
    supabase db dump "$SOURCE_FLAG" -s "$SCHEMAS" -f "$WORK/schema.sql" > /dev/null
    supabase db dump "$SOURCE_FLAG" --data-only --use-copy -s "$SCHEMAS" -f "$WORK/data.sql" > /dev/null )
}

# La imagen trae sus propios `auth` y `storage` (los de GoTrue y Storage de su
# versión): se tiran para que entren los del origen, tal como los recrea
# Supabase al restaurar un proyecto. Y las extensiones que crean nuestras
# migraciones (el volcado no las incluye).
prepare_target() {
  export PGOPTIONS='-c client_min_messages=warning'
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 -c 'drop schema if exists auth cascade' -c 'drop schema if exists storage cascade' -c 'create schema if not exists extensions'
  local ext
  for ext in $(grep -rhoiE 'create extension( if not exists)? +"?[a-z_0-9-]+"?' "$MIGRATIONS_DIR" | awk '{print $NF}' | tr -d '"' | sort -u); do
    psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 -c "create extension if not exists \"$ext\" with schema extensions"
  done
}

restore() {
  # Los errores se miran aparte: la restauración sigue hasta el final y se cuentan.
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -f "$WORK/roles.sql" > "$WORK/roles.out" 2>&1 || true
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -f "$WORK/schema.sql" > "$WORK/schema.out" 2>&1 || true
  # Datos: solo el código SQLSTATE de cada error, nunca el mensaje.
  psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -v VERBOSITY=sqlstate -f "$WORK/data.sql" > "$WORK/data.out" 2>&1 || true
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
  errors=$(grep -h 'ERROR' "$WORK/roles.out" "$WORK/schema.out" | grep -v 'supabase_realtime_admin' || true)
  if [ -n "$errors" ]; then
    problem "errores al restaurar roles o esquema ($(printf '%s\n' "$errors" | wc -l)):"
    printf '%s\n' "$errors" | sed 's/^/    /' | head -20
  else
    ok "roles y esquema restaurados sin errores"
  fi
  errors=$(grep -h 'ERROR' "$WORK/data.out" | sed 's/.*ERROR: *//' | sort | uniq -c | sort -rn || true)
  if [ -n "$errors" ]; then
    problem "errores al restaurar datos, por SQLSTATE:"
    printf '%s\n' "$errors" | sed 's/^/    /' | head -20
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
  local no_rls no_force policies expected_policies
  no_rls=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity")
  no_force=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relforcerowsecurity")
  if [ "$no_rls" = "0" ] && [ "$no_force" = "0" ]; then ok "RLS activado y forzado en todas las tablas de public"; else problem "tablas de public sin RLS: $no_rls; sin RLS forzado: $no_force"; fi

  policies=$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_policies where schemaname in ('public','private','dbos','storage','auth')")
  expected_policies=$(grep -c '^CREATE POLICY' "$WORK/schema.sql" || true)
  if [ "$policies" = "$expected_policies" ]; then ok "políticas: $policies (las del volcado)"; else problem "políticas restauradas $policies, el volcado trae $expected_policies"; fi

  local role missing=""
  for role in anon authenticated service_role authenticator dbos_worker moodly_worker; do
    [ "$(psql "$TARGET_URL" -X -At -c "select count(*) from pg_roles where rolname = '$role'")" = "1" ] || missing="$missing $role"
  done
  if [ -z "$missing" ]; then ok "roles presentes (anon, authenticated, service_role, authenticator, dbos_worker, moodly_worker)"; else problem "faltan roles:$missing"; fi

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
  timed volcado dump
  echo "Volcado: roles $(stat -c %s "$WORK/roles.sql") B, esquema $(stat -c %s "$WORK/schema.sql") B, datos $(stat -c %s "$WORK/data.sql") B (no se imprime ni se sube su contenido)"
  timed preparar prepare_target
  timed restaurar restore
  timed comprobar verify
  TOTAL=$(( $(now) - START ))
  
  echo
  echo "Tiempos: volcado ${PHASE[volcado]} s · preparar el destino ${PHASE[preparar]} s · restaurar ${PHASE[restaurar]} s · comprobar ${PHASE[comprobar]} s · total ${TOTAL} s"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Simulacro de restauración ($SOURCE)"
      echo "| Fase | Segundos |"
      echo "|---|---|"
      echo "| Volcado | ${PHASE[volcado]} |"
      echo "| Preparar el destino | ${PHASE[preparar]} |"
      echo "| Restaurar | ${PHASE[restaurar]} |"
      echo "| Comprobar | ${PHASE[comprobar]} |"
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
