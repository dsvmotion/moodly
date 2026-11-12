import { BRAND_NAME } from "@repo/config";
import { describe, expect, it } from "vitest";
import { renderBudgetEmail, type BudgetEmailInput } from "./budget.js";

// Los avisos del tope mensual de IA (PL-ledger). Función pura: el worker la
// llama con lo que lee de la base de datos y lo envía a los org_admin.

const base: BudgetEmailInput = {
  locale: "es",
  organizationName: "Clínica Demo",
  threshold: 80,
  spentEur: 240.5,
  budgetEur: 300,
  month: "2026-11-01",
  appUrl: "https://staging.moodlycrm.com/app",
};

describe("renderBudgetEmail", () => {
  it("al 80 %: lo gastado y el tope, y lo que pasará al llegar al tope", () => {
    const { subject, text } = renderBudgetEmail(base);
    expect(subject).toBe("Habéis gastado el 80 % del tope mensual de IA");
    expect(text).toContain("Clínica Demo lleva gastados este mes 240,50 € de los 300,00 € de tope mensual de IA (el 80 %).");
    expect(text).toContain("Si llega al tope, los agentes dejan de llamar al modelo");
    expect(text).toContain("hasta el 1 de diciembre o hasta que se suba el tope.");
    // A la app, no a los ajustes de modelos, que aún no existen: ningún enlace roto.
    expect(text).toContain(`Abrir la app (${BRAND_NAME}): https://staging.moodlycrm.com/app\n`);
    expect(text).not.toContain("settings");
    expect(text).toContain(`Recibes este aviso porque administras Clínica Demo en ${BRAND_NAME}.`);
  });

  it("al 100 %: dice lo que hace el código, el modelo no se llama y la conversación pasa al equipo hasta que se la devuelvan", () => {
    const { subject, text } = renderBudgetEmail({ ...base, threshold: 100, spentEur: 300.2 });
    expect(subject).toBe("Habéis llegado al tope mensual de IA");
    expect(text).toContain("Clínica Demo ha gastado este mes 300,20 € de los 300,00 € de tope mensual de IA.");
    expect(text).toContain(
      "Hasta el 1 de diciembre o hasta que se suba el tope, los agentes no llaman al modelo: cada conversación que necesite a un agente pasa a vuestro equipo y se queda con él hasta que se la devolváis al agente.",
    );
  });

  it("en inglés, con el mismo contenido", () => {
    const eighty = renderBudgetEmail({ ...base, locale: "en" });
    expect(eighty.subject).toBe("You've used 80% of your monthly AI cap");
    expect(eighty.text).toContain("Clínica Demo has spent €240.50 of its €300.00 monthly AI cap this month (80%).");
    expect(eighty.text).toContain("until 1 December or until the cap is raised.");
    const full = renderBudgetEmail({ ...base, locale: "en", threshold: 100 });
    expect(full.subject).toBe("You've reached your monthly AI cap");
    expect(full.text).toContain("stays with them until you hand it back to the agent.");
    expect(full.html).toContain('<html lang="en">');
  });

  it("diciembre pasa al 1 de enero", () => {
    expect(renderBudgetEmail({ ...base, month: "2026-12-01" }).text).toContain("hasta el 1 de enero");
  });

  it("el nombre de la organización va escapado en el HTML y en una sola línea", () => {
    const { html, text } = renderBudgetEmail({ ...base, organizationName: 'Clínica <b>"Demo"</b>\nSegunda' });
    expect(html).not.toContain("<b>");
    expect(html).toContain("Clínica &lt;b&gt;&quot;Demo&quot;&lt;/b&gt; Segunda");
    expect(text).toContain('Clínica <b>"Demo"</b> Segunda lleva gastados');
  });

  it("solo enlaces https a la app (o http local) y meses que empiezan en día 1", () => {
    expect(() => renderBudgetEmail({ ...base, appUrl: "http://evil.test/app" })).toThrow();
    expect(() => renderBudgetEmail({ ...base, appUrl: "javascript:alert(1)" })).toThrow();
    expect(() => renderBudgetEmail({ ...base, appUrl: "http://127.0.0.1:3000/app" })).not.toThrow();
    expect(() => renderBudgetEmail({ ...base, month: "2026-11-15" })).toThrow();
  });
});
