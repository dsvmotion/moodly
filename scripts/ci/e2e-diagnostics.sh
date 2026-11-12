#!/usr/bin/env bash
# Diagnóstico del e2e intermitente del CI (P-04). Solo diagnóstico: no
# reintenta ni salta nada.
#
# El 2026-11-11 (run 43121121515) dos e2e de main fallaron porque el servicio
# de Auth (GoTrue) no contestó a tiempo durante ~70 s: un /token dio 504 tras
# ~10 s y un login fallido no respondió en 5 s. En local no se reproduce
# (2 y 1 worker, también con 2 CPU). Para la próxima vez, el job guarda lo que
# falta: logs de Auth, Kong, PostgREST y Postgres, esperas de locks y
# sentencias lentas, el estado de conexiones y locks al fallar, y la presión de
# CPU, E/S y memoria del runner durante el e2e.
#
# Uso:
#   e2e-diagnostics.sh start <dir>    antes del e2e: activa los logs de Postgres
#                                     y arranca el muestreo en segundo plano
#   e2e-diagnostics.sh collect <dir>  si el job falla: recoge todo en <dir>,
#                                     sin secretos
#   e2e-diagnostics.sh redact         filtro (stdin → stdout); lo usa collect
#
# Nunca escribe variables de entorno. Los logs pasan por `redact`: JWT, claves
# de Supabase (sb_secret_…, sb_publishable_…), cabeceras apikey y
# Authorization, contraseñas en SQL y en JSON.

set -euo pipefail

PROJECT="${SUPABASE_PROJECT_ID:-moodly}"
DB_CONTAINER="supabase_db_${PROJECT}"
SERVICES=(auth kong rest db)

redact() {
  sed -E \
    -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/[jwt]/g' \
    -e 's/sb_(secret|publishable)_[A-Za-z0-9_-]+/sb_\1_[redacted]/g' \
    -e 's/((apikey|authorization)"?[[:space:]]*[:=][[:space:]]*"?)(Bearer[[:space:]]+)?[^",&[:space:]]+/\1[redacted]/Ig' \
    -e "s/(password[[:space:]]*)'[^']*'/\\1'[redacted]'/Ig" \
    -e 's/("password"[[:space:]]*:[[:space:]]*")[^"]*"/\1[redacted]"/Ig'
}

psql_admin() {
  docker exec "$DB_CONTAINER" psql -U supabase_admin -d postgres -At "$@"
}

start() {
  local dir="$1"
  mkdir -p "$dir"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$dir/started-at.txt"

  # Esperas de locks de más de deadlock_timeout (1 s) y sentencias de más de
  # 2 s, al log de Postgres (docker logs). ALTER SYSTEM no va en una
  # transacción: un -c por sentencia.
  psql_admin -c "alter system set log_lock_waits = on" \
    -c "alter system set log_min_duration_statement = 2000" \
    -c "alter system set log_checkpoints = on" \
    -c "select pg_reload_conf()" > /dev/null

  # Presión de CPU, E/S y memoria (PSI) y carga, cada 5 s, mientras dure el job.
  nohup bash -c '
    while :; do
      printf "%s load=%s | cpu %s | io %s | mem %s\n" \
        "$(date -u +%H:%M:%S)" "$(cut -d" " -f1-3 /proc/loadavg)" \
        "$(head -1 /proc/pressure/cpu 2>/dev/null)" \
        "$(head -1 /proc/pressure/io 2>/dev/null)" \
        "$(head -1 /proc/pressure/memory 2>/dev/null)"
      sleep 5
    done' > "$dir/pressure.log" 2>&1 &
  nohup vmstat -t 5 > "$dir/vmstat.log" 2>&1 &
  echo "diagnóstico del e2e: muestreo en $dir"
}

collect() {
  local dir="$1"
  mkdir -p "$dir"
  local since
  since="$(cat "$dir/started-at.txt" 2>/dev/null || echo 30m)"

  for service in "${SERVICES[@]}"; do
    docker logs --timestamps --since "$since" "supabase_${service}_${PROJECT}" 2>&1 | redact > "$dir/${service}.log" || true
  done

  # Quién está conectado, qué espera y quién bloquea a quién, en el momento del fallo.
  psql_admin -F $'\t' -c "
    select pid, usename, application_name, state, wait_event_type, wait_event,
           pg_blocking_pids(pid) as blocked_by,
           xact_start, query_start, left(regexp_replace(query, '\s+', ' ', 'g'), 300) as query
      from pg_stat_activity
     where datname is not null
     order by xact_start nulls last" 2>&1 | redact > "$dir/pg_stat_activity.tsv" || true
  psql_admin -F $'\t' -c "
    select l.pid, l.locktype, l.mode, l.granted, l.relation::regclass, a.application_name, a.state
      from pg_locks l left join pg_stat_activity a using (pid)
     where not l.granted or l.locktype in ('relation', 'transactionid', 'advisory')
     order by l.granted, l.pid" 2>&1 | redact > "$dir/pg_locks.tsv" || true

  {
    echo "== uptime"; uptime
    echo "== memoria"; free -m
    echo "== disco"; df -h /
    echo "== contenedores"; docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}} {{.BlockIO}}'
  } > "$dir/runner.txt" 2>&1 || true

  pkill -f "vmstat -t 5" 2>/dev/null || true
  echo "diagnóstico del e2e recogido en $dir:"
  ls -la "$dir"
}

case "${1:-}" in
  start) start "${2:?falta el directorio}" ;;
  collect) collect "${2:?falta el directorio}" ;;
  redact) redact ;;
  *)
    echo "uso: $0 start|collect <dir> | redact" >&2
    exit 2
    ;;
esac
