#!/usr/bin/env bash
# Tests de should-deploy.sh con un `gh` falso. Sin red: bash scripts/deploy/tests/run.sh
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/deploy/should-deploy.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

# `gh api <ruta> --jq …`: devuelve lo que el caso dejó en $FIX (ya filtrado por jq).
#   compare:     $FIX/compare (línea «estado<TAB>commits de más nuevo a más viejo») o $FIX/compare_fail
#   runs del CI: $FIX/green_<sha> con el total_count (si no existe: 0) o $FIX/runs_fail
cat > "$WORK/bin/gh" <<'STUB'
#!/usr/bin/env bash
path="$2"
case "$path" in
  */compare/*)
    [ -e "$FIX/compare_fail" ] && exit 1
    cat "$FIX/compare" ;;
  */actions/workflows/ci.yml/runs*)
    [ -e "$FIX/runs_fail" ] && exit 1
    sha="${path#*head_sha=}"; sha="${sha%%&*}"
    echo "$sha" >> "$FIX/asked"
    if [ -e "$FIX/green_$sha" ]; then cat "$FIX/green_$sha"; else echo 0; fi ;;
  *) echo "gh falso: ruta inesperada $path" >&2; exit 2 ;;
esac
STUB
chmod +x "$WORK/bin/gh"

pass=0; fail=0
# check <nombre> <salida esperada (prefijo)> [setup en $FIX…]
run_case() {
  local name="$1" expected="$2"; shift 2
  FIX="$(mktemp -d "$WORK/fix.XXXX")"; export FIX
  "$@"
  local out
  out="$(PATH="$WORK/bin:$PATH" GH_REPO=o/r MAX_NEWER="${MAX_NEWER:-40}" bash "$SCRIPT" aaa)"
  if [[ "$out" == "$expected"* ]]; then pass=$((pass+1)); echo "✓ $name"; else fail=$((fail+1)); echo "✗ $name: salida «$out», esperaba «$expected…»"; fi
}

identical()      { printf 'identical\t\n' > "$FIX/compare"; }
ahead_none()     { printf 'ahead\tccc bbb\n' > "$FIX/compare"; }
ahead_newest()   { printf 'ahead\tccc bbb\n' > "$FIX/compare"; echo 1 > "$FIX/green_ccc"; }
ahead_middle()   { printf 'ahead\tddd ccc bbb\n' > "$FIX/compare"; echo 1 > "$FIX/green_ccc"; }
ahead_oldest()   { printf 'ahead\tccc bbb\n' > "$FIX/compare"; echo 1 > "$FIX/green_bbb"; }
behind()         { printf 'behind\t\n' > "$FIX/compare"; }
diverged()       { printf 'diverged\tccc\n' > "$FIX/compare"; }
compare_fails()  { touch "$FIX/compare_fail"; }
runs_fail()      { printf 'ahead\tccc bbb\n' > "$FIX/compare"; touch "$FIX/runs_fail"; }
beyond_max()     { printf 'ahead\tc3 c2 c1\n' > "$FIX/compare"; echo 1 > "$FIX/green_c1"; }

run_case "es la cabeza de main: se despliega"                              "true"  identical
run_case "main va por delante y ningún commit nuevo tiene el CI en verde: se despliega" "true" ahead_none
run_case "el commit más nuevo ya tiene el CI en verde: se salta"           "false un commit más nuevo (ccc)" ahead_newest
run_case "uno intermedio ya tiene el CI en verde: se salta"                "false un commit más nuevo (ccc)" ahead_middle
run_case "solo el más viejo de los nuevos está en verde: se salta"         "false un commit más nuevo (bbb)" ahead_oldest
run_case "sha detrás de main sin ser su ancestro (behind): se salta"       "false aaa no está en el historial de main (behind)" behind
run_case "historial divergido: se salta"                                   "false aaa no está en el historial de main (diverged)" diverged
run_case "la comparación falla: se salta (lo seguro)"                      "false no se pudo comparar" compare_fails
run_case "leer el CI falla: se salta (lo seguro)"                          "false no se pudo leer el CI" runs_fail
MAX_NEWER=2 run_case "solo mira los N más nuevos (c1 en verde queda fuera de 2): se despliega" "true" beyond_max

# El más nuevo se pregunta primero y se para en el primero en verde.
FIX="$(mktemp -d "$WORK/fix.XXXX")"; export FIX; ahead_middle
PATH="$WORK/bin:$PATH" GH_REPO=o/r bash "$SCRIPT" aaa >/dev/null
if [ "$(tr '\n' ' ' < "$FIX/asked")" = "ddd ccc " ]; then pass=$((pass+1)); echo "✓ pregunta de más nuevo a más viejo y para en el primero en verde"; else fail=$((fail+1)); echo "✗ orden de las preguntas: $(tr '\n' ' ' < "$FIX/asked")"; fi

echo; echo "Resultado: $pass pasan, $fail fallan"
[ "$fail" -eq 0 ]
