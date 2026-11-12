#!/usr/bin/env bash
# Comprueba si un PR toca zonas sensibles o debilita tests (AGENTS.md →
# "Mergeo autónomo"). Lo usan scripts/safe-merge.sh y el job de CI
# "sensitive-paths", con los mismos patrones (sensitive-paths.txt).
#
# Uso: check-sensitive.sh <archivo-con-rutas> [<archivo-con-diff> [<línea-base-antes> <línea-base-después>]]
#   <archivo-con-rutas>: una ruta por línea (p. ej. `gh pr diff <n> --name-only`).
#   <archivo-con-diff>:  diff unificado del PR (opcional), para detectar tests
#                        debilitados: .skip/.only/.todo/.fixme añadidos o
#                        archivos de test borrados.
#   <línea-base-antes> y <línea-base-después>: packages/evals/baseline.json en
#                        el merge-base y en el head del PR (vacío = no existe;
#                        las da merge-guard/baseline-versions.sh). Se leen como
#                        JSON (jq) para encontrar fallos conocidos nuevos. Si el
#                        PR toca ese archivo y no llegan, cuenta como sensible.
# Salida: 0 si no hay nada sensible; 1 si lo hay (y lo lista); 2 si el uso es incorrecto.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# SENSITIVE_PATTERNS permite a los tests usar otra lista (la suspendida).
patterns="${SENSITIVE_PATTERNS:-$here/sensitive-paths.txt}"

if [[ $# -lt 1 || ! -r "$1" ]]; then
  echo "uso: $0 <archivo-con-rutas> [<archivo-con-diff> [<línea-base-antes> <línea-base-después>]]" >&2
  exit 2
fi
# Copia de las entradas: se leen una vez por patrón, y una entrada que no se
# puede releer (`<(…)`, una tubería) dejaría vacías todas las lecturas después
# de la primera y el resultado saldría limpio sin serlo.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cat -- "$1" > "$work/files"
files="$work/files"
diff=""
if [[ -n "${2:-}" ]]; then
  if [[ ! -r "$2" ]]; then
    echo "no se puede leer el diff: $2" >&2
    exit 2
  fi
  cat -- "$2" > "$work/diff"
  diff="$work/diff"
fi
found=0

while IFS=$'\t' read -r regex why || [[ -n "$regex" ]]; do
  [[ -z "$regex" || "$regex" == \#* ]] && continue
  while IFS= read -r path || [[ -n "$path" ]]; do
    [[ -z "$path" ]] && continue
    if printf '%s\n' "$path" | grep -Eq -- "$regex"; then
      echo "SENSIBLE: $path → $why"
      found=1
    fi
  done < "$files"
done < "$patterns"

if [[ -n "$diff" ]]; then
  if [[ ! -r "$diff" ]]; then
    echo "no se puede leer el diff: $diff" >&2
    exit 2
  fi
  # Tests saltados o aislados añadidos (Vitest/Playwright) o pgTAP sin plan.
  weakened="$(grep -En '^\+.*(^|[^A-Za-z0-9_])(it|test|describe)\.(skip|only|todo|fixme)\(|^\+.*no_plan\(\)' "$diff" || true)"
  if [[ -n "$weakened" ]]; then
    while IFS= read -r line; do echo "TEST DEBILITADO: $line"; done <<< "$weakened"
    found=1
  fi
  # Archivos de test borrados.
  current=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "diff --git a/"* ]]; then
      current="${line#diff --git a/}"
      current="${current%% b/*}"
    elif [[ "$line" == "deleted file mode"* ]] && printf '%s\n' "$current" | grep -Eq '\.(test|e2e)\.[jt]sx?$|\.test\.sql$'; then
      echo "TEST BORRADO: $current"
      found=1
    fi
  done < "$diff"
fi

# Casos que pasan a ser fallos conocidos en la línea base de las evals (K-01):
# un fallo conocido sigue puntuando, pero cambia cómo se avisa del rojo, así que
# añadir uno lo decide una persona. Se comparan las claves de knownFailures de
# las dos versiones como JSON, no las líneas del diff: el formato (una línea,
# claves reordenadas, reformatear) no cambia el resultado.
baseline="packages/evals/baseline.json"
if grep -qxF -- "$baseline" "$files"; then
  if [[ -z "${3:-}" || -z "${4:-}" ]]; then
    echo "LÍNEA BASE SIN COMPROBAR ($baseline): el PR la toca y no llegan sus dos versiones (merge-guard/baseline-versions.sh)"
    found=1
  else
    if ! command -v jq > /dev/null; then
      echo "falta jq para leer la línea base de las evals" >&2
      exit 2
    fi
    # Copias, como las otras entradas: `-s` sobre una tubería (`<(…)`) diría vacía.
    for version in "$3" "$4"; do
      if [[ ! -r "$version" ]]; then
        echo "no se puede leer la línea base: $version" >&2
        exit 2
      fi
    done
    cat -- "$3" > "$work/baseline-before"
    cat -- "$4" > "$work/baseline-after"
    # Las claves de knownFailures, una por línea y en JSON (una clave con saltos
    # de línea no se parte). Un archivo vacío es que no existe: sin claves.
    known_keys() {
      [[ -s "$1" ]] || return 0
      jq -r 'if type == "object" and ((.knownFailures // {}) | type) == "object"
             then (.knownFailures // {}) | keys[] | @json
             else error("no es un objeto con knownFailures") end' "$1"
    }
    readable=1
    known_keys "$work/baseline-before" > "$work/known-before" 2> "$work/known-error" || { echo "LÍNEA BASE ILEGIBLE ($baseline, antes): $(head -c 300 "$work/known-error")"; found=1; readable=0; }
    known_keys "$work/baseline-after" > "$work/known-after" 2> "$work/known-error" || { echo "LÍNEA BASE ILEGIBLE ($baseline, después): $(head -c 300 "$work/known-error")"; found=1; readable=0; }
    if [[ $readable -eq 1 ]]; then
      while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        echo "FALLO CONOCIDO AÑADIDO ($baseline): $key"
        found=1
      done < <(comm -13 <(sort -u "$work/known-before") <(sort -u "$work/known-after"))
    fi
  fi
fi

exit "$found"
