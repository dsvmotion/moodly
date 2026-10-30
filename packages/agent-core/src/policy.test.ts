import { z } from "zod";
import { describe, expect, it } from "vitest";
import { decide, denyAllConsent, executionHash } from "./policy.js";
import type { ConsentChecker, DecideInput, RunScope, SkillSettings } from "./policy.js";
import { defineSkill } from "./skill.js";
import type { SkillDefinition } from "./skill.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const scope: RunScope = {
  organizationId: ORG,
  locationId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
  conversation: { id: "conv-1", contactId: "contact-1" },
};

const noop = { preview: () => Promise.resolve({ summary: "…" }), execute: () => Promise.resolve({}) };

const createTask = defineSkill({
  key: "create_task",
  version: 1,
  description: "Crea una tarea",
  effectClass: "internal_write",
  defaultAutonomy: "execute",
  input: z.object({ title: z.string().min(1) }),
  output: z.object({}),
  ...noop,
});

const reply = defineSkill({
  key: "reply",
  version: 1,
  description: "Responde al cliente",
  effectClass: "external_message",
  defaultAutonomy: "autonomous",
  input: z.object({ text: z.string() }),
  output: z.object({}),
  ...noop,
});

const discount = defineSkill({
  key: "apply_discount",
  version: 2,
  description: "Aplica un descuento",
  effectClass: "financial",
  defaultAutonomy: "draft",
  input: z.object({ percent: z.number().int().min(1).max(100) }),
  output: z.object({}),
  ...noop,
});

const bookingCancel = defineSkill({
  key: "cancel_booking",
  version: 1,
  description: "Cancela una cita",
  effectClass: "internal_write",
  defaultAutonomy: "execute",
  input: z.object({ booking_ref: z.string(), late: z.boolean() }),
  output: z.object({}),
  requiresApproval: (input) => (input.late ? "cancelación con menos de 24 h" : null),
  ...noop,
});

const winBack = defineSkill({
  key: "win_back",
  version: 1,
  description: "Reactiva clientes inactivos",
  effectClass: "external_outreach",
  defaultAutonomy: "execute",
  input: z.object({ segment: z.enum(["inactive_90d"]), text: z.string() }),
  output: z.object({}),
  audience: () => Promise.resolve(["c3", "c1", "c2", "c1"]),
  ...noop,
});

const skills = new Map<string, SkillDefinition<unknown>>(
  [createTask, reply, discount, bookingCancel, winBack].map((s) => [s.key, s as SkillDefinition<unknown>]),
);

function settingsFor(overrides: Record<string, Partial<SkillSettings>> = {}): Map<string, SkillSettings> {
  return new Map(
    [...skills.values()].map((s) => [s.key, { enabled: true, autonomy: "autonomous", ...overrides[s.key] } satisfies SkillSettings]),
  );
}

function run(skillKey: string, args: unknown, extra: Partial<DecideInput> = {}) {
  return decide({ proposal: { skillKey, args }, scope, skills, settings: settingsFor(), ...extra });
}

describe("decide: rechazos", () => {
  it("una skill que no se ofreció al LLM", async () => {
    expect(await run("delete_everything", {})).toEqual({ outcome: "reject", reason: "unknown_skill" });
  });

  it("una skill desactivada para este agente", async () => {
    const decision = await run("create_task", { title: "x" }, { settings: settingsFor({ create_task: { enabled: false } }) });
    expect(decision).toEqual({ outcome: "reject", reason: "skill_disabled" });
  });

  it("el tenant, el local o un destinatario en los argumentos, aunque el esquema los descartaría", async () => {
    for (const args of [
      { title: "x", organization_id: "otra-org" },
      { title: "x", locationId: "otro-local" },
      { text: "hola", to: "+34600000000" },
      { title: "x", nested: { Contact_ID: "otro" } },
    ]) {
      const decision = await run("title" in args ? "create_task" : "reply", args);
      expect(decision).toMatchObject({ outcome: "reject", reason: "reserved_field" });
    }
  });

  it("argumentos que no cumplen el esquema", async () => {
    expect(await run("apply_discount", { percent: 150 })).toMatchObject({ outcome: "reject", reason: "invalid_input" });
    expect(await run("create_task", "texto suelto")).toMatchObject({ outcome: "reject", reason: "invalid_input" });
  });

  it("responder sin una conversación en curso", async () => {
    const decision = await decide({ proposal: { skillKey: "reply", args: { text: "hola" } }, scope: { ...scope, conversation: null }, skills, settings: settingsFor() });
    expect(decision).toEqual({ outcome: "reject", reason: "no_conversation" });
  });

  it("outreach sin comprobador de consentimientos: no contacta a nadie", async () => {
    expect(await run("win_back", { segment: "inactive_90d", text: "¡Vuelve!" })).toEqual({ outcome: "reject", reason: "no_recipients" });
  });
});

describe("decide: destino", () => {
  it("una respuesta va siempre al contacto de la conversación", async () => {
    const decision = await run("reply", { text: "hola" });
    expect(decision).toMatchObject({ outcome: "execute", target: { kind: "conversation", conversationId: "conv-1", contactId: "contact-1" } });
  });

  it("outreach: solo la audiencia de la skill que además consintió, sin duplicados y ordenada", async () => {
    const consent: ConsentChecker = { allowed: () => Promise.resolve(["c2", "c1", "intruso"]) };
    const decision = await run("win_back", { segment: "inactive_90d", text: "¡Vuelve!" }, { consent });
    // «intruso» no estaba en la audiencia: el comprobador no puede añadir a nadie.
    expect(decision).toMatchObject({ outcome: "execute", target: { kind: "audience", contactIds: ["c1", "c2"] } });
  });

  it("lo interno no tiene destino", async () => {
    expect(await run("create_task", { title: "Llamar al proveedor" })).toMatchObject({ target: { kind: "none" } });
  });

  it("denyAllConsent no deja pasar a nadie", async () => {
    expect(await denyAllConsent.allowed({ organizationId: ORG, contactIds: ["a"], skillKey: "x" })).toEqual([]);
  });
});

describe("decide: autonomía", () => {
  it("ejecuta con autonomía suficiente", async () => {
    expect(await run("create_task", { title: "x" })).toMatchObject({ outcome: "execute", autonomy: "autonomous" });
  });

  it("lo financiero nunca pasa de draft aunque la configuración diga autonomous", async () => {
    expect(await run("apply_discount", { percent: 10 })).toMatchObject({ outcome: "draft", autonomy: "draft" });
  });

  it("outreach topa en execute", async () => {
    const consent: ConsentChecker = { allowed: ({ contactIds }) => Promise.resolve(contactIds) };
    expect(await run("win_back", { segment: "inactive_90d", text: "x" }, { consent })).toMatchObject({ autonomy: "execute" });
  });

  it("respeta la autonomía configurada si es menor", async () => {
    const decision = await run("create_task", { title: "x" }, { settings: settingsFor({ create_task: { autonomy: "suggest" } }) });
    expect(decision).toMatchObject({ outcome: "suggest" });
  });

  it("con la integración rota baja a suggest", async () => {
    const decision = await run("create_task", { title: "x" }, { settings: settingsFor({ create_task: { integrationHealthy: false } }) });
    expect(decision).toMatchObject({ outcome: "suggest", autonomy: "suggest" });
  });

  it("una regla de negocio pide aprobación aunque se pudiera ejecutar", async () => {
    expect(await run("cancel_booking", { booking_ref: "b1", late: true })).toMatchObject({
      outcome: "needs_approval",
      approvalReason: "cancelación con menos de 24 h",
    });
    expect(await run("cancel_booking", { booking_ref: "b1", late: false })).toMatchObject({ outcome: "execute" });
  });
});

describe("decide: hash de lo que se ejecuta", () => {
  it("es el executionHash del contenido validado, con el destino del runtime", async () => {
    const decision = await run("apply_discount", { percent: 10 });
    expect(decision.outcome).toBe("draft");
    if (decision.outcome === "reject") return;
    expect(decision.inputHash).toBe(
      executionHash({
        organizationId: scope.organizationId,
        locationId: scope.locationId,
        runId: scope.runId,
        skillKey: "apply_discount",
        skillVersion: 2,
        input: { percent: 10 },
        target: { kind: "none" },
      }),
    );
  });

  it("cambia con cualquier dato: la entrada, el run, el local o la versión de la skill", async () => {
    const base = {
      organizationId: ORG,
      locationId: scope.locationId,
      runId: scope.runId,
      skillKey: "apply_discount",
      skillVersion: 2,
      input: { percent: 10 },
      target: { kind: "none" } as const,
    };
    const hash = executionHash(base);
    expect(executionHash({ ...base, input: { percent: 11 } })).not.toBe(hash);
    expect(executionHash({ ...base, runId: "otro" })).not.toBe(hash);
    expect(executionHash({ ...base, locationId: null })).not.toBe(hash);
    expect(executionHash({ ...base, skillVersion: 3 })).not.toBe(hash);
    expect(executionHash({ ...base, target: { kind: "conversation", conversationId: "c", contactId: "x" } })).not.toBe(hash);
  });

  it("incluye el destino que pone el runtime: la misma respuesta a otro contacto es otro hash", async () => {
    const toFirst = await run("reply", { text: "Su cita es mañana" });
    const toOther = await decide({
      proposal: { skillKey: "reply", args: { text: "Su cita es mañana" } },
      scope: { ...scope, conversation: { id: "conv-2", contactId: "contact-2" } },
      skills,
      settings: settingsFor(),
    });
    if (toFirst.outcome === "reject" || toOther.outcome === "reject") throw new Error("no debía rechazar");
    expect(toFirst.inputHash).not.toBe(toOther.inputHash);
    expect(toFirst.inputHash).toBe(
      executionHash({
        organizationId: scope.organizationId,
        locationId: scope.locationId,
        runId: scope.runId,
        skillKey: "reply",
        skillVersion: 1,
        input: { text: "Su cita es mañana" },
        target: { kind: "conversation", conversationId: "conv-1", contactId: "contact-1" },
      }),
    );
  });

  it("no depende del orden en que el LLM escribió los argumentos", async () => {
    const a = await run("cancel_booking", { booking_ref: "b1", late: true });
    const b = await run("cancel_booking", { late: true, booking_ref: "b1" });
    if (a.outcome === "reject" || b.outcome === "reject") throw new Error("no debía rechazar");
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("el hash se calcula sobre la entrada validada, no sobre lo que escribió el LLM", async () => {
    // z.object descarta las claves que no declara: lo descartado no entra en el hash.
    const a = await run("create_task", { title: "x" });
    const b = await run("create_task", { title: "x", relleno: "ignorado" });
    if (a.outcome === "reject" || b.outcome === "reject") throw new Error("no debía rechazar");
    expect(b.input).toEqual({ title: "x" });
    expect(a.inputHash).toBe(b.inputHash);
  });
});
