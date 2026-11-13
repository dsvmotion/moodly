import { describe, expect, it } from "vitest";
import { asksToQualify } from "./checks.js";
import { conversationCases } from "./cases.js";
import { runCase, scriptedTransport } from "./runner.js";
import type { Outcome } from "./checks.js";

// «Cualifica con una pregunta» (inmobiliaria-cualifica). Con el modelo real, el
// agente cualifica con una pregunta que abre una lista («¿me dices?:» y lo que
// pide detrás), y la comprobación antigua solo aceptaba la palabra clave antes
// del «?» (main 59fbd29: 2/5). Las dos formas valen; sin pregunta, o con una
// pregunta que no pide nada, no.

const KEYWORDS = ["presupuesto", "habitaciones", "cuándo", "fecha", "entrar", "mudarte", "mudanza", "personas", "mascotas"];
const check = asksToQualify(KEYWORDS);
const verify = (reply: string | null) => check.verify({ reply } as Outcome);

describe("asksToQualify", () => {
  it.each([
    ["la palabra antes del «?»", "Tenemos dos pisos. ¿Cuántas habitaciones necesitas y cuál es tu presupuesto?"],
    ["«¿me dices?:» y la lista detrás", "Tenemos dos pisos disponibles. Para ayudarte mejor, ¿me dices?: tu presupuesto máximo, cuántas habitaciones buscas y cuándo quieres entrar."],
    ["«¿me puede decir?:» con la lista en líneas", "Para enseñarle lo que encaje, ¿me puede decir?:\n- Presupuesto mensual\n- Número de habitaciones\n- Fecha de entrada"],
    ["la lista numerada en la línea siguiente", "¿Te importa contarme un poco más?\n1. ¿Para cuántas personas?\n2. ¿Tienes mascotas?"],
  ])("%s: cualifica", (_label, reply) => {
    expect(verify(reply)).toBeNull();
  });

  it.each([
    ["sin pregunta", "Tenemos un piso de 3 habitaciones en Alonso Cano por 1.250 € al mes. El presupuesto mínimo es ese."],
    ["la palabra detrás de una pregunta que no la pide", "¿Quieres verlo? El presupuesto es de 1.250 € y tiene 3 habitaciones."],
    ["una pregunta que no pide nada para cualificar", "Tenemos dos pisos en Chamberí. ¿Te ayudo en algo más?"],
    ["la lista sin pregunta", "Para ayudarte necesito:\n- Presupuesto\n- Habitaciones"],
  ])("%s: no cualifica", (_label, reply) => {
    expect(verify(reply)).toMatch(/^no cualifica con una pregunta/u);
  });

  it("sin respuesta, no contestó", () => {
    expect(verify(null)).toBe("no contestó");
  });
});

describe("inmobiliaria-cualifica con las dos formas", () => {
  const testCase = conversationCases.find((c) => c.id === "inmobiliaria-cualifica");
  if (!testCase) throw new Error("no existe inmobiliaria-cualifica");
  const offer = "Ahora tenemos un piso de 3 habitaciones en Alonso Cano (1.250 € al mes) y un ático de 2 en Ríos Rosas (1.600 €).";
  const withReply = (say: string) => runCase(testCase, scriptedTransport([{ call: [{ name: "search_knowledge", args: { query: "piso alquiler Chamberí" } }] }, { say }]));

  it.each([
    `${offer} ¿Cuántas habitaciones necesitas y cuál es tu presupuesto?`,
    `${offer} Para ayudarte mejor, ¿me dices?: tu presupuesto máximo y cuándo quieres entrar.`,
  ])("pasa: %s", async (say) => {
    expect((await withReply(say)).failures).toEqual([]);
  });

  it("sin pregunta, falla", async () => {
    const run = await withReply(`${offer} Una comercial te llamará.`);
    expect(run.failures.map((f) => f.check)).toContain("la respuesta cualifica con una pregunta");
  });
});
