#!/usr/bin/env bash
# P-04: ¿este despliegue a staging debe correr? Uso: should-deploy.sh <sha del CI>
# Entorno: GH_REPO=dueño/repo, GH_TOKEN (gh), y opcionalmente MAX_NEWER (40).
#
# El CI de main corre en paralelo, una corrida por commit, y termina cuando termina:
# un commit viejo puede acabar después de uno nuevo y desplegar hacia atrás. Regla:
# se despliega el commit de esta corrida salvo que un commit MÁS NUEVO de main ya
# tenga el CI en verde (entonces se encarga la corrida de ese commit, que además
# incluye este). Así el último commit en verde siempre se despliega, aunque main
# se mueva más deprisa que el CI.
#
# Imprime una línea: `true`, o `false <motivo>`. Si no puede saberlo (la API
# falla, el commit no está en el historial de main), `false`: es lo seguro, y un
# `workflow_dispatch` desde main despliega la cabeza.
set -u

sha="${1:?falta el sha}"
max="${MAX_NEWER:-40}"
repo="${GH_REPO:?falta GH_REPO}"

# status: identical (es la cabeza), ahead (main va por delante: sha es su ancestro),
# behind o diverged (sha no está en el historial de main). Los commits, de más nuevo a más viejo.
if ! comparison=$(gh api "repos/$repo/compare/$sha...main" --jq '[.status, (.commits | map(.sha) | reverse | join(" "))] | @tsv'); then
  echo "false no se pudo comparar $sha con main"
  exit 0
fi
status="${comparison%%$'\t'*}"
newer="${comparison#*$'\t'}"

case "$status" in
  identical) echo true; exit 0 ;;
  ahead) ;;
  *) echo "false $sha no está en el historial de main ($status)"; exit 0 ;;
esac

checked=0
for commit in $newer; do
  checked=$((checked + 1))
  [ "$checked" -gt "$max" ] && break
  if ! green=$(gh api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$commit&event=push&status=success&per_page=1" --jq .total_count); then
    echo "false no se pudo leer el CI de $commit"
    exit 0
  fi
  if [ "${green:-0}" -gt 0 ]; then
    echo "false un commit más nuevo ($commit) ya tiene el CI en verde: lo despliega su corrida"
    exit 0
  fi
done
echo true
