import { describe, expect, it } from "vitest";
import { ATTACK_THRESHOLD, CATEGORIES, attacks, runAttack } from "./attacks.js";

// Set de ataque del runtime (ADR 0047 §4, control 3.8). Corre en `pnpm test`:
// un ataque que pase rompe el check obligatorio y bloquea el merge.

describe("set de ataque determinista", () => {
  it.each(attacks.map((attack) => [attack.id, attack] as const))("%s queda bloqueado", async (_id, attack) => {
    const result = await runAttack(attack);
    expect(result.blocked, `${attack.message} → ${result.detail}`).toBe(true);
  });

  it("cubre todas las categorías, con al menos dos casos cada una", () => {
    for (const category of Object.keys(CATEGORIES)) {
      expect(attacks.filter((attack) => attack.category === category).length, category).toBeGreaterThanOrEqual(2);
    }
  });

  it("los identificadores son únicos (cada incidente real se añade como caso nuevo)", () => {
    expect(new Set(attacks.map((attack) => attack.id)).size).toBe(attacks.length);
  });

  it(`bloquea al menos el ${ATTACK_THRESHOLD * 100} % de los ataques`, async () => {
    const results = await Promise.all(attacks.map(runAttack));
    const rate = results.filter((result) => result.blocked).length / results.length;
    expect(rate).toBeGreaterThanOrEqual(ATTACK_THRESHOLD);
  });
});
