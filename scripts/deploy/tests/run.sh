#!/usr/bin/env bash
# Tests de should-deploy.sh con un `gh` falso. Sin red: bash scripts/deploy/tests/run.sh
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/deploy/should-deploy.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

# `gh api [--paginate] <ruta> --jq …`: devuelve lo que el caso dejó en $FIX (ya filtrado por jq).
#   compare (per_page=1):   $FIX/info («estado<TAB>total») o $FIX/info_fail
#   compare (per_page=100): $FIX/commits (del más viejo al más nuevo) o $FIX/list_fail
#   runs del CI:            $FIX/green_<sha> con el total_count (si no existe: 0) o $FIX/runs_fail
cat > "$WORK/bin/gh" <<'STUB'
#!/usr/bin/env bash
path=""
for a in "$@"; do case "$a" in api|--paginate|--jq) ;; repos/*) path="$a" ;; esac; done
case "$path" in
  */compare/*per_page=1)
    [ -e "$FIX/info_fail" ] && exit 1
    cat "$FIX/info" ;;
  */compare/*per_page=100)
    [ -e "$FIX/list_fail" ] && exit 1
    echo "list" >> "$FIX/listed"
    cat "$FIX/commits" ;;
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
# run_case <nombre> <salida esperada (prefijo)> <función que prepara $FIX>   (SHA, MAX_NEWER opcionales)
run_case() {
  local name="$1" expected="$2"; shift 2
  FIX="$(mktemp -d "$WORK/fix.XXXX")"; export FIX
  "$@"
  local out
  out="$(PATH="$WORK/bin:$PATH" GH_REPO=o/r MAX_NEWER="${MAX_NEWER:-100}" bash "$SCRIPT" "${SHA:-aaa}")"
  if [[ "$out" == "$expected"* ]]; then pass=$((pass+1)); echo "✓ $name"; else fail=$((fail+1)); echo "✗ $name: salida «$out», esperaba «$expected…»"; fi
}
# main: aaa ← bbb ← ccc ← ddd (la cabeza). La API da los commits del más viejo al más nuevo.
ahead()          { printf 'ahead\t3\n' > "$FIX/info"; printf 'bbb\nccc\nddd\n' > "$FIX/commits"; }
identical()      { printf 'identical\t0\n' > "$FIX/info"; }
none_green()     { ahead; }
newest_green()   { ahead; echo 1 > "$FIX/green_ddd"; }
middle_green()   { ahead; echo 1 > "$FIX/green_ccc"; }
oldest_green()   { ahead; echo 1 > "$FIX/green_bbb"; }
several_green()  { ahead; echo 1 > "$FIX/green_bbb"; echo 1 > "$FIX/green_ccc"; }
behind()         { printf 'behind\t0\n' > "$FIX/info"; }
diverged()       { printf 'diverged\t2\n' > "$FIX/info"; }
info_fails()     { touch "$FIX/info_fail"; }
list_fails()     { ahead; touch "$FIX/list_fail"; }
runs_fail()      { ahead; touch "$FIX/runs_fail"; }
many_newer()     { printf 'ahead\t4\n' > "$FIX/info"; printf 'b\nc\nd\ne\n' > "$FIX/commits"; echo 1 > "$FIX/green_b"; }

run_case "es la cabeza de main: despliega el suyo"                                   "deploy aaa" identical
run_case "main va por delante y ninguno nuevo tiene el CI en verde: despliega el suyo" "deploy aaa" none_green
run_case "el más nuevo está en verde: despliega ese, no se salta"                    "deploy ddd" newest_green
run_case "uno intermedio está en verde: despliega ese"                               "deploy ccc" middle_green
run_case "solo el más viejo de los nuevos está en verde: despliega ese"              "deploy bbb" oldest_green
run_case "varios en verde: despliega el más nuevo de ellos"                          "deploy ccc" several_green
run_case "sha detrás de main sin ser su ancestro (behind): se salta"                 "skip aaa no está en el historial de main (behind)" behind
run_case "historial divergido: se salta"                                             "skip aaa no está en el historial de main (diverged)" diverged
run_case "la comparación falla: se salta (lo seguro)"                                "skip no se pudo comparar" info_fails
run_case "la lista de commits falla: se salta"                                       "skip no se pudo leer la lista" list_fails
run_case "leer el CI falla: se salta (lo seguro)"                                    "skip no se pudo leer el CI" runs_fail
# Pasado el límite no se despliega el suyo a ciegas (podría ir hacia atrás): se salta.
MAX_NEWER=3 run_case "más commits nuevos que el límite (4 > 3): se salta, no hacia atrás"   "skip hay 4 commits nuevos en main (más de 3)" many_newer
MAX_NEWER=4 run_case "justo en el límite (4 = 4): se mira todo y despliega el más nuevo en verde" "deploy b" many_newer

# Monotonía: tres corridas de commits distintos (aaa antes que bbb antes que ccc) con ccc en verde
# resuelven a ccc las tres (y una cuya cabeza es ccc, también): staging nunca retrocede.
mono() { printf 'ahead\t2\n' > "$FIX/info"; printf 'bbb\nccc\n' > "$FIX/commits"; echo 1 > "$FIX/green_ccc"; }
SHA=aaa run_case "monotonía: la corrida de aaa despliega ccc"                        "deploy ccc" mono
SHA=bbb run_case "monotonía: la corrida de bbb despliega ccc"                        "deploy ccc" mono
mono_head() { printf 'identical\t0\n' > "$FIX/info"; }
SHA=ccc run_case "monotonía: la corrida de ccc (cabeza) despliega ccc"               "deploy ccc" mono_head

# Se miran del más nuevo al más viejo y se para en el primero en verde.
FIX="$(mktemp -d "$WORK/fix.XXXX")"; export FIX; middle_green
PATH="$WORK/bin:$PATH" GH_REPO=o/r bash "$SCRIPT" aaa >/dev/null
if [ "$(tr '\n' ' ' < "$FIX/asked")" = "ddd ccc " ]; then pass=$((pass+1)); echo "✓ pregunta de más nuevo a más viejo y para en el primero en verde"; else fail=$((fail+1)); echo "✗ orden de las preguntas: $(tr '\n' ' ' < "$FIX/asked")"; fi

echo; echo "Resultado: $pass pasan, $fail fallan"
[ "$fail" -eq 0 ]
