// Envío de emails con la API REST de Resend (M-02). Sin SDK: un POST con fetch.
//
// - La clave va solo en la cabecera Authorization: nunca en un error ni en un log.
// - Idempotency-Key: Resend no repite un envío con la misma clave (24 h). Quien
//   llama la deriva de lo que avisa y a quién (approval:<id>:<user>), así que un
//   reintento del worker no manda dos veces el mismo email.
// - Los errores no llevan el cuerpo de la respuesta (puede repetir la dirección):
//   solo el estado HTTP y el nombre del error de Resend.

export const RESEND_API_URL = "https://api.resend.com";

export interface EmailAddress {
  email: string;
  /** El nombre que se ve; sin comillas ni saltos de línea. */
  name?: string;
}

export interface SendEmailRequest {
  from: EmailAddress;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Estable por envío: el mismo aviso a la misma persona lleva siempre la misma. */
  idempotencyKey: string;
}

export interface EmailSender {
  /** Devuelve el id del email en Resend. Lanza EmailSendError si no se envía. */
  send(request: SendEmailRequest): Promise<{ id: string }>;
}

/**
 * - transient: vale la pena reintentar (red, 429, 5xx o una petición igual en curso).
 * - unauthorized: 401/403, la clave o el dominio están mal configurados. No es
 *   pasajero: reintentar no sirve y fallará igual con cualquier destinatario.
 * - rejected: Resend rechaza este email (p. ej. una dirección que no vale).
 */
export type EmailSendErrorKind = "transient" | "unauthorized" | "rejected";

export class EmailSendError extends Error {
  override readonly name = "EmailSendError";
  constructor(
    message: string,
    /** null: no llegó respuesta (red). */
    readonly status: number | null,
    readonly kind: EmailSendErrorKind,
  ) {
    super(message);
  }

  /** Vale la pena reintentar. */
  get retryable(): boolean {
    return this.kind === "transient";
  }
}

export interface ResendSenderOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

const IDEMPOTENCY_KEY_MAX = 256;

function formatAddress({ email, name }: EmailAddress): string {
  const clean = name
    // eslint-disable-next-line no-control-regex -- quitar caracteres de control es justo el objetivo
    ?.replace(/[\u0000-\u001F\u007F"<>\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? `${clean} <${email}>` : email;
}

async function errorName(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "name" in body && typeof body.name === "string" && /^[a-z_]{1,64}$/.test(body.name)) {
      return body.name;
    }
  } catch {
    // Sin cuerpo JSON: basta con el estado.
  }
  return "unknown";
}

export function createResendSender({ apiKey, fetch = globalThis.fetch, baseUrl = RESEND_API_URL }: ResendSenderOptions): EmailSender {
  if (!apiKey.trim()) throw new Error("Falta la clave de Resend");
  return {
    async send(request) {
      if (!request.idempotencyKey || request.idempotencyKey.length > IDEMPOTENCY_KEY_MAX) {
        throw new EmailSendError("La clave de idempotencia no es válida", null, "rejected");
      }
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/emails`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": request.idempotencyKey,
          },
          body: JSON.stringify({
            from: formatAddress(request.from),
            to: [request.to],
            subject: request.subject,
            html: request.html,
            text: request.text,
          }),
        });
      } catch {
        throw new EmailSendError("Resend no respondió", null, "transient");
      }
      if (!response.ok) {
        const name = await errorName(response);
        // 409 concurrent_idempotent_requests: otra petición con la misma clave en curso.
        const kind: EmailSendErrorKind =
          response.status === 401 || response.status === 403
            ? "unauthorized"
            : response.status === 429 || response.status >= 500 || (response.status === 409 && name === "concurrent_idempotent_requests")
              ? "transient"
              : "rejected";
        throw new EmailSendError(`Resend rechazó el email (${response.status} ${name})`, response.status, kind);
      }
      const body: unknown = await response.json().catch(() => null);
      const id = body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : "";
      return { id };
    },
  };
}
