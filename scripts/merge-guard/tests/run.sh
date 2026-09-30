#!/usr/bin/env bash
# Tests de scripts/safe-merge.sh y scripts/merge-guard/check-sensitive.sh.
# Uso: bash scripts/merge-guard/tests/run.sh
#
# Usan un `gh` falso en el PATH que responde con datos preparados y deja
# constancia de si se llamó a `gh pr merge`. En cada caso negativo se
# comprueba que el script termina con error Y que el merge no se ejecutó.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
safe_merge="$root/scripts/safe-merge.sh"
check_sensitive="$root/scripts/merge-guard/check-sensitive.sh"
sha="0123456789abcdef0123456789abcdef01234567"
other_sha="fedcba9876543210fedcba9876543210fedcba98"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
passed=0
failed=0

# ---------------------------------------------------------------------------
# gh falso
# ---------------------------------------------------------------------------
mkdir -p "$tmp/bin"
cat > "$tmp/bin/gh" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
f="$FAKE_DIR"
case "$1 ${2:-}" in
  "pr view")
    # La segunda consulta del head (tras esperar) puede devolver otro commit.
    n=$(cat "$f/view-count" 2>/dev/null || echo 0); echo $((n + 1)) > "$f/view-count"
    if [[ "$*" == *"number,state"* ]]; then cat "$f/pr.json"
    else jq -n --arg s "$(cat "$f/head-after")" '{headRefOid: $s}'; fi ;;
  "pr checks") echo "(checks simulados)"; exit "$(cat "$f/checks-exit")" ;;
  "repo view") echo '{"nameWithOwner":"acme/moodly"}' ;;
  "api "*)
    [[ -f "$f/api-fail" ]] && { echo "HTTP 502" >&2; exit 1; }
    cat "$f/check-runs.json" ;;
  "pr diff")
    if [[ "$*" == *"--name-only"* ]]; then cat "$f/files.txt"; else cat "$f/diff.patch"; fi ;;
  "pr merge") echo "$*" > "$f/merged" ;;
  *) echo "gh falso: llamada no prevista: $*" >&2; exit 99 ;;
esac
FAKE
chmod +x "$tmp/bin/gh"

run_json() { # nombre status conclusion [sha] [id]
  jq -n --arg n "$1" --arg st "$2" --arg c "$3" --arg s "${4:-$sha}" --argjson id "${5:-1}" \
    '{id: $id, name: $n, head_sha: $s, status: $st, conclusion: (if $c == "null" then null else $c end)}'
}

# Escenario base: PR abierto contra main, los 4 checks en verde, cambios en UI.
setup() {
  export FAKE_DIR="$tmp/case-$1"
  rm -rf "$FAKE_DIR"; mkdir -p "$FAKE_DIR"
  jq -n --arg s "$sha" '{number: 42, state: "OPEN", isDraft: false, baseRefName: "main", headRefOid: $s}' > "$FAKE_DIR/pr.json"
  echo "$sha" > "$FAKE_DIR/head-after"
  echo 0 > "$FAKE_DIR/checks-exit"
  local id=1 runs=()
  while IFS= read -r check; do
    [[ -z "$check" || "$check" == \#* ]] && continue
    runs+=("$(run_json "$check" completed success "$sha" "$id")"); id=$((id + 1))
  done < "$root/scripts/merge-guard/required-checks.txt"
  printf '%s\n' "${runs[@]}" | jq -s '{check_runs: .}' > "$FAKE_DIR/check-runs.json"
  printf '%s\n' "packages/ui/src/components/sidebar.tsx" "apps/web/src/app/app/inbox/page.tsx" > "$FAKE_DIR/files.txt"
  printf '%s\n' "diff --git a/packages/ui/src/components/sidebar.tsx b/packages/ui/src/components/sidebar.tsx" "+export const x = 1;" > "$FAKE_DIR/diff.patch"
}

set_run() { # nombre status conclusion [sha] — sustituye la ejecución de ese check
  local runs="$FAKE_DIR/check-runs.json"
  jq --arg n "$1" --arg st "$2" --arg c "$3" --arg s "${4:-$sha}" \
    '.check_runs |= map(if .name == $n then .status = $st | .conclusion = (if $c == "null" then null else $c end) | .head_sha = $s else . end)' \
    "$runs" > "$runs.tmp" && mv "$runs.tmp" "$runs"
}

expect_refused() { # descripción
  local out status=0
  out="$(PATH="$tmp/bin:$PATH" bash "$safe_merge" 42 2>&1)" || status=$?
  if [[ $status -ne 0 && ! -f "$FAKE_DIR/merged" ]]; then
    echo "✓ $1 → se niega (exit $status): $(printf '%s\n' "$out" | grep -m1 'NO SE MERGEA' || true)"
    passed=$((passed + 1))
  else
    echo "✗ $1 → exit $status, merge llamado: $([[ -f "$FAKE_DIR/merged" ]] && cat "$FAKE_DIR/merged" || echo no)"
    printf '%s\n' "$out" | sed 's/^/    /'
    failed=$((failed + 1))
  fi
}

expect_merged() { # descripción
  local out status=0
  out="$(PATH="$tmp/bin:$PATH" bash "$safe_merge" 42 2>&1)" || status=$?
  if [[ $status -eq 0 && -f "$FAKE_DIR/merged" ]] && grep -q -- "--match-head-commit $sha" "$FAKE_DIR/merged" \
     && grep -q -- "--squash" "$FAKE_DIR/merged" && grep -q -- "--delete-branch" "$FAKE_DIR/merged"; then
    echo "✓ $1 → mergea con: gh $(cat "$FAKE_DIR/merged")"
    passed=$((passed + 1))
  else
    echo "✗ $1 → exit $status"; printf '%s\n' "$out" | sed 's/^/    /'
    failed=$((failed + 1))
  fi
}

echo "== safe-merge.sh"

setup ok; expect_merged "todo en verde y sin zonas sensibles"

setup red-watch; echo 1 > "$FAKE_DIR/checks-exit"
expect_refused "check en rojo (gh pr checks --watch falla)"

setup red-api; set_run "e2e · Playwright por rol" completed failure
expect_refused "check en rojo en la API aunque --watch devuelva 0"

setup pending; set_run "db · migraciones · pgTAP" in_progress null
expect_refused "check pendiente (in_progress)"

setup pending-exit8; echo 8 > "$FAKE_DIR/checks-exit"
expect_refused "check pendiente (gh pr checks devuelve 8)"

setup missing; jq '.check_runs |= map(select(.name != "e2e · Playwright por rol"))' "$FAKE_DIR/check-runs.json" > "$FAKE_DIR/r" && mv "$FAKE_DIR/r" "$FAKE_DIR/check-runs.json"
expect_refused "job ausente (falta e2e)"

setup skipped; set_run "sensitive-paths" completed skipped
expect_refused "job saltado (skipped)"

setup missing-sensitive; jq '.check_runs |= map(select(.name != "sensitive-paths"))' "$FAKE_DIR/check-runs.json" > "$FAKE_DIR/r" && mv "$FAKE_DIR/r" "$FAKE_DIR/check-runs.json"
expect_refused "job sensitive-paths ausente"

setup red-sensitive; set_run "sensitive-paths" completed failure
expect_refused "job sensitive-paths en rojo"

setup old-commit; set_run "typecheck · lint · test · build" completed success "$other_sha"
expect_refused "check en verde pero de otro commit"

setup rerun-red; jq --argjson r "$(run_json "e2e · Playwright por rol" completed failure "$sha" 99)" '.check_runs += [$r]' "$FAKE_DIR/check-runs.json" > "$FAKE_DIR/r" && mv "$FAKE_DIR/r" "$FAKE_DIR/check-runs.json"
expect_refused "re-ejecución más reciente en rojo (manda la última)"

setup head-moved; echo "$other_sha" > "$FAKE_DIR/head-after"
expect_refused "el head commit cambió durante la espera"

setup sensitive; echo "packages/db/supabase/migrations/20261001000000_x.sql" >> "$FAKE_DIR/files.txt"
expect_refused "archivo sensible (migración)"

setup sensitive-auth; echo "apps/web/src/lib/auth/session.ts" >> "$FAKE_DIR/files.txt"
expect_refused "archivo sensible (auth)"

setup sensitive-guard; echo "scripts/merge-guard/sensitive-paths.txt" >> "$FAKE_DIR/files.txt"
expect_refused "archivo sensible (la propia guarda)"

setup sensitive-deps; echo "apps/web/package.json" >> "$FAKE_DIR/files.txt"
expect_refused "archivo sensible (dependencias)"

setup weakened; printf '%s\n' "diff --git a/apps/web/e2e/roles.e2e.ts b/apps/web/e2e/roles.e2e.ts" '+  test.skip("a_staff ve…", async () => {});' >> "$FAKE_DIR/diff.patch"
echo "apps/web/e2e/roles.e2e.ts" >> "$FAKE_DIR/files.txt"
expect_refused "test debilitado (test.skip añadido)"

setup deleted-test; printf '%s\n' "diff --git a/apps/web/e2e/roles.e2e.ts b/apps/web/e2e/roles.e2e.ts" "deleted file mode 100644" >> "$FAKE_DIR/diff.patch"
echo "apps/web/e2e/roles.e2e.ts" >> "$FAKE_DIR/files.txt"
expect_refused "test borrado"

setup draft; jq '.isDraft = true' "$FAKE_DIR/pr.json" > "$FAKE_DIR/p" && mv "$FAKE_DIR/p" "$FAKE_DIR/pr.json"
expect_refused "PR en borrador"

setup closed; jq '.state = "MERGED"' "$FAKE_DIR/pr.json" > "$FAKE_DIR/p" && mv "$FAKE_DIR/p" "$FAKE_DIR/pr.json"
expect_refused "PR no abierto"

setup base; jq '.baseRefName = "release"' "$FAKE_DIR/pr.json" > "$FAKE_DIR/p" && mv "$FAKE_DIR/p" "$FAKE_DIR/pr.json"
expect_refused "PR que no apunta a main"

setup api-error; touch "$FAKE_DIR/api-fail"
expect_refused "error de la API de GitHub"

setup no-files; : > "$FAKE_DIR/files.txt"
expect_refused "PR sin archivos"

echo "== check-sensitive.sh"
check_case() { # descripción esperado(0|1) ruta...
  local desc="$1" expected="$2"; shift 2
  printf '%s\n' "$@" > "$tmp/paths.txt"
  local status=0
  bash "$check_sensitive" "$tmp/paths.txt" > /dev/null || status=$?
  if [[ $status -eq $expected ]]; then echo "✓ $desc → $status"; passed=$((passed + 1))
  else echo "✗ $desc → $status (esperado $expected)"; failed=$((failed + 1)); fi
}
check_case "UI y páginas nuevas" 0 packages/ui/src/components/sidebar.tsx apps/web/src/app/app/inbox/page.tsx docs/STATUS.md docs/adr/0019-x.md
for path in packages/db/supabase/migrations/1_x.sql packages/db/supabase/rollbacks/1_x.down.sql packages/db/supabase/tests/database/07_x.test.sql \
  packages/db/supabase/config.toml apps/web/src/proxy.ts apps/web/src/lib/auth/routes.ts apps/web/src/lib/supabase/server.ts \
  apps/web/src/app/login/page.tsx apps/web/src/app/app/actions.ts apps/web/src/app/app/page.tsx apps/web/.env.example \
  apps/web/scripts/local-env.ts packages/db/src/seed/run.ts .github/workflows/ci.yml scripts/safe-merge.sh \
  apps/web/playwright.config.ts eslint.config.js packages/ui/tsconfig.json turbo.json apps/web/next.config.ts \
  package.json apps/web/package.json pnpm-lock.yaml pnpm-workspace.yaml AGENTS.md CLAUDE.md docs/MANUAL.md; do
  check_case "sensible: $path" 1 "$path"
done

echo "== required-checks.txt"
for required in "typecheck · lint · test · build" "db · migraciones · pgTAP" "e2e · Playwright por rol" "sensitive-paths"; do
  if grep -qxF -- "$required" "$root/scripts/merge-guard/required-checks.txt"; then
    echo "✓ exige \"$required\""; passed=$((passed + 1))
  else
    echo "✗ falta \"$required\" en required-checks.txt"; failed=$((failed + 1))
  fi
done

echo "== sensitive-gate.sh (decisión del job de CI)"
gate="$root/scripts/merge-guard/sensitive-gate.sh"
gate_case() { # descripción resultado acción etiqueta → exit esperado, remove_label esperado
  local desc="$1" result="$2" action="$3" label="$4" want_exit="$5" want_remove="$6" out status=0
  out="$(bash "$gate" "$result" "$action" "$label")" || status=$?
  if [[ $status -eq $want_exit && "$out" == *"remove_label=$want_remove"* ]]; then
    echo "✓ $desc → exit $status, remove_label=$want_remove"; passed=$((passed + 1))
  else
    echo "✗ $desc → exit $status (esperado $want_exit), salida: $(echo "$out" | tr '\n' ' ')"; failed=$((failed + 1))
  fi
}
gate_case "limpio, sin etiqueta" 0 opened false 0 false
gate_case "limpio, commit nuevo con etiqueta (se quita igual)" 0 synchronize true 0 true
gate_case "sensible, sin etiqueta" 1 opened false 1 false
gate_case "sensible, producto pone la etiqueta (labeled)" 1 labeled true 0 false
gate_case "sensible, etiqueta quitada (unlabeled)" 1 unlabeled false 1 false
gate_case "sensible, COMMIT NUEVO tras la revisión (synchronize con etiqueta)" 1 synchronize true 1 true
gate_case "sensible, commit nuevo sin etiqueta" 1 synchronize false 1 false
gate_case "sensible, PR reabierto con etiqueta" 1 reopened true 1 true
gate_case "sensible, otro cambio de etiquetas con revisado-humano puesta" 1 labeled true 0 false
gate_case "error de check-sensitive, aunque tenga etiqueta" 2 labeled true 1 false

echo
echo "Resultado: $passed pasan, $failed fallan"
[[ $failed -eq 0 ]]
