import { describe, expect, it } from "vitest";
import { rewindStartStep } from "./ingest.ts";

// Desde dónde se rebobina un workflow de la entrada en ERROR (revisión de V10 de #254).
describe("rewindStartStep", () => {
  const ok = (functionID: number) => ({ functionID, error: null });
  const failed = (functionID: number) => ({ functionID, error: new Error("x") });

  it("desde el último paso si falló, aunque haya fallos anteriores ya recogidos (intentos 1 y 2)", () => {
    // load, attempt-1:test (falló, recogido), attempt-1:failed, attempt-2:test (falló), attempt-2:failed,
    // attempt-3:test (falló), attempt-3:failed (falló: tiró el workflow).
    const steps = [ok(0), failed(1), ok(2), failed(3), ok(4), failed(5), failed(6)];
    expect(rewindStartStep(steps)).toBe(6);
  });

  it("si el último paso salió bien (el workflow falló entre pasos), desde el siguiente", () => {
    expect(rewindStartStep([ok(0), failed(1), ok(2)])).toBe(3);
  });

  it("sin pasos, desde el principio; y no depende del orden en que lleguen", () => {
    expect(rewindStartStep([])).toBe(0);
    expect(rewindStartStep([failed(4), ok(0), failed(2)])).toBe(4);
  });
});
