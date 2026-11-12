#!/usr/bin/env bash
# P-04: ¿qué commit despliega esta corrida de staging? Uso: should-deploy.sh <sha del CI>
# Entorno: GH_REPO=dueño/repo, GH_TOKEN (gh) y opcionalmente MAX_NEWER (100).
#
# El CI de main corre en paralelo, una corrida por commit, y termina cuando termina:
# un commit viejo puede acabar después de uno nuevo y desplegar hacia atrás, y a la
# vez main puede moverse más deprisa que el CI. Regla: la corrida despliega el
# commit más nuevo de main con el CI en verde que sea el suyo o posterior (si
# ninguno posterior lo está, el suyo, que llega con el CI en verde). Las corridas
# van en serie (grupo de concurrencia) y cada una resuelve «el más nuevo en verde
# de ahora», que solo crece: staging avanza siempre, aunque GitHub cancele una
# corrida pendiente. Migraciones y código usan ese commit, no el de la corrida.
#
# Imprime una línea: `deploy <sha>` o `skip <motivo>`. Si no puede saberlo con
# certeza (la API falla, el commit no está en el historial de main, o hay más de
# MAX_NEWER commits nuevos y no se pueden mirar todos), `skip`: lo seguro. Un
# `workflow_dispatch` desde main despliega la cabeza.
set -u

sha="${1:?falta el sha}"
max="${MAX_NEWER:-100}"
repo="${GH_REPO:?falta GH_REPO}"

# status: identical (es la cabeza), ahead (main va por delante: sha es su ancestro),
# behind o diverged (sha no está en el historial de main).
if ! info=$(gh api "repos/$repo/compare/$sha...main?per_page=1" --jq '[.status, .total_commits] | @tsv'); then
  echo "skip no se pudo comparar $sha con main"
  exit 0
fi
status="${info%%$'\t'*}"
total="${info#*$'\t'}"

case "$status" in
  identical) echo "deploy $sha"; exit 0 ;;
  ahead) ;;
  *) echo "skip $sha no está en el historial de main ($status)"; exit 0 ;;
esac

# Hay que mirar todos los commits nuevos: el más nuevo en verde puede ser cualquiera
# de ellos, y desplegar el mío sin haberlos mirado todos podría ir hacia atrás.
if ! [[ "$total" =~ ^[0-9]+$ ]] || [ "$total" -gt "$max" ]; then
  echo "skip hay $total commits nuevos en main (más de $max): se despliega a mano"
  exit 0
fi
if ! listing=$(gh api --paginate "repos/$repo/compare/$sha...main?per_page=100" --jq '.commits[].sha'); then
  echo "skip no se pudo leer la lista de commits nuevos"
  exit 0
fi
# La API los da del más viejo al más nuevo; se miran del más nuevo al más viejo.
newest_first=$(printf '%s\n' "$listing" | sed '/^$/d' | tac)

for commit in $newest_first; do
  if ! green=$(gh api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$commit&event=push&status=success&per_page=1" --jq .total_count); then
    echo "skip no se pudo leer el CI de $commit"
    exit 0
  fi
  if [ "${green:-0}" -gt 0 ]; then
    echo "deploy $commit"
    exit 0
  fi
done
echo "deploy $sha"
