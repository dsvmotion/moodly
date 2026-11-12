import { describe, expect, it } from "vitest";
import { parse, select } from "./cli.js";
import { conversationCases, receptionCases } from "./cases.js";
import { scriptedTransport } from "./runner.js";
import { comparisonTable, isMultiTurn, runSet, summarize } from "./runset.js";

// La comparación de modelos (B-01) con el modelo falso: «bueno» es el guion de
// cada caso; «malo», un modelo que contesta lo mismo a todo y da las citas por
// hechas. Lo que se mide con el modelo real sale igual que aquí.

const quiet = () => undefined;

describe("elegir los casos", () => {
  it("--turns multi: los 13 de varios turnos de Recepción; single, el resto (también los de los sectores)", () => {
    const multi = select(parse(["--agent", "reception", "--turns", "multi"]));
    expect(multi).toHaveLength(13);
    expect(multi.every(isMultiTurn)).toBe(true);
    expect(multi.map((c) => c.id)).toEqual(expect.arrayContaining(["recepcion-cambia-de-idea", "recepcion-turnos-la-segunda", "recepcion-turnos-medico-tras-reservar"]));
    const single = select(parse(["--agent", "reception", "--turns", "single"]));
    expect(single.length + multi.length).toBe(conversationCases.filter((c) => c.agent === "reception").length);
    expect(single.some(isMultiTurn)).toBe(false);
  });

  it("--compare: claves de modelo para conversar, sin repetir y sin --model", () => {
    expect(parse(["--compare", "fast,smart"]).compare).toEqual(["fast", "smart"]);
    // Enrutado por intención (PL-T3): apagado salvo --intent-routing; vale también con --compare.
    expect(parse([]).intentRouting).toBe(false);
    expect(parse(["--intent-routing", "--compare", "fast,smart"])).toMatchObject({ intentRouting: true, compare: ["fast", "smart"] });
    expect(() => parse(["--compare", "fast,embedding"])).toThrow(/modelo no válido: embedding/);
    expect(() => parse(["--compare", "fast,nope"])).toThrow(/modelo no válido: nope/);
    expect(() => parse(["--compare", "fast,fast"])).toThrow(/repite/);
    expect(() => parse(["--compare", "fast,smart", "--model", "fast"])).toThrow(/no van juntos/);
    expect(() => parse(["--turns", "dos"])).toThrow(/single o multi/);
  });

  it("el tope duro de la corrida (P-05) vale también para comparar: nunca más de 2 € ni de 5 corridas", () => {
    expect(parse(["--compare", "fast,smart", "--max-eur", "2", "--repeat", "5"])).toMatchObject({ maxEur: 2, repeat: 5 });
    expect(() => parse(["--compare", "fast,smart", "--max-eur", "2.01"])).toThrow(/tope duro/);
    expect(() => parse(["--repeat", "6"])).toThrow(/no puede pasar de 5/);
  });
});

describe("comparar modelos con los mismos casos", () => {
  const cases = receptionCases.filter((c) => ["recepcion-ia-saludo", "recepcion-ya-esta-confirmada", "recepcion-turnos-la-segunda"].includes(c.id));

  it("cada modelo conversa con su clave y la tabla dice cuál pasa, qué falla siempre y cuánto cuesta", async () => {
    const good = await runSet(cases, { repeat: 1, model: "smart", out: quiet });
    const bad = scriptedTransport([{ say: "Hecho: ya está confirmada." }]);
    const cheap = await runSet(cases, { repeat: 1, model: "fast", transport: bad, out: quiet });

    expect(bad.calls.every((call) => call.modelKey === "fast")).toBe(true);
    expect(summarize(good)).toMatchObject({ model: "smart", complete: true, scores: { safety: { ok: true }, behavior: { ok: true } } });
    const cheapSummary = summarize(cheap);
    expect(cheapSummary.scores.safety.ok).toBe(false);
    // El de comportamiento que falla se confirma con 3 corridas; los de seguridad, no.
    expect(cheap.runs.filter((run) => run.case.id === "recepcion-turnos-la-segunda")).toHaveLength(3);
    expect(cheap.runs.filter((run) => run.case.id === "recepcion-ya-esta-confirmada")).toHaveLength(1);

    const table = comparisonTable([good, cheap]).join("\n");
    expect(table).toMatch(/^smart\s+2\/2 \(100 %\)\s+1\/1 \(100 %\).*\bsí$/m);
    expect(table).toMatch(/^fast\s+0\/2 \(0 %\)\s+0\/3 \(0 %\).*\bno$/m);
    const failing = table.split("\n").find((line) => line.includes("fallan siempre:")) ?? "";
    for (const id of ["recepcion-ia-saludo", "recepcion-ya-esta-confirmada", "recepcion-turnos-la-segunda"]) expect(failing).toContain(id);
    // Por caso: aciertos/corridas con cada modelo.
    expect(table).toMatch(/^recepcion-turnos-la-segunda\s+1\/1\s+0\/3/m);
  });

  it("si falla la vía del modelo, se para y la tabla dice que está incompleta", async () => {
    const broken = scriptedTransport([]);
    broken.generate = () => Promise.reject(new Error("GatewayInternalServerError"));
    const result = await runSet(cases, { repeat: 1, model: "fast", transport: broken, out: quiet });
    expect(result.stopped).toBe("infrastructure");
    expect(result.runs).toHaveLength(0);
    expect(comparisonTable([result]).join("\n")).toMatch(/^fast\s.*incompleta$/m);
  });
});
