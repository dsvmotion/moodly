import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR 0054: el relé de la bandeja en vivo (/app/inbox/events) pasa casi todo el
// tiempo esperando. Con Fluid compute las conexiones comparten instancia y se
// cobra la CPU activa; sin él, cada conexión abierta es una instancia entera
// (V9: ~7–15 $/mes frente a ~146 $/mes en el piloto). Se fija aquí, en el
// vercel.json del proyecto de la web (Root Directory apps/web), para que no
// dependa del panel de Vercel.
describe("apps/web/vercel.json", () => {
  it("fija Fluid compute", () => {
    const config = JSON.parse(readFileSync(join(import.meta.dirname, "..", "vercel.json"), "utf8")) as { fluid?: unknown };
    expect(config.fluid).toBe(true);
  });
});
