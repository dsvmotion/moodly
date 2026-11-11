#!/usr/bin/env bash
# Mergeo autónomo de un PR propio (AGENTS.md → "Mergeo autónomo"). Sin `gh`
# autenticado, el agente reproduce estos mismos pasos con el conector de
# GitHub. Aborta ante cualquier error o duda; si aborta, no se mergea y se
# avisa a producto.
#
# Uso: scripts/safe-merge.sh <número-de-PR>
#
# a. Espera los checks (gh pr checks --watch) y confirma con la API que todos
#    los de required-checks.txt existen y están en SUCCESS sobre el head
#    commit actual, que no ha cambiado durante la espera, y que los commit
#    statuses de required-statuses.txt (la guarda) están en success.
# b. Compara los archivos del PR con sensitive-paths.txt y busca tests
#    debilitados (merge-guard/check-sensitive.sh, el mismo que usa el CI).
# c. Solo entonces: gh pr merge --squash --delete-branch --match-head-commit.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
guard="$here/merge-guard"

fail() {
  echo "safe-merge: NO SE MERGEA el PR #${pr:-?}: $*" >&2
  exit 1
}
trap 'echo "safe-merge: NO SE MERGEA el PR #${pr:-?}: error inesperado en la línea $LINENO" >&2' ERR

pr="${1:-}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "uso: $0 <número-de-PR>" >&2; exit 2; }

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

pr_field() { jq -r "$1" "$workdir/pr.json"; }
gh pr view "$pr" --json number,state,isDraft,baseRefName,headRefOid > "$workdir/pr.json"
[[ "$(pr_field .state)" == "OPEN" ]] || fail "no está abierto ($(pr_field .state))"
[[ "$(pr_field .isDraft)" == "false" ]] || fail "es un borrador"
[[ "$(pr_field .baseRefName)" == "main" ]] || fail "no apunta a main ($(pr_field .baseRefName))"
sha="$(pr_field .headRefOid)"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "head commit no válido: $sha"
echo "safe-merge: PR #$pr, head $sha"

# --- a. Checks ---------------------------------------------------------------
echo "safe-merge: esperando los checks…"
gh pr checks "$pr" --watch --interval 15 || fail "gh pr checks --watch terminó con error (algún check falló o no hay checks)"

gh pr view "$pr" --json headRefOid > "$workdir/pr-after.json"
[[ "$(jq -r .headRefOid "$workdir/pr-after.json")" == "$sha" ]] || fail "el head commit cambió durante la espera"

repo="$(gh repo view --json nameWithOwner | jq -r .nameWithOwner)"
gh api "repos/$repo/commits/$sha/check-runs?per_page=100" > "$workdir/check-runs.json"

while IFS= read -r check || [[ -n "$check" ]]; do
  [[ -z "$check" || "$check" == \#* ]] && continue
  # La ejecución más reciente de ese check sobre este commit exacto.
  result="$(jq -r --arg name "$check" --arg sha "$sha" '
    [.check_runs[] | select(.name == $name and .head_sha == $sha)]
    | sort_by(.id) | last
    | if . == null then "AUSENTE" else "\(.status)/\(.conclusion // "sin conclusión")" end
  ' "$workdir/check-runs.json")"
  [[ "$result" == "completed/success" ]] || fail "check \"$check\": $result"
  echo "safe-merge: ✓ $check"
done < "$guard/required-checks.txt"

# Los commit statuses (la guarda, que corre desde main y publica en el head del
# PR). La API los devuelve del más reciente al más antiguo; manda el de id mayor.
gh api "repos/$repo/commits/$sha/statuses?per_page=100" > "$workdir/statuses.json"
while IFS= read -r context || [[ -n "$context" ]]; do
  [[ -z "$context" || "$context" == \#* ]] && continue
  result="$(jq -r --arg c "$context" '
    [.[] | select(.context == $c)] | sort_by(.id) | last
    | if . == null then "AUSENTE" else .state end
  ' "$workdir/statuses.json")"
  [[ "$result" == "success" ]] || fail "status \"$context\": $result"
  echo "safe-merge: ✓ $context (status)"
done < "$guard/required-statuses.txt"

# --- b. Zonas sensibles y tests debilitados ----------------------------------
gh pr diff "$pr" --name-only > "$workdir/files.txt"
[[ -s "$workdir/files.txt" ]] || fail "el PR no tiene archivos"
gh pr diff "$pr" > "$workdir/diff.patch"
if ! "$guard/check-sensitive.sh" "$workdir/files.txt" "$workdir/diff.patch"; then
  fail "toca zonas sensibles o debilita tests (ver arriba): necesita revisión humana"
fi
echo "safe-merge: ✓ sin zonas sensibles ni tests debilitados ($(wc -l < "$workdir/files.txt" | tr -d ' ') archivos)"

# --- c. Merge fijando el commit revisado --------------------------------------
gh pr merge "$pr" --squash --delete-branch --match-head-commit "$sha"
echo "safe-merge: PR #$pr mergeado ($sha)"
