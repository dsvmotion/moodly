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
# Los casos de zonas sensibles prueban la lista completa (suspendida desde el
# 2026-10-22), para que reactivarla entera sea copiar líneas y nada más. Los
# casos de la lista activa (la corta de M0, P-01) van al final, sin esta variable.
export SENSITIVE_PATTERNS="$root/scripts/merge-guard/sensitive-paths.suspended.txt"
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
    if [[ "$*" == *"/compare/"* ]]; then cat "$f/merge-base"
    elif [[ "$*" == *"/contents/packages/evals/baseline.json?ref="* ]]; then
      # La línea base en un commit: baseline-<commit>.json, o 404 si no hay.
      all="$*"; ref="${all##*ref=}"; ref="${ref%% *}"
      [[ -f "$f/contents-fail" ]] && { echo "gh: Server Error (HTTP 500)" >&2; exit 1; }
      if [[ -f "$f/baseline-$ref.json" ]]; then cat "$f/baseline-$ref.json"; else echo "gh: Not Found (HTTP 404)" >&2; exit 1; fi
    elif [[ "$2" == *"/statuses"* ]]; then cat "$f/statuses.json"; else cat "$f/check-runs.json"; fi ;;
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
  # La guarda publica commit statuses (más reciente primero, como la API).
  jq -n '[{id: 1, context: "sensitive-paths", state: "success", creator: {login: "github-actions[bot]"}}]' > "$FAKE_DIR/statuses.json"
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

setup skipped; set_run "db · migraciones · pgTAP" completed skipped
expect_refused "job saltado (skipped)"

setup missing-sensitive; echo '[]' > "$FAKE_DIR/statuses.json"
expect_refused "status sensitive-paths ausente"

setup red-sensitive; echo '[{"id": 1, "context": "sensitive-paths", "state": "failure", "creator": {"login": "github-actions[bot]"}}]' > "$FAKE_DIR/statuses.json"
expect_refused "status sensitive-paths en rojo"

setup pending-sensitive; echo '[{"id": 1, "context": "sensitive-paths", "state": "pending", "creator": {"login": "github-actions[bot]"}}]' > "$FAKE_DIR/statuses.json"
expect_refused "status sensitive-paths pendiente"

setup latest-sensitive; echo '[{"id": 7, "context": "sensitive-paths", "state": "failure", "creator": {"login": "github-actions[bot]"}}, {"id": 3, "context": "sensitive-paths", "state": "success", "creator": {"login": "github-actions[bot]"}}]' > "$FAKE_DIR/statuses.json"
expect_refused "status sensitive-paths: manda el más reciente (en rojo)"

setup user-sensitive; echo '[{"id": 9, "context": "sensitive-paths", "state": "success", "creator": {"login": "dsvmotion"}}, {"id": 4, "context": "sensitive-paths", "state": "failure", "creator": {"login": "github-actions[bot]"}}]' > "$FAKE_DIR/statuses.json"
expect_refused "un status en verde publicado por una persona o una sesión no tapa el de la guarda"

setup only-user-sensitive; echo '[{"id": 9, "context": "sensitive-paths", "state": "success", "creator": {"login": "dsvmotion"}}]' > "$FAKE_DIR/statuses.json"
expect_refused "un status en verde que no publica GitHub Actions no cuenta"

setup fake-sensitive-check; echo '[]' > "$FAKE_DIR/statuses.json"
jq --argjson r "$(run_json "sensitive-paths" completed success "$sha" 50)" '.check_runs += [$r]' "$FAKE_DIR/check-runs.json" > "$FAKE_DIR/r" && mv "$FAKE_DIR/r" "$FAKE_DIR/check-runs.json"
expect_refused "un check run llamado sensitive-paths (un job del PR) no sustituye al status"

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

# La línea base de las evals (K-01): safe-merge lee sus dos versiones por la
# API y la guarda compara las claves. Con la lista activa (vacía), como hoy.
merge_base_sha="1111111111111111111111111111111111111111"
setup_baseline() { # nombre json-antes json-después
  setup "$1"
  echo "$merge_base_sha" > "$FAKE_DIR/merge-base"
  [[ -n "$2" ]] && printf '%s\n' "$2" > "$FAKE_DIR/baseline-$merge_base_sha.json"
  [[ -n "$3" ]] && printf '%s\n' "$3" > "$FAKE_DIR/baseline-$sha.json"
  echo "packages/evals/baseline.json" >> "$FAKE_DIR/files.txt"
}
known_a='{"knownFailures": {"recepcion-no-duplica-solicitud": {"reason": "r"}}}'
known_ab='{"knownFailures": {"recepcion-no-duplica-solicitud": {"reason": "r"}, "recepcion-reservar": {"reason": "r"}}}'
(
  unset SENSITIVE_PATTERNS
  setup_baseline baseline-added "$known_a" "$known_ab"
  expect_refused "la línea base gana un fallo conocido"
  setup_baseline baseline-removed "$known_ab" "$known_a"
  expect_merged "la línea base pierde un fallo conocido (se arregló)"
  setup_baseline baseline-new-file "" "$known_a"
  expect_refused "la línea base aparece con un fallo conocido (antes no existía: 404)"
  setup_baseline baseline-api-error "$known_a" "$known_a"; touch "$FAKE_DIR/contents-fail"
  expect_refused "la API no da la línea base (error que no es 404)"
  [[ $failed -eq 0 ]]
) && passed=$((passed + 4)) || failed=$((failed + 1))

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

echo "== lista activa: vacía (decisión de producto, 2026-11-11)"
(
  unset SENSITIVE_PATTERNS
  for path in packages/db/supabase/migrations/1_x.sql packages/db/supabase/tests/database/01_x.test.sql \
    packages/db/supabase/config.toml apps/web/src/proxy.ts apps/web/src/lib/auth/session.ts \
    apps/web/src/lib/supabase/server.ts apps/web/src/app/login/page.tsx apps/web/.env.example \
    .github/workflows/ci.yml .github/workflows/sensitive-paths.yml scripts/merge-guard/check-sensitive.sh \
    scripts/merge-guard/sensitive-paths.txt scripts/safe-merge.sh .claude/settings.json .claude/skills/x/SKILL.md \
    AGENTS.md CLAUDE.md apps/web/CLAUDE.md packages/db/AGENTS.md apps/web/.claude/settings.json .mcp.json \
    package.json apps/web/package.json pnpm-lock.yaml packages/db/src/service.ts scripts/supabase/config-drift.sh pnpm-workspace.yaml .npmrc apps/web/.npmrc; do
    echo "$path" > "$tmp/paths.txt"
    status=0; bash "$check_sensitive" "$tmp/paths.txt" > /dev/null || status=$?
    if [[ $status -eq 0 ]]; then echo "✓ activa vacía, no sensible: $path → 0"
    else echo "✗ activa vacía, $path → $status (esperado 0)"; exit 1; fi
  done
  for path in apps/web/src/app/app/inbox/page.tsx packages/evals/src/conversations/checks.ts docs/STATUS.md \
    docs/WORKSTREAMS.md docs/scope.yaml apps/worker/src/agents/converse.ts; do
    echo "$path" > "$tmp/paths.txt"
    status=0; bash "$check_sensitive" "$tmp/paths.txt" > /dev/null || status=$?
    if [[ $status -eq 0 ]]; then echo "✓ activa, no sensible: $path → 0"
    else echo "✗ activa, $path → $status (esperado 0)"; exit 1; fi
  done
  # La llamada se compone por partes: escrita literal, la propia guarda la
  # detectaría en el diff de cualquier PR que toque este archivo.
  skip_call="test"".skip"
  printf '%s\n' "diff --git a/apps/web/e2e/roles.e2e.ts b/apps/web/e2e/roles.e2e.ts" "+  ${skip_call}(\"x\", async () => {});" > "$tmp/diff.patch"
  echo "apps/web/e2e/roles.e2e.ts" > "$tmp/paths.txt"
  status=0; bash "$check_sensitive" "$tmp/paths.txt" "$tmp/diff.patch" > /dev/null || status=$?
  if [[ $status -eq 1 ]]; then echo "✓ con la lista activa, un test.skip sigue bloqueando → 1"
  else echo "✗ con la lista activa, un test.skip no bloquea → $status (esperado 1)"; exit 1; fi
) && passed=$((passed + 36)) || failed=$((failed + 1))

echo "== entradas que no se pueden releer (\`<(…)\`, como en el procedimiento de mergeo)"
# La guarda lee la lista de rutas una vez por patrón. Con una tubería, solo el
# primer patrón veía las rutas y el resultado salía limpio sin serlo.
procsub_case() { # descripción exit-esperado rutas diff
  local desc="$1" want="$2" paths="$3" patch="$4" status=0
  bash "$check_sensitive" <(printf '%b' "$paths") <(printf '%b' "$patch") > /dev/null || status=$?
  if [[ $status -eq $want ]]; then echo "✓ $desc → $status"; passed=$((passed + 1)); else echo "✗ $desc → $status (esperado $want)"; failed=$((failed + 1)); fi
}
procsub_case "una ruta sensible que no es la del primer patrón" 1 "docs/STATUS.md\nCLAUDE.md\n" ""
procsub_case "un archivo de test borrado" 1 "apps/web/src/x.test.ts\n" "diff --git a/apps/web/src/x.test.ts b/apps/web/src/x.test.ts\ndeleted file mode 100644\n"
procsub_case "nada sensible" 0 "docs/STATUS.md\n" "diff --git a/docs/STATUS.md b/docs/STATUS.md\n+x\n"

echo "== fallos conocidos nuevos en la línea base de las evals (K-01): se leen como JSON"
bl="packages/evals/baseline.json"
bl_case() { # descripción exit-esperado rutas antes después [sin-versiones]
  local desc="$1" want="$2" paths="$3" before="$4" after="$5" status=0
  if [[ "${6:-}" == "sin-versiones" ]]; then
    bash "$check_sensitive" <(printf '%b' "$paths") <(printf 'diff --git a/x b/x\n') > "$tmp/bl.out" || status=$?
  else
    bash "$check_sensitive" <(printf '%b' "$paths") <(printf 'diff --git a/x b/x\n') <(printf '%s' "$before") <(printf '%s' "$after") > "$tmp/bl.out" || status=$?
  fi
  if [[ $status -eq $want ]]; then echo "✓ $desc → $status $(head -n1 "$tmp/bl.out")"; passed=$((passed + 1))
  else echo "✗ $desc → $status (esperado $want)"; sed 's/^/    /' "$tmp/bl.out"; failed=$((failed + 1)); fi
}
one='{"knownFailures": {"recepcion-no-duplica-solicitud": {"reason": "viejo", "since": "2026-11-09", "tracking": "#155"}}}'
one_pretty="$(jq . <<< "$one")"
two='{"knownFailures": {"recepcion-no-duplica-solicitud": {"reason": "viejo", "since": "2026-11-09", "tracking": "#155"}, "recepcion-reservar": {"reason": "x"}}}'
bl_case "un caso nuevo en knownFailures" 1 "$bl\n" "$one_pretty" "$(jq . <<< "$two")"
bl_case "un caso nuevo, todo en una línea (el diff por líneas no lo veía)" 1 "$bl\n" "$one_pretty" "$(jq -c . <<< "$two")"
bl_case "un caso nuevo con un id que no es kebab-case" 1 "$bl\n" "$one_pretty" '{"knownFailures": {"recepcion-no-duplica-solicitud": {}, "Recepcion_Reservar": {}}}'
bl_case "el archivo nuevo con un caso (antes no existía)" 1 "$bl\n" "" "$one_pretty"
bl_case "el archivo nuevo sin casos" 0 "$bl\n" "" '{"knownFailures": {}}'
bl_case "cambiar el motivo de un caso que ya estaba" 0 "$bl\n" "$one_pretty" "$(jq '.knownFailures[].reason = "nuevo"' <<< "$one")"
bl_case "reformatear y reordenar: los mismos casos" 0 "$bl\n" "$(jq . <<< "$two")" "$(jq -cS . <<< "$two")"
bl_case "quitar un caso (se arregló)" 0 "$bl\n" "$(jq . <<< "$two")" "$one_pretty"
bl_case "borrar el archivo" 0 "$bl\n" "$one_pretty" ""
bl_case "después no es JSON: bloquea" 1 "$bl\n" "$one_pretty" '{"knownFailures": {'
bl_case "knownFailures no es un objeto: bloquea" 1 "$bl\n" "$one_pretty" '{"knownFailures": ["recepcion-reservar"]}'
bl_case "no es un objeto: bloquea" 1 "$bl\n" "$one_pretty" '["recepcion-reservar"]'
bl_case "el PR la toca y no llegan sus dos versiones: bloquea" 1 "$bl\n" "" "" sin-versiones
bl_case "lo mismo en otro archivo no cuenta" 0 "docs/x.json\n" "" "" sin-versiones
bl_case "con versiones distintas pero sin tocar el archivo, no cuenta" 0 "docs/x.json\n" "$one_pretty" "$(jq . <<< "$two")"
if grep -q 'FALLO CONOCIDO AÑADIDO (packages/evals/baseline.json): "recepcion-reservar"' < <(bash "$check_sensitive" <(printf '%b' "$bl\n") <(printf 'diff --git a/x b/x\n') <(printf '%s' "$one") <(printf '%s' "$two") || true); then
  echo "✓ dice qué caso se añadió"; passed=$((passed + 1))
else echo "✗ no dice qué caso se añadió"; failed=$((failed + 1)); fi

echo "== baseline-versions.sh (las dos versiones de la línea base, por la API)"
versions="$root/scripts/merge-guard/baseline-versions.sh"
bv_case() { # descripción exit-esperado [antes-esperado después-esperado]
  local desc="$1" want="$2" status=0
  mkdir -p "$FAKE_DIR/out"
  PATH="$tmp/bin:$PATH" bash "$versions" acme/moodly main "$sha" "$FAKE_DIR/out" > /dev/null 2>&1 || status=$?
  if [[ $status -eq $want ]] && { [[ $want -ne 0 ]] || { [[ "$(cat "$FAKE_DIR/out/baseline-before.json")" == "$3" ]] && [[ "$(cat "$FAKE_DIR/out/baseline-after.json")" == "$4" ]]; }; }; then
    echo "✓ $desc → $status"; passed=$((passed + 1))
  else echo "✗ $desc → $status (esperado $want)"; failed=$((failed + 1)); fi
}
bv_setup() { export FAKE_DIR="$tmp/bv-$1"; rm -rf "$FAKE_DIR"; mkdir -p "$FAKE_DIR"; echo "$merge_base_sha" > "$FAKE_DIR/merge-base"; }
bv_setup both; echo '{"a":1}' > "$FAKE_DIR/baseline-$merge_base_sha.json"; echo '{"b":2}' > "$FAKE_DIR/baseline-$sha.json"
bv_case "lee la del merge-base y la del head" 0 '{"a":1}' '{"b":2}'
bv_setup new; echo '{"b":2}' > "$FAKE_DIR/baseline-$sha.json"
bv_case "si no existe en el merge-base (404), la deja vacía" 0 "" '{"b":2}'
bv_setup error; touch "$FAKE_DIR/contents-fail"
bv_case "otro error de la API: falla" 1
bv_setup bad-base; echo "null" > "$FAKE_DIR/merge-base"
bv_case "merge-base que no es un commit: falla" 1

echo "== el workflow de la guarda corre desde la rama base (P-01)"
workflow="$root/.github/workflows/sensitive-paths.yml"
wf_case() { # descripción comando
  local desc="$1"; shift
  if "$@"; then echo "✓ $desc"; passed=$((passed + 1)); else echo "✗ $desc"; failed=$((failed + 1)); fi
}
wf_case "se dispara con pull_request_target" grep -Eq '^  pull_request_target:' "$workflow"
wf_case "no se dispara con pull_request (correría la versión del PR)" bash -c '! grep -Eq "^  pull_request:" "$1"' _ "$workflow"
wf_case "nunca hace checkout del head del PR" bash -c '! grep -Eq "pull_request\.head\.(sha|ref)|github\.head_ref|refs/pull/" "$1"' _ "$workflow"
wf_case "el checkout es el de la rama base" grep -Fq 'ref: ${{ github.event.pull_request.base.ref }}' "$workflow"
wf_case "el checkout no guarda credenciales" grep -Fq 'persist-credentials: false' "$workflow"
wf_case "sin permisos por defecto en el workflow" grep -Eq '^permissions: \{\}' "$workflow"
wf_case "lee los archivos y el diff del PR por la API" grep -Fq 'pulls/$PR_NUMBER/files' "$workflow"
wf_case "publica sensitive-paths como commit status en el head del PR (pull_request_target corre en main)" bash -c 'grep -Fq "repos/\$GH_REPO/statuses/\$HEAD_SHA" "$1" && grep -Fq "context=sensitive-paths" "$1" && ! grep -Fq "/check-runs" "$1"' _ "$workflow"
wf_case "el job no se llama sensitive-paths (su check quedaría en main)" bash -c '! grep -Eq "^    name: sensitive-paths$" "$1"' _ "$workflow"
wf_case "el head sale de la API, antes y después de leer el PR" bash -c '[[ $(grep -c "pulls/\$PR_NUMBER\" --jq .head.sha" "$1") -eq 2 ]] && grep -Fq "if: steps.pr.outputs.same_head == '"'"'true'"'"'" "$1"' _ "$workflow"
wf_case "solo escribe statuses; el PR solo lo toca invalidate-review" bash -c '[[ $(grep -c "statuses: write" "$1") -eq 1 && $(grep -c "pull-requests: write" "$1") -eq 1 && $(grep -cE "^ +[a-z-]+: write" "$1") -eq 2 ]]' _ "$workflow"
wf_case "un cambio de base vuelve a pasar la guarda (edited)" grep -Eq 'types: \[.*edited\]' "$workflow"
wf_case "los runs no se cancelan (un evento de etiqueta no salta el que quita revisado-humano)" grep -Eq '^  cancel-in-progress: false$' "$workflow"
wf_case "las etiquetas salen de la API, no del evento" bash -c 'grep -Fq "issues/\$PR_NUMBER/labels" "$1" && ! grep -Fq "github.event.pull_request.labels" "$1"' _ "$workflow"
wf_case "solo da por buenos PRs contra la rama por defecto" grep -Fq 'if [[ "$BASE" != "$DEFAULT_BRANCH" ]]; then' "$workflow"
gate_base_status=0; bash "$root/scripts/merge-guard/sensitive-gate.sh" base labeled true > /dev/null || gate_base_status=$?
wf_case "con otra base, el veredicto es fail aunque lleve la etiqueta" test "$gate_base_status" -eq 1
wf_case "lee las dos versiones de la línea base y se las pasa a la guarda" bash -c 'grep -Fq "baseline-versions.sh" "$1" && grep -Fq "baseline-before.json" "$1" && grep -Fq "baseline-after.json" "$1"' _ "$workflow"
wf_case "el resultado de la guarda no pasa por una tubería" bash -c '! grep -Eq "check-sensitive\.sh[^|]*\| *tee" "$1"' _ "$workflow"

echo "== el workflow de la Revisora corre desde la rama base y no ejecuta el PR (SE01)"
workflow="$root/.github/workflows/revisora.yml"
wf_case "se dispara con pull_request_target" grep -Eq '^  pull_request_target:' "$workflow"
wf_case "no se dispara con pull_request (correría la versión del PR)" bash -c '! grep -Eq "^  pull_request:" "$1"' _ "$workflow"
wf_case "nunca hace checkout del head del PR" bash -c '! grep -Eq "pull_request\.head\.(sha|ref)|github\.head_ref|refs/pull/" "$1"' _ "$workflow"
wf_case "el checkout es el de la rama base" grep -Fq 'ref: ${{ github.event.pull_request.base.ref || github.event.repository.default_branch }}' "$workflow"
wf_case "el checkout no guarda credenciales" grep -Fq 'persist-credentials: false' "$workflow"
wf_case "sin permisos por defecto en el workflow ni en el job" bash -c '[[ $(grep -cE "^ *permissions: \{\}" "$1") -ge 2 ]]' _ "$workflow"
wf_case "no instala dependencias (no corre código de paquetes del PR)" bash -c '! grep -Eq "(pnpm|npm|yarn) (install|ci)|npx " "$1"' _ "$workflow"
wf_case "no revisa borradores ni PRs contra otras ramas" grep -Fq "github.event.pull_request.draft == false && github.event.pull_request.base.ref == 'main'" "$workflow"
wf_case "las claves solo en el entorno reviewer" grep -Eq '^    environment: reviewer$' "$workflow"
wf_case "el token de la App solo con pull requests (escritura) y contenidos (lectura)" bash -c 'grep -q "permission-pull-requests: write" "$1" && grep -q "permission-contents: read" "$1" && [[ $(grep -c "permission-" "$1") -eq 2 ]]' _ "$workflow"
wf_case "todas las acciones fijadas a un commit" bash -c '! grep -E "uses: " "$1" | grep -Ev "@[0-9a-f]{40}( |$)"' _ "$workflow"
wf_case "el nivel 1 no aprueba hasta correr el set (producto, 2026-11-10)" grep -Eq '^export const LEVEL1_CAN_APPROVE = false;$' "$root/scripts/reviewer/config.ts"

echo "== required-checks.txt y required-statuses.txt"
if grep -qxF sensitive-paths "$root/scripts/merge-guard/required-statuses.txt" && ! grep -qxF sensitive-paths "$root/scripts/merge-guard/required-checks.txt"; then
  echo "✓ sensitive-paths se exige como status, no como check"; passed=$((passed + 1))
else
  echo "✗ sensitive-paths tiene que ir en required-statuses.txt y no en required-checks.txt"; failed=$((failed + 1))
fi
for required in "typecheck · lint · test · build" "db · migraciones · pgTAP" "e2e · Playwright por rol" "seguridad · dependencias y secretos" "evals · modelo falso"; do
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
