#!/usr/bin/env bash
# Decisión del job de CI "sensitive-paths" (lógica pura, probada en tests/run.sh).
#
# Uso: sensitive-gate.sh <resultado-check-sensitive> <acción-del-evento> <tiene-etiqueta>
#   <resultado-check-sensitive>: código de salida de check-sensitive.sh (0 limpio, 1 sensible, otro = error)
#   <acción-del-evento>: github.event.action (opened, synchronize, reopened, labeled, unlabeled…)
#   <tiene-etiqueta>: "true" si el PR lleva la etiqueta revisado-humano en el payload del evento
#
# Imprime dos líneas KEY=VALUE para $GITHUB_OUTPUT:
#   remove_label=true|false  → quitar revisado-humano del PR
#   verdict=pass|fail
# y termina con 0 si el job debe pasar y 1 si debe fallar.
#
# La etiqueta revisado-humano aprueba un commit concreto. Un commit nuevo
# (synchronize) o una reapertura (reopened, que puede traer commits hechos con
# el PR cerrado) la invalidan: se quita y, en ESE mismo run, cuenta como
# ausente, porque el payload del evento aún la incluye.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "uso: $0 <resultado-check-sensitive> <acción-del-evento> <tiene-etiqueta>" >&2
  exit 2
fi
result="$1"
action="$2"
labeled="$3"

remove_label=false
reviewed=false
if [[ "$labeled" == "true" ]]; then
  case "$action" in
    synchronize | reopened) remove_label=true ;;
    *) reviewed=true ;;
  esac
fi

echo "remove_label=$remove_label"
if [[ "$result" == "0" ]]; then
  echo "verdict=pass"
  exit 0
elif [[ "$result" == "1" && "$reviewed" == "true" ]]; then
  echo "verdict=pass"
  exit 0
else
  echo "verdict=fail"
  exit 1
fi
