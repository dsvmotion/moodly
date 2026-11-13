import { BRAND_NAME } from "@repo/config";
import { describe, expect, it } from "vitest";
import { renderHandoffEmail, type HandoffEmailInput } from "./handoff.js";

// El email de «te han pasado una conversación» (CU3): el agente la ha pasado a
// una persona y avisa a quien puede llevarla. Función pura: el worker la llama
// y lo envía. Sin el contenido de los mensajes (V1).

const base: HandoffEmailInput = {
  locale: "es",
  agentName: "Atención al cliente",
  customerName: "Ana",
  channel: "whatsapp",
  locationName: "A1 Norte",
  // 09:30 UTC del 10 de noviembre de 2026: 10:30 en Madrid y 9:30 en Canarias.
  handedOffAt: "2026-11-10T09:30:00Z",
  timeZone: "Europe/Madrid",
  conversationUrl: "https://staging.moodlycrm.com/app/inbox/c1?scope=location%3Aa1",
};

describe("renderHandoffEmail", () => {
  it("el asunto dice qué agente pasa una conversación y de qué local", () => {
    expect(renderHandoffEmail(base).subject).toBe("Atención al cliente ha pasado una conversación al equipo (A1 Norte)");
  });

  it("el texto lleva el cliente, el canal, el local, la hora en la zona del local y el enlace", () => {
    const { text } = renderHandoffEmail(base);
    expect(text).toContain("Atención al cliente ha dejado de contestar en una conversación y la ha pasado al equipo.");
    expect(text).toContain("Cliente: Ana");
    expect(text).toContain("Canal: WhatsApp");
    expect(text).toContain("Local: A1 Norte");
    expect(text).toContain("10/11/26, 10:30 CET");
    expect(text).toContain("https://staging.moodlycrm.com/app/inbox/c1?scope=location%3Aa1");
    expect(text).toContain(BRAND_NAME);
  });

  it("la hora sale en la zona del local, no en la del servidor", () => {
    expect(renderHandoffEmail({ ...base, timeZone: "Atlantic/Canary" }).text).toContain("10/11/26, 9:30 WET");
  });

  it("sin nombre del cliente, sin canal conocido y sin local", () => {
    const email = renderHandoffEmail({ ...base, customerName: null, channel: null, locationName: null });
    expect(email.subject).toBe("Atención al cliente ha pasado una conversación al equipo (Toda la organización)");
    expect(email.text).toContain("Cliente: Sin nombre");
    expect(email.text).not.toContain("Canal:");
    expect(email.text).toContain("Local: Toda la organización");
  });

  it("un canal que no conoce no se escribe", () => {
    expect(renderHandoffEmail({ ...base, channel: "fax" }).text).not.toContain("Canal:");
  });

  it("en inglés", () => {
    const email = renderHandoffEmail({ ...base, locale: "en", agentName: "Customer care", channel: "webchat" });
    expect(email.subject).toBe("Customer care handed a conversation to the team (A1 Norte)");
    expect(email.text).toContain("Customer: Ana");
    expect(email.text).toContain("Channel: Web chat");
    expect(email.text).toContain("Location: A1 Norte");
    expect(email.text).toMatch(/11\/10\/26, 10:30\sAM GMT\+1/);
  });

  it("el HTML lleva el enlace al botón y los mismos datos", () => {
    const { html } = renderHandoffEmail(base);
    expect(html).toContain('href="https://staging.moodlycrm.com/app/inbox/c1?scope=location%3Aa1"');
    expect(html).toContain("Ana");
    expect(html).toContain("WhatsApp");
    expect(html).toContain("10/11/26, 10:30 CET");
  });

  it("el HTML escapa el nombre del cliente y el del local: los escribe el cliente o el dueño", () => {
    const { html } = renderHandoffEmail({ ...base, customerName: '<script>alert(1)</script> & "Ana"', locationName: "A1 <b>Norte</b>" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Norte</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Ana&quot;");
  });

  it("el asunto es una sola línea corta: sin saltos que añadan cabeceras", () => {
    const { subject } = renderHandoffEmail({ ...base, locationName: `A1\r\nBcc: x@evil.test\n${"a".repeat(300)}` });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject.length).toBeLessThanOrEqual(120);
    expect(subject.endsWith("…")).toBe(true);
  });

  it("el nombre del cliente no va en el asunto", () => {
    expect(renderHandoffEmail({ ...base, customerName: "Ana Pérez" }).subject).not.toContain("Ana");
  });

  it.each(["javascript:alert(1)", "ftp://moodlycrm.com/app", "/app/inbox/c1", "no es una url"])(
    "un enlace %j no es un enlace a la app: no se genera el email",
    (conversationUrl) => {
      expect(() => renderHandoffEmail({ ...base, conversationUrl })).toThrow();
    },
  );
});
