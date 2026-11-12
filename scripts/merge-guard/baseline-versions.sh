#!/usr/bin/env bash
# Las dos versiones de la línea base de las evals (packages/evals/baseline.json)
# que compara check-sensitive.sh: la del merge-base del PR (la misma base que su
# diff) y la de su head. Se leen por la API de GitHub, sin checkout, y se tratan
# como datos. Lo usan el workflow de la guarda y safe-merge.sh.
#
# Uso: baseline-versions.sh <owner/repo> <rama-base> <head-sha> <dir>
#   Escribe <dir>/baseline-before.json y <dir>/baseline-after.json. Si el archivo
#   no existe en ese commit (HTTP 404), lo deja vacío: sin fallos conocidos.
# Salida: 0 si leyó las dos; 1 ante cualquier otro error de la API (la guarda
# falla en cerrado); 2 si el uso es incorrecto.
set -euo pipefail

if [[ $# -ne 4 || ! -d "$4" ]]; then
  echo "uso: $0 <owner/repo> <rama-base> <head-sha> <dir>" >&2
  exit 2
fi
repo="$1"; base="$2"; head="$3"; out="$4"
path="packages/evals/baseline.json"
[[ "$head" =~ ^[0-9a-f]{40}$ ]] || { echo "head no válido: $head" >&2; exit 2; }

merge_base="$(gh api "repos/$repo/compare/$base...$head" --jq .merge_base_commit.sha)"
[[ "$merge_base" =~ ^[0-9a-f]{40}$ ]] || { echo "merge-base no válido: $merge_base" >&2; exit 1; }

fetch() { # commit archivo
  local err="$out/.baseline-error"
  if gh api -H "Accept: application/vnd.github.raw+json" "repos/$repo/contents/$path?ref=$1" > "$2" 2> "$err"; then
    rm -f "$err"; return 0
  fi
  if grep -q "HTTP 404" "$err"; then
    : > "$2"; rm -f "$err"; return 0
  fi
  cat "$err" >&2; rm -f "$err"; return 1
}

fetch "$merge_base" "$out/baseline-before.json"
fetch "$head" "$out/baseline-after.json"
echo "línea base de las evals: merge-base $merge_base, head $head"
