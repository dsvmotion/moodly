import { describe, expect, it } from "vitest";
import { BRAND_NAME } from "@repo/config";
import { renderApprovalEmail, type ApprovalEmailInput } from "./approval.js";

// El email de «una aprobación te espera» (auditoría de preproducción, M-02;
// decisión de producto 10). Función pura: el worker la llama y lo envía.

const base: ApprovalEmailInput = {
  locale: "es",
  agentName: "Recepción",
  summary: "Responder: «Tenemos hueco el lunes a las 9:00»",
  locationName: "A1 Norte",
  // 09:30 UTC del 10 de noviembre de 2026: 10:30 en Madrid y 9:30 en Canarias.
  createdAt: "2026-11-10T09:30:00Z",
  timeZone: "Europe/Madrid",
  approvalUrl: "https://staging.moodlycrm.com/app/approvals?scope=location%3Aa1",
};

describe("renderApprovalEmail", () => {
  it("el asunto dice qué agente espera y qué", () => {
    expect(renderApprovalEmail(base).subject).toBe(
      "Recepción espera tu aprobación: Responder: «Tenemos hueco el lunes a las 9:00»",
    );
  });

  it("el texto lleva el resumen, el local, la hora en la zona del local y el enlace", () => {
    const { text } = renderApprovalEmail(base);
    expect(text).toContain("Responder: «Tenemos hueco el lunes a las 9:00»");
    expect(text).toContain("Local: A1 Norte");
    expect(text).toContain("10/11/26, 10:30 CET");
    expect(text).toContain("https://staging.moodlycrm.com/app/approvals?scope=location%3Aa1");
    expect(text).toContain(BRAND_NAME);
  });

  it("la hora sale en la zona del local, no en la del servidor", () => {
    expect(renderApprovalEmail({ ...base, timeZone: "Atlantic/Canary" }).text).toContain("10/11/26, 9:30 WET");
  });

  it("una zona que no existe cae a la de por defecto de los locales", () => {
    expect(renderApprovalEmail({ ...base, timeZone: "Marte/Olympus" }).text).toContain("10/11/26, 10:30 CET");
  });

  it("sin local, dice que es de toda la organización", () => {
    expect(renderApprovalEmail({ ...base, locationName: null }).text).toContain("Local: Toda la organización");
  });

  it("en inglés", () => {
    const email = renderApprovalEmail({ ...base, locale: "en", agentName: "Reception" });
    expect(email.subject).toBe("Reception is waiting for your approval: Responder: «Tenemos hueco el lunes a las 9:00»");
    expect(email.text).toContain("Location: A1 Norte");
    expect(email.text).toMatch(/11\/10\/26, 10:30\sAM GMT\+1/);
  });

  it("el HTML lleva el enlace al botón y los mismos datos", () => {
    const { html } = renderApprovalEmail(base);
    expect(html).toContain('href="https://staging.moodlycrm.com/app/approvals?scope=location%3Aa1"');
    expect(html).toContain("A1 Norte");
    expect(html).toContain("10/11/26, 10:30 CET");
  });

  it("el HTML escapa lo que viene de la conversación: el resumen puede llevar texto del cliente", () => {
    const { html } = renderApprovalEmail({
      ...base,
      summary: 'Responder: <script>alert(1)</script> & "hola"',
      locationName: "A1 <b>Norte</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Norte</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;hola&quot;");
  });

  it("el asunto es una sola línea corta: sin saltos que añadan cabeceras", () => {
    const { subject } = renderApprovalEmail({ ...base, summary: `Responder:\r\nBcc: x@evil.test\n${"a".repeat(300)}` });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject.length).toBeLessThanOrEqual(120);
    expect(subject.endsWith("…")).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://moodlycrm.com/app", "/app/approvals", "no es una url"])(
    "un enlace %j no es un enlace a la app: no se genera el email",
    (approvalUrl) => {
      expect(() => renderApprovalEmail({ ...base, approvalUrl })).toThrow();
    },
  );

  it("en local vale http a 127.0.0.1 o localhost", () => {
    expect(() => renderApprovalEmail({ ...base, approvalUrl: "http://127.0.0.1:3000/app/approvals" })).not.toThrow();
    expect(() => renderApprovalEmail({ ...base, approvalUrl: "http://evil.test/app/approvals" })).toThrow();
  });
});
