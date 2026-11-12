import type { RealtimeChannel } from "@supabase/supabase-js";
import { getCurrentUser, getSessionAal, hasVerifiedFactor } from "@/lib/auth/session";
import { HEARTBEAT_MS, inboxTopics, LIVE_EVENTS, liveEvent, RECONNECT_MS, sseMessage, STREAM_MAX_MS } from "@/lib/inbox-live";
import { logger } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";

// La bandeja en vivo (auditoría M-10, ADR 0054): el relé del mismo origen. El
// servidor escucha, con la sesión de la persona, los temas privados de
// Realtime de su bandeja (#216) y reenvía al navegador por Server-Sent Events
// solo identificadores. El navegador no habla con Supabase (R-29: cookies
// httpOnly y connect-src 'self').
//
// - Acceso: sesión viva (getUser) y, con un segundo factor verificado, aal2;
//   si no, 401 y el navegador sigue con la relectura periódica.
// - Temas: del alcance real de la sesión, leído aquí con RLS; nunca de la
//   petición. Realtime vuelve a comprobar cada tema al unirse (política
//   inbox_read) con el JWT de la sesión.
// - Cada conexión dura como mucho STREAM_MAX_MS: al cerrarla, el navegador
//   vuelve a conectar y esta ruta comprueba otra vez sesión y alcance (con el
//   token ya renovado por el proxy).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const encoder = new TextEncoder();

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || (hasVerifiedFactor(user) && (await getSessionAal()) !== "aal2")) {
    return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const context = await getScopeContext();
  const topics = inboxTopics({
    organizationId: context.organization?.id ?? null,
    role: context.role,
    locationIds: context.locations.map((location) => location.id),
  });
  if (topics.length === 0) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  const supabase = await createClient();
  // El token de la sesión (el mismo con el que van las consultas por RLS).
  await supabase.realtime.setAuth();

  const channels: RealtimeChannel[] = [];
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = (reason: string) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        for (const channel of channels) void supabase.removeChannel(channel);
        logger.debug({ userId: user.id, reason, topics: topics.length }, "bandeja en vivo: conexión cerrada");
        try {
          controller.close();
        } catch {
          // Ya estaba cerrada por el navegador.
        }
      };

      // Tras un cierre, que EventSource vuelva a conectar en RECONNECT_MS.
      send(`retry: ${RECONNECT_MS}\n\n`);
      let subscribed = 0;
      for (const topic of topics) {
        const channel = supabase.channel(topic, { config: { private: true } });
        for (const event of LIVE_EVENTS) {
          channel.on("broadcast", { event }, ({ payload }) => {
            const live = liveEvent(event, payload);
            if (live) send(sseMessage(live.type, live));
          });
        }
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            subscribed += 1;
            // Con todos los temas escuchando, el navegador relee una vez lo que pudo cambiar mientras conectaba.
            if (subscribed === topics.length) send(sseMessage("ready", { topics: topics.length }));
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Sin aviso a la vista: se cierra y el navegador vuelve a conectar (y relee).
            close(`canal ${status}`);
          }
        });
        channels.push(channel);
      }

      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      lifetime = setTimeout(() => close("tiempo máximo"), STREAM_MAX_MS);
      request.signal.addEventListener("abort", () => close("el navegador se fue"));
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      for (const channel of channels) void supabase.removeChannel(channel);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
