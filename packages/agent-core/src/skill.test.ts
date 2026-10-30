import { readFileSync } from "node:fs";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, EFFECT_CLASSES, EFFECT_CLASS_CEILING, autonomyRank, minAutonomy } from "./effects.js";
import { SkillDefinitionError, defineSkill, inputSchemaProblems, isReservedKey, reservedPaths } from "./skill.js";
import type { SkillDefinition } from "./skill.js";

function skill(overrides: Partial<SkillDefinition<unknown>> = {}): SkillDefinition<unknown> {
  return {
    key: "create_task",
    version: 1,
    description: "Crea una tarea",
    effectClass: "internal_write",
    defaultAutonomy: "execute",
    input: z.object({ title: z.string() }),
    output: z.object({ id: z.string() }),
    preview: () => Promise.resolve({ summary: "Crear una tarea" }),
    execute: () => Promise.resolve({ id: "t1" }),
    ...overrides,
  };
}

describe("clases de efecto y autonomía", () => {
  it("son las mismas que el catálogo de la base de datos", () => {
    const sql = readFileSync(new URL("../../db/supabase/migrations/20261023150000_agent_catalog.sql", import.meta.url), "utf8");
    const ranks = [...sql.matchAll(/when '([a-z_]+)' then (\d)\b/g)].map(([, level, rank]) => [level, Number(rank)]);
    expect(Object.fromEntries(ranks)).toEqual(Object.fromEntries(AUTONOMY_LEVELS.map((level) => [level, autonomyRank(level)])));
    const ceilings = [...sql.matchAll(/when '([a-z_]+)' then '([a-z]+)'/g)].map(([, cls, ceiling]) => [cls, ceiling]);
    expect(Object.fromEntries(ceilings)).toEqual(EFFECT_CLASS_CEILING);
    expect(Object.keys(EFFECT_CLASS_CEILING)).toEqual([...EFFECT_CLASSES]);
  });

  it("la autonomía efectiva es la más baja", () => {
    expect(minAutonomy("autonomous", "draft", "execute")).toBe("draft");
    expect(minAutonomy("execute")).toBe("execute");
  });
});

describe("campos reservados", () => {
  it.each(["organization_id", "organizationId", "Organization-ID", "location_id", "contactId", "to", "BCC", "phoneNumber", "e_mail", "channel_address"])(
    "%s es del runtime",
    (key) => expect(isReservedKey(key)).toBe(true),
  );

  it.each(["title", "start_at", "address", "notes", "amount", "service_id"])("%s no lo es", (key) => {
    expect(isReservedKey(key)).toBe(false);
  });

  it("los encuentra a cualquier profundidad en los argumentos crudos", () => {
    expect(reservedPaths({ title: "x", items: [{ note: "a" }, { meta: { To: "+34600000000" } }] })).toEqual(["$.items[1].meta.To"]);
    expect(reservedPaths("texto")).toEqual([]);
  });
});

describe("inputSchemaProblems", () => {
  it("acepta un esquema cerrado sin campos reservados", () => {
    expect(inputSchemaProblems(z.object({ title: z.string(), tags: z.array(z.enum(["a", "b"])).optional() }))).toEqual([]);
  });

  it.each([
    ["anidado en un objeto", z.object({ booking: z.object({ contact_id: z.string() }) }), "$.booking.contact_id"],
    ["dentro de un array", z.object({ lines: z.array(z.object({ email: z.string() })) }), "$.lines[].email"],
    ["tras optional y default", z.object({ meta: z.object({ to: z.string() }).optional().default({ to: "" }) }), "$.meta.to"],
    ["en una unión", z.object({ x: z.union([z.object({ phone: z.string() }), z.null()]) }), "$.x.phone"],
  ])("rechaza un campo reservado %s", (_name, schema, path) => {
    expect(inputSchemaProblems(schema).join("\n")).toContain(path);
  });

  it.each([
    ["z.record", z.object({ extra: z.record(z.string(), z.string()) })],
    ["z.any", z.object({ extra: z.any() })],
    ["z.unknown", z.object({ extra: z.unknown() })],
    ["un objeto que deja pasar claves", z.looseObject({ title: z.string() })],
    ["un objeto con catchall", z.object({ title: z.string() }).catchall(z.string())],
  ])("rechaza claves abiertas con %s", (_name, schema) => {
    expect(inputSchemaProblems(schema)).not.toEqual([]);
  });

  it("acepta un objeto estricto", () => {
    expect(inputSchemaProblems(z.strictObject({ title: z.string() }))).toEqual([]);
  });
});

describe("defineSkill", () => {
  it("devuelve la skill si cumple el contrato", () => {
    const definition = skill();
    expect(defineSkill(definition)).toBe(definition);
  });

  it.each([
    ["una clave con mayúsculas", { key: "CreateTask" }, "clave"],
    ["la versión 0", { version: 0 }, "versión"],
    ["una autonomía por encima del techo", { effectClass: "financial", defaultAutonomy: "execute" }, "techo"],
    ["outreach sin audiencia", { effectClass: "external_outreach", defaultAutonomy: "execute" }, "audience"],
    ["audiencia fuera de outreach", { audience: () => Promise.resolve([]) }, "audience"],
    ["un destinatario en la entrada", { input: z.object({ body: z.string(), to: z.string() }) }, "campo reservado"],
    ["el tenant en la entrada", { input: z.object({ organizationId: z.string() }) }, "campo reservado"],
    ["claves abiertas en la entrada", { input: z.object({ data: z.record(z.string(), z.string()) }) }, "claves abiertas"],
  ] as const)("rechaza %s", (_name, overrides, message) => {
    expect(() => defineSkill(skill(overrides as Partial<SkillDefinition<unknown>>))).toThrow(SkillDefinitionError);
    expect(() => defineSkill(skill(overrides as Partial<SkillDefinition<unknown>>))).toThrow(message);
  });

  it("acepta outreach con audiencia y lo financiero en draft", () => {
    expect(() => defineSkill(skill({ effectClass: "external_outreach", defaultAutonomy: "execute", audience: () => Promise.resolve([]) }))).not.toThrow();
    expect(() => defineSkill(skill({ effectClass: "financial", defaultAutonomy: "draft" }))).not.toThrow();
  });
});
