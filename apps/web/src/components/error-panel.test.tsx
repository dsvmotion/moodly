import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { ErrorPanel } from "./error-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

function render(messages: typeof es, locale: string, digest?: string): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Madrid">
      <ErrorPanel digest={digest} reset={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("ErrorPanel", () => {
  it("dice qué pasó, se anuncia (role=alert) y ofrece reintentar, en el idioma de la persona", () => {
    const html = render(es, "es");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Esta página no se ha podido cargar");
    expect(html).toContain("Reintentar");
    expect(render(en, "en")).toContain("Try again");
  });

  it("enseña la referencia del error para soporte, y nada si no la hay", () => {
    expect(render(es, "es", "1234567890")).toContain("Referencia: 1234567890");
    expect(render(es, "es")).not.toContain("Referencia");
  });
});
