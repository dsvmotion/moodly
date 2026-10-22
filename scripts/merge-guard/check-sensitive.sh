#!/usr/bin/env bash
# Comprueba si un PR toca zonas sensibles o debilita tests (AGENTS.md →
# "Mergeo autónomo"). Lo usan scripts/safe-merge.sh y el job de CI
# "sensitive-paths", con los mismos patrones (sensitive-paths.txt).
#
# Uso: check-sensitive.sh <archivo-con-rutas> [<archivo-con-diff>]
#   <archivo-con-rutas>: una ruta por línea (p. ej. `gh pr diff <n> --name-only`).
#   <archivo-con-diff>:  diff unificado del PR (opcional), para detectar tests
#                        debilitados: .skip/.only/.todo/.fixme añadidos o
#                        archivos de test borrados.
# Salida: 0 si no hay nada sensible; 1 si lo hay (y lo lista); 2 si el uso es incorrecto.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# SENSITIVE_PATTERNS permite a los tests usar otra lista (la suspendida).
patterns="${SENSITIVE_PATTERNS:-$here/sensitive-paths.txt}"

if [[ $# -lt 1 || ! -r "$1" ]]; then
  echo "uso: $0 <archivo-con-rutas> [<archivo-con-diff>]" >&2
  exit 2
fi
files="$1"
diff="${2:-}"
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

exit "$found"
