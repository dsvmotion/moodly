// Un Nango falso para los e2e (O-02): la web habla con él por HTTP con su
// transporte real (NANGO_HOST=http://127.0.0.1:3999), así que el código de
// producción no tiene ningún interruptor de «falso». Lo arranca Playwright
// (playwright.config.ts → webServer). Solo escucha en loopback.
//
// - POST /connect/sessions: guarda la petición y devuelve un enlace a /connect.
// - GET /connect: la «ventana de autorización» (una página sin más).
// - DELETE /connections/:id: guarda el borrado; un id que empieza por «fail-»
//   responde 503, para probar que la web no desconecta si Nango falla.
// - GET /__stub/calls: lo que ha recibido (sesiones y borrados), para los tests.
// - GET /health: para que Playwright sepa que está levantado.
import { createServer } from "node:http";

export const NANGO_STUB_PORT = 3999;
export const NANGO_STUB_KEY = "e2e-nango-stub-key-not-secret";

interface Calls {
  sessions: { tags: Record<string, string>; allowed_integrations: string[] }[];
  deleted: { connectionId: string; integrationKey: string | null }[];
}

const calls: Calls = { sessions: [], deleted: [] };

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${NANGO_STUB_PORT}`);
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  if (url.pathname === "/__stub/calls") return json(res, 200, calls);
  if (url.pathname === "/connect") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<!doctype html><title>Nango (stub)</title><p>Autoriza tu cuenta</p>");
    return;
  }
  if (req.headers.authorization !== `Bearer ${NANGO_STUB_KEY}`) return json(res, 401, { error: { code: "unauthorized" } });

  if (req.method === "POST" && url.pathname === "/connect/sessions") {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    req.on("end", () => {
      const parsed = JSON.parse(body) as Calls["sessions"][number];
      calls.sessions.push(parsed);
      const token = `stub-session-${calls.sessions.length}`;
      json(res, 201, {
        data: {
          token,
          connect_link: `http://127.0.0.1:${NANGO_STUB_PORT}/connect?session_token=${token}`,
          expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        },
      });
    });
    return;
  }
  const deleting = /^\/connections\/([^/]+)$/.exec(url.pathname);
  if (req.method === "DELETE" && deleting?.[1]) {
    const connectionId = decodeURIComponent(deleting[1]);
    if (connectionId.startsWith("fail-")) return json(res, 503, { error: { code: "unavailable" } });
    calls.deleted.push({ connectionId, integrationKey: url.searchParams.get("provider_config_key") });
    return json(res, 200, { success: true });
  }
  return json(res, 404, { error: { code: "not_found" } });
});

server.listen(NANGO_STUB_PORT, "127.0.0.1", () => {
  console.log(`Nango (stub) en http://127.0.0.1:${NANGO_STUB_PORT}`);
});
