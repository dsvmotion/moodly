import type { EventHandler } from "./handlers.ts";

// Primer consumidor: deja en el log cada evento entregado, con su organización
// y lo que tardó en salir. Sirve para ver el outbox funcionando de punta a
// punta (también en staging) hasta que lleguen los consumidores de los agentes.
export const logHandler: EventHandler = {
  key: "log",
  eventTypes: "*",
  async handle(event, ctx) {
    await ctx.step("log", async () => {
      ctx.logger.info(
        { chainDepth: event.chainDepth, locationId: event.locationId, lagMs: Date.now() - Date.parse(event.createdAt) },
        "evento de dominio entregado",
      );
    });
  },
};
