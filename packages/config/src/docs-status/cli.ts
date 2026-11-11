// Uso: pnpm docs:status [--check]
import { checkStatus, writeStatus } from "./check.ts";

if (process.argv.includes("--check")) {
  const { ok, messages } = checkStatus();
  for (const m of messages) console.error(m);
  if (ok) console.log("docs/STATUS.generated.md está al día con docs/scope.yaml.");
  process.exit(ok ? 0 : 1);
} else {
  console.log(`Escrito ${writeStatus()}`);
}
