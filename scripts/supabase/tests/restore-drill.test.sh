#!/usr/bin/env bash
# Pruebas del simulacro de restauración (scripts/supabase/restore-drill.sh).
#
# Un simulacro que da OK pase lo que pase no demuestra nada, así que cada
# comprobación tiene aquí su caso en negativo: se hace una restauración de
# verdad (volcado del Supabase local con el seed → Postgres desechable), se
# comprueba que sale bien, y después se estropea UNA cosa y se exige que el
# simulacro lo detecte. Sale con 1 si algún fallo pasa sin que se detecte.
#
# Necesita Docker, la CLI de Supabase 2.118.0 y psql, con Supabase local levantado
# y el seed aplicado (`pnpm db:start` y `pnpm db:seed`). No corre en el CI (usa
# Docker y el Supabase local): se lanza a mano al tocar el script.
#
#   bash scripts/supabase/tests/restore-drill.test.sh [ruta/al/restore-drill.sh]
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
SCRIPT="${1:-scripts/supabase/restore-drill.sh}"
IMAGE="public.ecr.aws/supabase/postgres:17.6.1.054"
NAME="drill-test-pg"
PORT=54398
export DRILL_SOURCE=local
export DRILL_TARGET_URL="postgresql://supabase_admin:postgres@127.0.0.1:$PORT/postgres"

# shellcheck source=/dev/null
source "$SCRIPT"
WORK="$(mktemp -d)"
chmod 700 "$WORK"
SHIMS="$(mktemp -d)"
trap 'docker rm -f "$NAME" > /dev/null 2>&1; rm -rf "$WORK" "$SHIMS"' EXIT

undetected=0

fresh_target() {
  docker rm -f "$NAME" > /dev/null 2>&1 || true
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" > /dev/null
  # La imagen reinicia Postgres una vez al acabar de inicializarse: «listo» son
  # dos respuestas seguidas, por la URL real y con unos segundos entre una y otra.
  local i
  for i in $(seq 1 60); do
    if psql "$DRILL_TARGET_URL" -X -Atqc 'select 1' > /dev/null 2>&1; then
      sleep 4
      psql "$DRILL_TARGET_URL" -X -Atqc 'select 1' > /dev/null 2>&1 && return 0
    fi
    sleep 2
  done
  echo "el Postgres desechable no arranca" >&2
  return 1
}

# Restaura de verdad lo que hay en $WORK en un destino nuevo.
restore_fresh() {
  fresh_target || return 1
  prepare_target || return 1
  restore || return 1
}

# Lo que dice `verify` ahora: imprime FALLA o BIEN según deje `fail` a 1 o a 0.
run_verify() {
  ( fail=0; verify > "$WORK/verify.log" 2>&1; if [ "$fail" -ne 0 ]; then echo FALLA; else echo BIEN; fi )
}

expect_detected() { # expect_detected <caso> <resultado de run_verify>
  if [ "$2" = "FALLA" ]; then
    echo "  ✓ detectado: $1"
    grep -m3 '^✗' "$WORK/verify.log" | sed 's/^/        motivo: /'
  else
    echo "  ✗ NO detectado: $1"
    undetected=$((undetected + 1))
  fi
}

echo "Preparando el volcado real del Supabase local…"
( cd "$DB_DIR" && supabase db dump --local --role-only -f "$WORK/roles.sql" > /dev/null \
  && supabase db dump --local -s "$SCHEMAS" -f "$WORK/schema.sql" > /dev/null \
  && supabase db dump --local --data-only --use-copy -s "$SCHEMAS" -f "$WORK/data.sql" > /dev/null ) \
  || { echo "no se pudo volcar el Supabase local (¿levantado y con el seed?)"; exit 2; }

echo "Línea base: una restauración de verdad tiene que salir bien"
restore_fresh || { echo "no se pudo restaurar"; exit 2; }
base="$(run_verify)"
if [ "$base" = "BIEN" ]; then
  echo "  ✓ la línea base pasa"
else
  echo "  ✗ la línea base FALLA (se para: los negativos no valen)"
  cat "$WORK/verify.log"
  exit 2
fi

echo "Negativos"

# 1. Un rol propio con más privilegios que en el origen (BYPASSRLS se salta RLS).
#    Que el rol «exista» no basta: hay que compararlo con el origen.
psql "$DRILL_TARGET_URL" -X -q -c 'alter role moodly_worker bypassrls'
expect_detected "moodly_worker con BYPASSRLS en el destino y NOBYPASSRLS en el origen" "$(run_verify)"
psql "$DRILL_TARGET_URL" -X -q -c 'alter role moodly_worker nobypassrls'

# 2. Un destino sin ninguna tabla de public: «0 tablas sin RLS» no es una prueba.
#    Para que ninguna otra comprobación lo delate por su cuenta, el volcado de
#    datos pierde las tablas de public y el de esquema, sus políticas (el
#    recuento de políticas y de filas por tabla cuadrarían con un destino vacío).
#    Lo único que sigue diciendo que public tenía tablas es el CREATE TABLE del esquema.
cp "$WORK/data.sql" "$WORK/data.sql.orig"
cp "$WORK/schema.sql" "$WORK/schema.sql.orig"
psql "$DRILL_TARGET_URL" -X -q -c "do \$\$ declare t record; begin for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relispartition loop execute format('drop table public.%I cascade', t.relname); end loop; end \$\$"
psql "$DRILL_TARGET_URL" -X -Atq -c "select schemaname || '.' || tablename from pg_tables" > "$WORK/existing-tables.txt"
awk 'NR == FNR { existing[$0] = 1; next }
     /^COPY / { t = $2; gsub(/"/, "", t); skip = !(t in existing) }
     !skip { print }
     /^\\\.$/ { skip = 0 }' "$WORK/existing-tables.txt" "$WORK/data.sql.orig" > "$WORK/data.sql"
grep -v '^CREATE POLICY .* ON "public"\.' "$WORK/schema.sql.orig" > "$WORK/schema.sql"
expect_detected "ninguna tabla en public mientras el esquema del origen crea tablas en public" "$(run_verify)"
cp "$WORK/data.sql.orig" "$WORK/data.sql"
cp "$WORK/schema.sql.orig" "$WORK/schema.sql"
restore_fresh || exit 2

# 3. Errores de psql que no son «ERROR»: la conexión se cae a mitad de la restauración.
cp "$WORK/schema.out" "$WORK/schema.out.orig"
echo 'psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  the database system is shutting down' >> "$WORK/schema.out"
expect_detected "«psql: error:» y FATAL en la salida de la restauración del esquema" "$(run_verify)"
cp "$WORK/schema.out.orig" "$WORK/schema.out"
cp "$WORK/data.out" "$WORK/data.out.orig"
echo 'FATAL:  terminating connection due to administrator command' >> "$WORK/data.out"
expect_detected "FATAL en la salida de la restauración de datos" "$(run_verify)"
cp "$WORK/data.out.orig" "$WORK/data.out"

# 4. Un volcado que falla a medias: la CLI devuelve error en el primer volcado
#    (roles), deja un fichero válido y los demás salen bien. `set -e` no actúa
#    dentro de una función llamada con `||`, así que el error se perdía.
cat > "$SHIMS/supabase" << EOF
#!/usr/bin/env bash
$(command -v supabase) "\$@"
rc=\$?
if [[ "\$*" == *--role-only* ]]; then exit 1; fi
exit \$rc
EOF
chmod +x "$SHIMS/supabase"
mkdir -p "$WORK/shim-dump"
saved_work="$WORK"
WORK="$WORK/shim-dump"
rc=0
( PATH="$SHIMS:$PATH"; dump ) > /dev/null 2>&1 || rc=$?
WORK="$saved_work"
if [ "$rc" -ne 0 ]; then
  echo "  ✓ detectado: el primer volcado (roles) devuelve error y los otros dos salen bien (rc=$rc)"
else
  echo "  ✗ NO detectado: el primer volcado (roles) devuelve error y los otros dos salen bien"
  undetected=$((undetected + 1))
fi

echo
if [ "$undetected" -ne 0 ]; then
  echo "RESULTADO: $undetected fallo(s) pasan sin que el simulacro los detecte"
  exit 1
fi
echo "RESULTADO: todos los fallos se detectan"
