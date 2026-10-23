#!/usr/bin/env bash
# Tests de scripts/supabase/config-drift.sh. Las salidas de la CLI son las del
# despliegue a staging del 2026-10-23 (CLI 2.118.0), con sus códigos de terminal.
# Uso: bash scripts/supabase/tests/config-drift.test.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
script="$root/scripts/supabase/config-drift.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
passed=0
failed=0
esc=$'\x1b'

push_twilio="Pushing config to project: moodly-staging (sgeswmdqstonegceusej)
Remote API config is up to date.
Remote Auth config has 1 difference config push cannot write (see notes below).
Note: 1 declared property could not be encoded and was not pushed: auth.sms.twilio.enabled (config push can switch between SMS providers but cannot turn the active provider off; disable phone sign-in or use the dashboard)
Note: 12 declared properties are not managed by config push and were not compared; run \`supabase config diff\` to list them."
push_clean="Pushing config to project: moodly-staging (sgeswmdqstonegceusej)
Remote API config is up to date.
Remote Auth config is up to date."
diff_twilio="Comparing against project sgeswmdqstonegceusej using [remotes.staging]
${esc}[?25l│
◒  Fetching remote config...
Comparison scope: api, auth, database, pooler, realtime, storage
${esc}[1G${esc}[J${esc}[?25hauth.sms.twilio.enabled [update]
  local:  false
  remote: true

1 difference found (1 update, 0 remote-only, 0 local-only).
Note: 2 credential values not compared (masked by the API): auth.external.apple.secret, auth.sms.twilio.auth_token"

# case <nombre> <exit esperado> <push> <diff> [texto que debe salir]
case_() {
  local name="$1" want="$2" push="$3" diff="$4" expect="${5:-}"
  printf '%s' "$push" > "$tmp/push.txt"
  printf '%s' "$diff" > "$tmp/diff.txt"
  local got=0 out
  out="$(bash "$script" "$tmp/push.txt" "$tmp/diff.txt" 2>&1)" || got=$?
  if [ "$got" -eq "$want" ] && { [ -z "$expect" ] || grep -qF -- "$expect" <<<"$out"; }; then
    passed=$((passed + 1)); echo "ok   $name"
  else
    failed=$((failed + 1)); echo "FAIL $name (exit $got, esperado $want)"; echo "$out" | sed 's/^/     /'
  fi
}

case_ "lo de staging: Twilio no se puede aplicar → aviso y verde" 0 "$push_twilio" "$diff_twilio" \
  "::warning::auth.sms.twilio.enabled"

case_ "la misma diferencia sin la nota de config push → rojo" 1 "$push_clean" "$diff_twilio" \
  "::error::auth.sms.twilio.enabled [update]"

case_ "Twilio y otra diferencia que sí se podía aplicar → rojo" 1 "$push_twilio" "$(printf '%s\n' \
  "${esc}[1G${esc}[J${esc}[?25hauth.site_url [update]" "  local:  \"https://staging.example\"" "  remote: \"http://localhost:3000\"" "" \
  "auth.sms.twilio.enabled [update]" "  local:  false" "  remote: true" "" \
  "2 differences found (2 update, 0 remote-only, 0 local-only).")" "::error::auth.site_url [update]"

case_ "una propiedad remote-only → rojo" 1 "$push_clean" "$(printf '%s\n' \
  "auth.hook.custom_access_token.enabled [remote-only]" "  local:  (unset)" "  remote: true" "" \
  "1 difference found (0 update, 1 remote-only, 0 local-only).")" "::error::auth.hook.custom_access_token.enabled"

case_ "sin diferencias → verde" 0 "$push_clean" "Comparing against project x using [remotes.staging]
No config differences found."

case_ "solo local-only (la API no las devuelve) → verde" 0 "$push_clean" "$(printf '%s\n' \
  "auth.password_requirements [local-only]" "  local:  \"lower_upper_letters_digits\"" "  remote: (not returned)" "" \
  "1 difference found (0 update, 0 remote-only, 1 local-only).")"

case_ "el resumen cuenta más diferencias de las que se leen → rojo" 1 "$push_twilio" "$(printf '%s\n' \
  "auth.sms.twilio.enabled [update]" "  local:  false" "  remote: true" "" \
  "auth.external[\"x\"] es raro" "" \
  "2 differences found (2 update, 0 remote-only, 0 local-only).")" "no se puede comprobar"

case_ "salida de config diff con otro formato → rojo" 1 "$push_twilio" "Error: failed to read project config: 403" \
  "formato esperado"

case_ "varias propiedades no aplicables, con motivos con comas → verde" 0 \
  "Note: 2 declared properties could not be encoded and were not pushed: auth.sms.twilio.enabled (cannot turn it off, really), auth.sms.vonage.enabled (idem; dashboard)" \
  "$(printf '%s\n' "auth.sms.twilio.enabled [update]" "auth.sms.vonage.enabled [update]" "" \
    "2 differences found (2 update, 0 remote-only, 0 local-only).")" "::warning::auth.sms.vonage.enabled"

case_ "propiedad sin campo en la Management API → aviso y verde" 0 \
  "Note: 1 declared property has no Management API field and was not pushed: storage.vector.max_buckets (change it from the dashboard)." \
  "$(printf '%s\n' "storage.vector.max_buckets [update]" "" "1 difference found (1 update, 0 remote-only, 0 local-only).")" \
  "::warning::storage.vector.max_buckets"

case_ "el motivo nombra otra propiedad: no la excusa → rojo" 1 \
  "Note: 1 declared property could not be encoded and was not pushed: auth.sms.twilio.enabled (see auth.site_url)" \
  "$(printf '%s\n' "auth.site_url [update]" "" "1 difference found (1 update, 0 remote-only, 0 local-only).")" \
  "::error::auth.site_url"

echo
echo "$passed pasan, $failed fallan"
[ "$failed" -eq 0 ]
