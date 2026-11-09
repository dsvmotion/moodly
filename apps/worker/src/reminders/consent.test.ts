import { describe, expect, it } from "vitest";
import { isOptOut, optOutConfirmation, optOutKey, optedOut } from "./consent.ts";

describe("la baja de los recordatorios contestando (producto, 2026-11-08)", () => {
  it("BAJA o STOP, sin importar mayúsculas, tildes, espacios ni signos", () => {
    for (const message of ["BAJA", "baja", " Baja. ", "STOP", "stop!", "¡STOP!", "Stóp", "bája"]) {
      expect(isOptOut(message), message).toBe(true);
    }
  });

  it("una frase que la nombra no es una baja: la contesta el agente", () => {
    for (const message of ["quiero darme de baja", "baja por favor", "stop it", "no pares", "", "   ", "bajar", "BAJA BAJA", "estoy de baja"]) {
      expect(isOptOut(message), message).toBe(false);
    }
  });

  it("la confirmación, en el idioma del contacto; en inglés si no es español", () => {
    expect(optOutConfirmation("es")).toMatch(/^Hecho: ya no te enviaremos recordatorios/);
    expect(optOutConfirmation("es-ES")).toBe(optOutConfirmation("es"));
    expect(optOutConfirmation("en")).toMatch(/^Done: we won't send you appointment reminders/);
    expect(optOutConfirmation("fr")).toBe(optOutConfirmation("en"));
  });

  it("una confirmación por mensaje del cliente", () => {
    expect(optOutKey("m-1")).toBe("opt-out:m-1");
    expect(optOutKey("m-1")).not.toBe(optOutKey("m-2"));
  });

  it("la baja registrada cuenta solo con su fecha", () => {
    expect(optedOut({ appointment_reminders: { opted_out_at: "2030-06-01T10:00:00Z", via: "reply" } })).toBe(true);
    expect(optedOut({ appointment_reminders: {} })).toBe(false);
  });
});
