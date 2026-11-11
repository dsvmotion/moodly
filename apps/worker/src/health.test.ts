import type { AddressInfo } from "node:net";
import { pino } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHealthServer, evaluateHealth, type WorkerPhase, type WorkerProbe } from "./health.ts";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000);

function probe(overrides: Partial<Omit<WorkerProbe, "phase">> & { phase?: WorkerPhase } = {}): WorkerProbe {
  const { phase = "running", ...rest } = overrides;
  return {
    phase: () => phase,
    pingDatabase: async () => {},
    oldestPendingEventAt: async () => null,
    ...rest,
  };
}
const base = { version: "3f2c1ab", commit: "abcdef1", now: () => NOW };

describe("evaluateHealth", () => {
  it("200 y ok con la base de datos viva y el outbox al día", async () => {
    const result = await evaluateHealth({ ...base, probe: probe({ oldestPendingEventAt: async () => ago(5) }) });
    expect(result.httpStatus).toBe(200);
    expect(result.body).toEqual({
      status: "ok",
      phase: "running",
      checks: { database: "ok", dbos: "ok", outbox: "ok" },
      outboxOldestPendingSeconds: 5,
      version: "3f2c1ab",
      commit: "abcdef1",
    });
  });

  it("503 si el evento sin publicar más antiguo pasa del umbral", async () => {
    const result = await evaluateHealth({ ...base, maxOutboxAgeMs: 60_000, probe: probe({ oldestPendingEventAt: async () => ago(61) }) });
    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.checks?.outbox).toBe("fail");
    expect(result.body.outboxOldestPendingSeconds).toBe(61);
  });

  it("justo en el umbral sigue sano", async () => {
    const result = await evaluateHealth({ ...base, maxOutboxAgeMs: 60_000, probe: probe({ oldestPendingEventAt: async () => ago(60) }) });
    expect(result.httpStatus).toBe(200);
  });

  it("503 si la base de datos de sistema no responde, sin filtrar el error", async () => {
    const result = await evaluateHealth({
      ...base,
      probe: probe({
        pingDatabase: async () => {
          throw new Error("password authentication failed for user dbos_worker postgresql://dbos_worker:secreto@host");
        },
      }),
    });
    expect(result.httpStatus).toBe(503);
    expect(result.body.checks).toEqual({ database: "fail", dbos: "ok", outbox: "ok" });
    expect(JSON.stringify(result.body)).not.toMatch(/secreto|password|postgresql/);
  });

  it("503 si no se puede leer el outbox", async () => {
    const result = await evaluateHealth({
      ...base,
      probe: probe({
        oldestPendingEventAt: async () => {
          throw new Error("outbox: no se pudo leer");
        },
      }),
    });
    expect(result.httpStatus).toBe(503);
    expect(result.body.checks?.outbox).toBe("fail");
    expect(result.body.outboxOldestPendingSeconds).toBeUndefined();
  });

  it("503 si una comprobación se cuelga más del tope", async () => {
    vi.useFakeTimers();
    try {
      const pending = evaluateHealth({ ...base, probeTimeoutMs: 1_000, probe: probe({ pingDatabase: () => new Promise(() => {}) }) });
      await vi.advanceTimersByTimeAsync(1_001);
      const result = await pending;
      expect(result.httpStatus).toBe(503);
      expect(result.body.checks?.database).toBe("fail");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each<WorkerPhase>(["waiting-lease", "launching"])("%s: standby con 200 y sin tocar la base de datos (el despliegue sigue)", async (phase) => {
    const pingDatabase = vi.fn(async () => {});
    const result = await evaluateHealth({ ...base, probe: probe({ phase, pingDatabase }) });
    expect(result.httpStatus).toBe(200);
    expect(result.body).toEqual({ status: "standby", phase, version: "3f2c1ab", commit: "abcdef1" });
    expect(pingDatabase).not.toHaveBeenCalled();
  });

  it("stopping: 503", async () => {
    const result = await evaluateHealth({ ...base, probe: probe({ phase: "stopping" }) });
    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("stopping");
  });
});

describe("servidor de salud", () => {
  const servers: ReturnType<typeof createHealthServer>[] = [];
  afterEach(() => {
    for (const server of servers.splice(0)) server.close();
  });

  async function start(workerProbe: WorkerProbe) {
    const server = createHealthServer({ ...base, probe: workerProbe, logger: pino({ level: "silent" }) });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("GET /health responde el JSON y no se guarda en caché", async () => {
    const url = await start(probe());
    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: "ok", phase: "running" });
  });

  it("HEAD /health responde solo el estado", async () => {
    const url = await start(probe({ oldestPendingEventAt: async () => ago(10_000) }));
    const res = await fetch(`${url}/health`, { method: "HEAD" });
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("");
  });

  it("otras rutas y métodos: 404", async () => {
    const url = await start(probe());
    expect((await fetch(`${url}/`)).status).toBe(404);
    expect((await fetch(`${url}/health/x`)).status).toBe(404);
    expect((await fetch(`${url}/health`, { method: "POST" })).status).toBe(404);
  });

  it("reutiliza el resultado unos segundos: un sondeo frecuente no multiplica las consultas", async () => {
    const pingDatabase = vi.fn(async () => {});
    const url = await start(probe({ pingDatabase }));
    await fetch(`${url}/health`);
    await fetch(`${url}/health`);
    await fetch(`${url}/health`);
    expect(pingDatabase).toHaveBeenCalledTimes(1);
  });
});
