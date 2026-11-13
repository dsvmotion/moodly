import { describe, expect, it } from "vitest";
import { detectLanguage, handOffTextForConversation } from "./language.js";
import { HAND_OFF_TEXTS } from "./turn.js";

describe("el idioma de un texto", () => {
  it.each([
    ["¿Tenéis hueco el lunes para láser?", "es"],
    ["Hi, do you have a slot available on Monday?", "en"],
    ["Bonjour, avez-vous un créneau lundi ?", "fr"],
    ["Hallo, haben Sie am Montag einen Termin frei?", "de"],
    ["ok", null],
    ["", null],
  ])("«%s» → %s", (text, language) => {
    expect(detectLanguage(text)).toBe(language);
  });
});

describe("el texto fijo del paso a una persona (CU3)", () => {
  it("va en el idioma del último mensaje del cliente, no en el de los anteriores ni en el del agente", () => {
    const history = [
      { author: "contact" as const, content: "Hola, quería una cita para el lunes." },
      { author: "agent" as const, content: "Claro, ¿a qué hora?" },
      { author: "contact" as const, content: "Actually, can I talk to a person from your team?" },
    ];
    expect(handOffTextForConversation(history, HAND_OFF_TEXTS.es)).toBe(HAND_OFF_TEXTS.en);
  });

  it("sin texto en ese idioma, sin idioma claro o sin mensajes del cliente, el de la organización", () => {
    expect(handOffTextForConversation([{ author: "contact", content: "Je voudrais parler à une personne." }], HAND_OFF_TEXTS.es)).toBe(HAND_OFF_TEXTS.es);
    expect(handOffTextForConversation([{ author: "contact", content: "ok" }], HAND_OFF_TEXTS.en)).toBe(HAND_OFF_TEXTS.en);
    expect(handOffTextForConversation([], HAND_OFF_TEXTS.es)).toBe(HAND_OFF_TEXTS.es);
  });
});
