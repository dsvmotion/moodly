// El email de los avisos del tope mensual de IA al 80 % y al 100 % (PL-ledger,
// MANUAL §15.1; producto, 2026-11-12). Función pura, sin I/O: el worker la llama
// con los datos ya leídos de la base de datos (budget_notification) y lo envía a
// los org_admin. La marca sale de BRAND_NAME (@repo/config).
//
// Lo que dice del 100 % es lo que hace el código al llegar al tope: el
// enrutador no deja llamar al modelo (BudgetExceededError), el turno pasa la
// conversación a una persona (handed_off, motivo budget) y la conversación queda
// en manos del equipo (mode = 'human') hasta que se la devuelvan al agente. Lo
// fija el test de integración del tope (converse.integration).
//
// El nombre de la organización lo escribe su org_admin: en el HTML se escapa y
// en el asunto no va.

import { BRAND_NAME } from "@repo/config";
import type { EmailLocale, RenderedEmail } from "./approval.js";
import { appUrl, escapeHtml, oneLine } from "./format.js";

export interface BudgetEmailInput {
  locale: EmailLocale;
  organizationName: string;
  threshold: 80 | 100;
  /** Lo gastado y el tope del mes cuando se pasó el umbral, en euros. */
  spentEur: number;
  budgetEur: number;
  /** El primer día del mes (AAAA-MM-01, UTC) al que se refiere el aviso. */
  month: string;
  /**
   * El enlace absoluto a la app (su inicio). No a los ajustes de modelos: esa
   * página aún no existe, y un email no lleva enlaces rotos (V1, 2026-11-12).
   * Cuando exista, el enlace irá allí.
   */
  appUrl: string;
}

type Copy = {
  subject: string;
  intro: (org: string, spent: string, budget: string) => string;
  consequence: (until: string) => string;
  action: string;
  footer: (org: string, brand: string) => string;
};

const COPY: Record<EmailLocale, Record<80 | 100, Copy>> = {
  es: {
    80: {
      subject: "Habéis gastado el 80 % del tope mensual de IA",
      intro: (org, spent, budget) => `${org} lleva gastados este mes ${spent} de los ${budget} de tope mensual de IA (el 80 %).`,
      consequence: (until) =>
        `Si llega al tope, los agentes dejan de llamar al modelo: cada conversación que necesite a un agente pasa a vuestro equipo hasta el ${until} o hasta que se suba el tope.`,
      action: "Abrir la app",
      footer: (org, brand) => `Recibes este aviso porque administras ${org} en ${brand}.`,
    },
    100: {
      subject: "Habéis llegado al tope mensual de IA",
      intro: (org, spent, budget) => `${org} ha gastado este mes ${spent} de los ${budget} de tope mensual de IA.`,
      consequence: (until) =>
        `Hasta el ${until} o hasta que se suba el tope, los agentes no llaman al modelo: cada conversación que necesite a un agente pasa a vuestro equipo y se queda con él hasta que se la devolváis al agente.`,
      action: "Abrir la app",
      footer: (org, brand) => `Recibes este aviso porque administras ${org} en ${brand}.`,
    },
  },
  en: {
    80: {
      subject: "You've used 80% of your monthly AI cap",
      intro: (org, spent, budget) => `${org} has spent ${spent} of its ${budget} monthly AI cap this month (80%).`,
      consequence: (until) =>
        `If it reaches the cap, the agents stop calling the model: every conversation that needs an agent goes to your team until ${until} or until the cap is raised.`,
      action: "Open the app",
      footer: (org, brand) => `You get this notice because you administer ${org} in ${brand}.`,
    },
    100: {
      subject: "You've reached your monthly AI cap",
      intro: (org, spent, budget) => `${org} has spent ${spent} of its ${budget} monthly AI cap this month.`,
      consequence: (until) =>
        `Until ${until} or until the cap is raised, the agents don't call the model: every conversation that needs an agent goes to your team and stays with them until you hand it back to the agent.`,
      action: "Open the app",
      footer: (org, brand) => `You get this notice because you administer ${org} in ${brand}.`,
    },
  },
};

export function renderBudgetEmail(input: BudgetEmailInput): RenderedEmail {
  const url = appUrl(input.appUrl);
  const copy = COPY[input.locale][input.threshold];
  const org = oneLine(input.organizationName);
  const spent = euros(input.spentEur, input.locale);
  const budget = euros(input.budgetEur, input.locale);
  const until = firstOfNextMonth(input.month, input.locale);
  const brand = BRAND_NAME;

  const intro = copy.intro(org, spent, budget);
  const consequence = copy.consequence(until);
  const text = [intro, "", consequence, "", `${copy.action} (${brand}): ${url}`, "", copy.footer(org, brand)].join("\n");

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;background:#ffffff">
<p style="margin:0 0 12px">${escapeHtml(intro)}</p>
<p style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #111827;background:#f3f4f6">${escapeHtml(consequence)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none">${escapeHtml(copy.action)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7280">${escapeHtml(copy.footer(org, brand))}</p>
</body>
</html>`;

  return { subject: copy.subject, html, text };
}

function euros(value: number, locale: EmailLocale): string {
  // Intl separa con espacios duros (U+00A0, U+202F): en el texto plano, uno normal.
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", { style: "currency", currency: "EUR" }).format(value).replace(/[\u00a0\u202f]/g, " ");
}

/** «1 de diciembre» / «1 December»: cuando empieza el mes siguiente (y se vuelve a contar desde 0). */
function firstOfNextMonth(month: string, locale: EmailLocale): string {
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error("El mes del aviso tiene que ser AAAA-MM-01");
  const start = new Date(`${month}T00:00:00Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(next);
}
