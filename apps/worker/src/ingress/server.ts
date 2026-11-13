import type { IncomingMessage, ServerResponse } from "node:http";
import type { RawWebhook } from "@repo/channels";
import type { Logger } from "pino";
import type { ReceiveResult } from "./receive.ts";

// Las rutas HTTP de la entrada de canales (ADR 0052 §2), dentro del proceso del
// worker y montadas en su servidor de salud (health.ts: el único puerto
// público del servicio en Railway): POST /channels/<canal>/webhook y GET
// /channels/<canal>/webhook (la comprobación del alta que hacen algunos
// proveedores, como Meta). Nada más.

/** Lo más grande que acepta un webhook (WhatsApp manda lotes, pero muy por debajo). */
export const MAX_BODY_BYTES = 256 * 1024;
const ROUTE = /^\/channels\/([a-z][a-z_]{1,30})\/webhook$/;

export type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;
export type Receive = (channel: string, webhook: RawWebhook) => Promise<ReceiveResult>;
/** La respuesta a la comprobación del alta de un canal (texto), o null si no vale o el canal no la tiene. */
export type Handshake = (channel: string, query: URLSearchParams) => string | null;

class BodyTooLargeError extends Error {}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      reject(new BodyTooLargeError());
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Se deja de guardar, pero no se corta aún: primero sale el 413.
        tooLarge = true;
        chunks.length = 0;
        reject(new BodyTooLargeError());
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

export function createIngressHandler(receive: Receive, logger: Logger, handshake: Handshake = () => null): RequestHandler {
  const log = logger.child({ component: "ingress" });
  return (request, response) => {
    const reply = (status: number, body: object = {}) => {
      if (response.headersSent) return;
      response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    };
    const url = new URL(request.url ?? "/", "http://ingress");
    const route = ROUTE.exec(url.pathname);
    if (!route?.[1]) return reply(404);
    const channel = route[1];
    if (request.method === "GET") {
      const challenge = handshake(channel, url.searchParams);
      // Un alta que no cuadra: 403 a secas, sin cuerpo (ni el challenge ni por qué).
      if (challenge === null) {
        response.writeHead(403).end();
        return;
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(challenge);
      return;
    }
    if (request.method !== "POST") return reply(405);
    readBody(request)
      .then((rawBody) => receive(channel, { headers: headersOf(request), rawBody }))
      .then((result) => reply(result.status, { accepted: result.accepted, duplicates: result.duplicates, ignored: result.ignored }))
      .catch((error: unknown) => {
        if (error instanceof BodyTooLargeError) {
          // Una respuesta de verdad y después se cierra la conexión, sin leer el resto.
          log.warn({ reason: "body_too_large" }, "webhook demasiado grande");
          response.once("finish", () => request.destroy());
          response.writeHead(413, { "content-type": "application/json", connection: "close" }).end("{}");
          return;
        }
        // 500: el proveedor reintenta, y lo que ya se guardó no se duplica.
        log.error({ error: (error as Error).name }, "la entrada no pudo guardar el webhook");
        reply(500);
      });
  };
}
