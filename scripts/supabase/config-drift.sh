#!/usr/bin/env bash
# Comprueba que, tras `supabase config push`, staging ya no difiere de
# config.toml (último paso de .github/workflows/deploy-staging.yml).
#
# Uso: config-drift.sh <salida de config push> <salida de config diff>
#
# Falla con cualquier diferencia ([update] o [remote-only]) salvo las que el
# propio `config push` de esa misma ejecución declara que no puede aplicar
# («could not be encoded» o «no Management API field», «and was not pushed»):
# p. ej. auth.sms.twilio.enabled, porque la CLI no puede apagar el proveedor de
# SMS activo de un proyecto alojado. Esas salen como aviso en el log, nunca en
# silencio. Las «local-only» (propiedades que la API no devuelve) no cuentan.
# Decisión de producto del 2026-10-23.
set -euo pipefail

# Sin los códigos de terminal que la CLI mezcla con la salida (a veces delante
# del nombre de la propiedad).
clean() { sed -E 's/\x1b\[[0-9;?]*[A-Za-z]//g' "$1"; }
push_output="$(clean "$1")"
diff_output="$(clean "$2")"

# Nombres con puntos (auth.sms.twilio.enabled) de las notas de config push, sin
# el motivo entre paréntesis que acompaña a cada uno.
unpushable="$(
  grep -E '(could not be encoded|no Management API field) and (was|were) not pushed:' <<<"$push_output" \
    | sed -E 's/.*not pushed:[[:space:]]*//; s/\([^)]*\)//g' \
    | grep -oE '[a-z_]+(\.[a-z0-9_]+)+' \
    | sort -u || true
)"

# Resumen de config diff: «No config differences found.» o
# «N difference(s) found (U update, R remote-only, L local-only).»
if grep -qE '^No config differences found\.' <<<"$diff_output"; then
  expected=0
elif summary="$(grep -oE '^[0-9]+ differences? found \([0-9]+ update, [0-9]+ remote-only, [0-9]+ local-only\)' <<<"$diff_output")"; then
  updates="$(sed -E 's/.*\(([0-9]+) update.*/\1/' <<<"$summary")"
  remote_only="$(sed -E 's/.*update, ([0-9]+) remote-only.*/\1/' <<<"$summary")"
  expected=$((updates + remote_only))
else
  echo "::error::La salida de config diff no tiene el formato esperado; no se puede comprobar"
  exit 1
fi

# Propiedades que siguen distintas. Si no salen tantas como dice el resumen,
# algo no se ha leído bien y no se da por bueno.
pending="$(grep -E '^[^[:space:]]+ \[(update|remote-only)\]' <<<"$diff_output" || true)"
found="$(grep -c . <<<"$pending" || true)"
if [ "$found" -ne "$expected" ]; then
  echo "::error::config diff cuenta $expected diferencias y se han leído $found; no se puede comprobar"
  exit 1
fi

failures=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  property="${line%% *}"
  if grep -qxF "$property" <<<"$unpushable"; then
    echo "::warning::$property sigue distinto de config.toml: config push declara que no puede aplicarlo"
  else
    echo "::error::$line: la configuración de staging no coincide con config.toml después del push"
    failures=$((failures + 1))
  fi
done <<<"$pending"

if [ "$failures" -gt 0 ]; then exit 1; fi
echo "Configuración de staging igual a config.toml (salvo lo que config push declara que no puede aplicar)."
