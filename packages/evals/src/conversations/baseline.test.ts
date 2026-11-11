import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyBaseline, loadBaseline, parseBaseline } from "./baseline.js";
import { conversationCases } from "./cases.js";
import { parse } from "./cli.js";
import { score, scriptedTransport } from "./runner.js";
import { runSet } from "./runset.js";
import { CABINA_1, LASER } from "./world.js";

// La línea base de K-01: los fallos conocidos corren, no puntúan y avisan
// cuando se arreglan. Nunca uno de seguridad.

const BASELINE = fileURLToPath(new URL("../../baseline.json", import.meta.url));
const quiet = () => undefined;
const reason = "Falla por un motivo conocido que arregla otra sesión.";

describe("la línea base", () => {
  it("la del repo es válida: sus casos existen, ninguno es de seguridad y cada uno lleva su motivo", () => {
    const baseline = loadBaseline(BASELINE, conversationCases);
    expect(Object.keys(baseline.knownFailures)).toEqual(["recepcion-no-duplica-solicitud"]);
    expect(JSON.parse(readFileSync(BASELINE, "utf8"))).toEqual(baseline);
  });

  it("rechaza un caso de seguridad, un caso que no existe, un motivo vacío y otras claves", () => {
    expect(() => parseBaseline({ knownFailures: { "recepcion-ya-esta-confirmada": reason } }, conversationCases)).toThrow(/seguridad/);
    expect(() => parseBaseline({ knownFailures: { "no-existe": reason } }, conversationCases)).toThrow(/no existe/);
    expect(() => parseBaseline({ knownFailures: { "recepcion-no-duplica-solicitud": "" } }, conversationCases)).toThrow(/motivo/);
    expect(() => parseBaseline({ knownFailures: {}, thresholds: { behavior: 0.5 } }, conversationCases)).toThrow();
  });

  it("un fallo conocido corre una vez, no se confirma, no puntúa ni bloquea; los demás puntúan igual", async () => {
    const duplica = conversationCases.find((c) => c.id === "recepcion-no-duplica-solicitud");
    const otro = conversationCases.find((c) => c.id === "recepcion-reservar");
    if (!duplica || !otro) throw new Error("faltan casos");
    // Un modelo que vuelve a pedir la cita: falla no-duplica; reservar, con su guion, pasa.
    const rebook = scriptedTransport([
      { call: [{ name: "book_appointment", args: { service_id: LASER, resource_id: CABINA_1, starts_at: "2030-06-03T11:00:00+02:00" } }] },
      { say: "La he vuelto a pedir; una persona del equipo la confirmará." },
    ]);
    const known = new Set(["recepcion-no-duplica-solicitud"]);
    const failing = await runSet([duplica], { repeat: 1, model: null, transport: rebook, out: quiet, known });
    expect(failing.runs).toHaveLength(1);
    const passing = await runSet([otro], { repeat: 1, model: null, out: quiet, known });
    const runs = [...failing.runs, ...passing.runs];

    // Sin línea base, bloquea.
    expect(score(runs).behavior).toMatchObject({ ok: false, alwaysFailing: ["recepcion-no-duplica-solicitud"] });
    // Con ella, no puntúa, y se ve aparte con su motivo.
    const { scored, known: results } = applyBaseline(runs, { knownFailures: { "recepcion-no-duplica-solicitud": reason } });
    expect(score(scored).behavior).toMatchObject({ ok: true, runs: 1, passed: 1, alwaysFailing: [] });
    expect(results).toEqual([{ id: "recepcion-no-duplica-solicitud", reason, passed: 0, runs: 1 }]);
  });

  it("--baseline lleva la ruta del archivo", () => {
    expect(parse(["--baseline", "baseline.json"]).baseline).toBe("baseline.json");
    expect(parse([]).baseline).toBeNull();
  });
});
