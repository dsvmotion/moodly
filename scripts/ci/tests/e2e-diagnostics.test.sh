#!/usr/bin/env bash
# Tests del filtro de secretos de scripts/ci/e2e-diagnostics.sh: lo que sube al
# artefacto del CI no puede llevar tokens, claves ni contraseñas.
# Uso: bash scripts/ci/tests/e2e-diagnostics.test.sh

set -uo pipefail
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/e2e-diagnostics.sh"
pass=0
fail=0

check() {
  local name="$1" input="$2" must_not="$3" must="$4"
  local out
  out="$(printf '%s\n' "$input" | bash "$SCRIPT" redact)"
  if [[ -n "$must_not" && "$out" == *"$must_not"* ]]; then
    echo "FALLA: $name: sigue saliendo «$must_not» en «$out»"
    fail=$((fail + 1))
  elif [[ -n "$must" && "$out" != *"$must"* ]]; then
    echo "FALLA: $name: falta «$must» en «$out»"
    fail=$((fail + 1))
  else
    pass=$((pass + 1))
  fi
}

# Los valores con forma de secreto se construyen al ejecutar, con relleno
# inventado («x», «y»…): en el código no hay ningún literal que un escáner de
# secretos (gitleaks) pueda confundir con una clave, ni siquiera de ejemplo.
fill() { printf "$1%.0s" $(seq 1 "$2"); }
B64_PART="$(printf '%s' '{"sub":"x"}' | base64 | tr -d '=\n' | tr '/+' '_-')"
JWT="ey""J$(fill a 16).ey""J$(fill b 16).$(fill c 20)"
SECRET_KEY="sb_""secret_$(fill x 40)"
PUBLISHABLE_KEY="sb_""publishable_$(fill y 40)"
SESSION_COOKIE="sb-127-auth-token=base64-ey""J${B64_PART}"
check "JWT suelto" "token=$JWT ok" "$(fill a 16)" "[jwt]"
check "cabecera Authorization" '{"authorization":"Bearer abc.def-123"}' "abc.def-123" "[redacted]"
check "Authorization en texto" "Authorization: Bearer opaque-token-xyz" "opaque-token-xyz" "[redacted]"
check "apikey en query" "GET /rest/v1/x?apikey=clave-secreta&select=id" "clave-secreta" "select=id"
check "apikey en JSON" '{"apikey": "otra-clave"}' "otra-clave" "[redacted]"
check "clave secreta de Supabase" "SUPABASE_SECRET_KEY=$SECRET_KEY" "$(fill x 40)" "sb_secret_[redacted]"
check "clave publicable" "key $PUBLISHABLE_KEY" "$(fill y 40)" "sb_publishable_[redacted]"
check "contraseña en SQL" "statement: alter role dbos_worker login password 'S3creta!'" "S3creta!" "password '[redacted]'"
check "contraseña en JSON" '{"email":"a@demo.test","password":"Clave-123"}' "Clave-123" '"password":"[redacted]"'
check "refresh_token en JSON" '{"refresh_token":"r3fr3sh-v4lue","token_type":"bearer"}' "r3fr3sh-v4lue" '"token_type":"bearer"'
check "access_token en query" "GET /callback?access_token=opaco123&expires_in=3600" "opaco123" "expires_in=3600"
check "cookie de sesión de Supabase" "cookie: $SESSION_COOKIE; other=1" "$B64_PART" "other=1"
check "contraseña con comilla escapada" "alter role x password 'a''b-secreta'" "b-secreta" "password '[redacted]'"
check "parámetros de una sentencia" 'DETAIL:  parameters: $1 = admin.a@demo.test, $2 = Clave-123' "Clave-123" "parameters: [redacted]"
check "PGPASSWORD" "env PGPASSWORD=supersecreta psql" "supersecreta" "PGPASSWORD=[redacted]"
check "lo demás se conserva" '{"status":504,"path":"/token","duration":10002345}' "" '"status":504,"path":"/token"'
check "un log de lock se conserva" "LOG:  process 123 still waiting for ShareLock on transaction 456 after 1000.123 ms" "" "still waiting for ShareLock"

echo "Resultado: $pass pasan, $fail fallan"
[[ "$fail" -eq 0 ]]
