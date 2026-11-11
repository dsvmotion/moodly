import { NoEligibleTransportError, PLATFORM_MODEL_POLICY, createFakeTransport } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { createWorkerModels } from "./model-router.ts";

const call = { organizationId: "org-1", runId: "run-1", task: "converse" as const, messages: [{ role: "user" as const, content: "hola" }], maxOutputTokens: 100 };
const spend = { runEur: 0, dayEur: 0, monthEur: 0 };

describe("vías de modelo del worker", () => {
  it("con la clave del gateway, el enrutador usa el gateway con esa clave", async () => {
    const keys: string[] = [];
    const models = createWorkerModels({ aiGatewayApiKey: "clave-de-prueba-larga" }, (apiKey) => {
      keys.push(apiKey);
      return createFakeTransport({ provider: "vercel-ai-gateway", respond: () => ({ text: "hola", model: "m", tokensIn: 1, tokensOut: 1, costEur: 0 }) });
    });
    expect(keys).toEqual(["clave-de-prueba-larga"]);
    expect(models.transports.map((transport) => transport.provider)).toEqual(["vercel-ai-gateway"]);
    await expect(models.router.generate(call, PLATFORM_MODEL_POLICY, spend)).resolves.toMatchObject({ text: "hola" });
  });

  it("de verdad es el transporte del gateway: gestionado, sin garantía de UE y con los modelos capaces", async () => {
    const models = createWorkerModels({ aiGatewayApiKey: "clave-de-prueba-larga" });
    expect(models.transports).toEqual([
      expect.objectContaining({ provider: "vercel-ai-gateway", via: "gateway", connection: "managed", region: "other", serves: ["fast", "smart"] }),
    ]);
    // Con «Solo UE» no lo usa: falla antes de llamar, sin red.
    await expect(models.router.generate(call, { ...PLATFORM_MODEL_POLICY, residency: "eu" }, spend)).rejects.toThrow(NoEligibleTransportError);
  });

  it("sin clave no llama a ningún modelo: el turno pasará la conversación a una persona", async () => {
    let built = false;
    const models = createWorkerModels({ aiGatewayApiKey: null }, () => {
      built = true;
      throw new Error("no debería crear el transporte");
    });
    expect(built).toBe(false);
    expect(models.transports).toEqual([]);
    await expect(models.router.generate(call, PLATFORM_MODEL_POLICY, spend)).rejects.toThrow(NoEligibleTransportError);
  });
});
