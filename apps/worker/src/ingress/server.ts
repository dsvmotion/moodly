import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";
import type { RawWebhook } from "@repo/channels";
import type { Logger } from "pino";
import type { ReceiveResult } from "./receive.ts";

// El servidor HTTP de la entrada de canales (ADR 0052 §2), dentro del proceso
// del worker: POST /channels/<canal>/webhook y GET /healthz. Nada más.

/** Lo más grande que acepta un webhook (WhatsApp manda lotes, pero muy por debajo). */
export const MAX_BODY_BYTES = 256 * 1024;
const ROUTE = /^\/channels\/([a-z][a-z_]{1,30})\/webhook$/;

export type Receive = (channel: string, webhook: RawWebhook) => Promise<ReceiveResult>;

class BodyTooLargeError extends Error {}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BodyTooLargeError());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function headersOf(request: IncomingMessage): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(request.headers)) headers[name] = Array.isArray(value) ? value.join(",") : value;
  return headers;
}

export function createIngressServer(receive: Receive, logger: Logger): Server {
  const log = logger.child({ component: "ingress" });
  return createServer((request, response) => {
    const reply = (status: number, body: object = {}) => {
      if (response.headersSent) return;
      response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    };
    const url = new URL(request.url ?? "/", "http://ingress");
    if (request.method === "GET" && url.pathname === "/healthz") return reply(200, { ok: true });
    const route = ROUTE.exec(url.pathname);
    if (!route?.[1]) return reply(404);
    if (request.method !== "POST") return reply(405);
    const channel = route[1];
    readBody(request)
      .then((rawBody) => receive(channel, { headers: headersOf(request), rawBody }))
      .then((result) => reply(result.status, { accepted: result.accepted, duplicates: result.duplicates, ignored: result.ignored }))
      .catch((error: unknown) => {
        if (error instanceof BodyTooLargeError) return reply(413);
        // 500: el proveedor reintenta, y lo que ya se guardó no se duplica.
        log.error({ error: (error as Error).name }, "la entrada no pudo guardar el webhook");
        reply(500);
      });
  });
}
