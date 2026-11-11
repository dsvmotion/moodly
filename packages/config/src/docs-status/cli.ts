// Uso: pnpm docs:status [--check] [--out <archivo>]
// Sin opciones imprime el resumen por stdout. --check valida docs/scope.yaml.
import { summary, validateScope, writeSummary } from "./check.ts";

const args = process.argv.slice(2);
if (args.includes("--check")) {
  const { ok, messages } = validateScope();
  for (const m of messages) console.error(m);
  if (ok) console.log("docs/scope.yaml es válido.");
  process.exit(ok ? 0 : 1);
}
const out = args.indexOf("--out");
if (out >= 0) {
  const file = args[out + 1];
  if (file === undefined) {
    console.error("--out necesita una ruta");
    process.exit(1);
  }
  writeSummary(file);
  console.log(`Escrito ${file}`);
} else {
  process.stdout.write(summary());
}
