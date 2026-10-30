import { readFileSync } from "node:fs";
import { MODEL_KEYS, MODEL_TASKS } from "@repo/config";
import { describe, expect, it } from "vitest";
import { PLATFORM_MODEL_POLICY } from "./router.js";
import { InvalidModelSettingsError, policyFromSettings } from "./settings.js";

const row = {
  residency: "eu",
  allowed_providers: ["anthropic", "mistral"],
  model_by_task: { converse: "smart" },
  connection: "byok",
  budget_per_run_eur: "0.2500",
  budget_per_day_eur: "10.0000",
};

describe("policyFromSettings", () => {
  it("sin fila, la política de plataforma", () => {
    expect(policyFromSettings(null)).toBe(PLATFORM_MODEL_POLICY);
    expect(policyFromSettings(undefined)).toBe(PLATFORM_MODEL_POLICY);
  });

  it("convierte la fila: residencia, proveedores, conexión y topes (numeric llega como texto)", () => {
    expect(policyFromSettings(row)).toEqual({
      residency: "eu",
      allowedProviders: ["anthropic", "mistral"],
      modelByTask: { classify: "fast", extract: "fast", converse: "smart", reason: "smart", embed: "embedding" },
      connection: "byok",
      budget: { perRunEur: 0.25, perDayEur: 10 },
    });
  });

  it.each([
    ["una residencia desconocida", { residency: "us" }],
    ["un proveedor con mayúsculas", { allowed_providers: ["OpenAI"] }],
    ["una tarea desconocida", { model_by_task: { chat: "fast" } }],
    ["un ID de modelo en vez de una clave lógica", { model_by_task: { converse: "claude-x" } }],
    ["un modo de conexión desconocido", { connection: "shared" }],
    ["un tope a cero", { budget_per_run_eur: "0" }],
  ])("falla con %s en vez de adivinar", (_name, change) => {
    expect(() => policyFromSettings({ ...row, ...change })).toThrow(InvalidModelSettingsError);
  });

  it("las tareas y claves que valida la base de datos son las de @repo/config", () => {
    const sql = readFileSync(
      new URL("../../../db/supabase/migrations/20261030120000_org_model_settings_secrets.sql", import.meta.url),
      "utf8",
    );
    const list = (pattern: RegExp) => [...(sql.match(pattern)?.[1] ?? "").matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(list(/v_task not in \(([^)]*)\)/)).toEqual([...MODEL_TASKS]);
    expect(list(/v_key not in \(([^)]*)\)/)).toEqual([...MODEL_KEYS]);
  });
});
