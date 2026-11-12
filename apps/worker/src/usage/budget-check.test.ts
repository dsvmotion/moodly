import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLATFORM_MODEL_POLICY } from "@repo/agent-core";
import { describe, expect, it } from "vitest";

// El tope del mes de plataforma (300 €) vive en dos sitios: en el enrutador
// (PLATFORM_MODEL_POLICY, para una organización sin política) y en la base de
// datos (el valor por defecto de org_model_settings.budget_per_month_eur y el
// que usa check_budget_thresholds para avisar). Si uno cambia sin el otro, los
// avisos del 80 % y del 100 % saldrían con otro tope que el que corta el modelo
// (nota de V10 a #262). Este test los ata: el último valor que fija cada
// migración tiene que ser el de PLATFORM_MODEL_POLICY.

const MIGRATIONS = join(import.meta.dirname, "..", "..", "..", "..", "packages", "db", "supabase", "migrations");

function migrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS, name), "utf8") }));
}

/** El último valor que fija una migración para algo (el patrón captura el número). */
function lastValue(pattern: RegExp): { name: string; value: number } | null {
  let found: { name: string; value: number } | null = null;
  for (const { name, sql } of migrations()) {
    for (const match of sql.matchAll(new RegExp(pattern.source, "g"))) found = { name, value: Number(match[1]) };
  }
  return found;
}

describe("el tope del mes de plataforma, el mismo en el enrutador y en la base de datos", () => {
  const platform = PLATFORM_MODEL_POLICY.budget.perMonthEur;

  it("el valor por defecto de org_model_settings.budget_per_month_eur", () => {
    const column = lastValue(/budget_per_month_eur numeric\(\d+, \d+\) not null default (\d+(?:\.\d+)?)/);
    expect(column, "ninguna migración fija el valor por defecto").not.toBeNull();
    expect(column?.value).toBe(platform);
  });

  it("el que usa check_budget_thresholds para una organización sin política", () => {
    const fallback = lastValue(/select s\.budget_per_month_eur from public\.org_model_settings s where s\.organization_id = p_organization_id\),\s*(\d+(?:\.\d+)?)\s*\)/);
    expect(fallback, "check_budget_thresholds ya no tiene el tope de plataforma donde este test lo busca").not.toBeNull();
    expect(fallback?.value).toBe(platform);
  });
});
