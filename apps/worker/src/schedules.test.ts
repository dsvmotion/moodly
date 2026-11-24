import { describe, expect, it } from "vitest";
import { PUBLISH_SCHEDULE } from "./events/outbox.ts";
import { SWEEP_SCHEDULE } from "./ingress/ingest.ts";

// OPS-01: los workers de prueba corren el publicador del outbox y el barrido de
// la entrada más deprisa (outboxTesting y ingestTesting.sweepSchedule). Lo que
// corre en producción no cambia: estos son sus valores por defecto.
describe("las programaciones de producción", () => {
  it("el publicador del outbox sigue cada 5 s y el barrido de la entrada, cada minuto a los 23 s", () => {
    expect(PUBLISH_SCHEDULE).toBe("*/5 * * * * *");
    expect(SWEEP_SCHEDULE).toBe("23 * * * * *");
  });
});
