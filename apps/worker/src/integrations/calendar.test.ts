import { platformIntegrationsIn } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { CALENDAR_READERS } from "./calendar.ts";

// Lo que se prueba contra Supabase local está en nango-webhook.integration.ts.
describe("los lectores de calendario del worker", () => {
  it("cada calendario del catálogo tiene su lector (si no, una organización lo conectaría y no se podría leer)", () => {
    for (const entry of platformIntegrationsIn("calendar")) {
      expect(CALENDAR_READERS[entry.provider], entry.provider).toBeTypeOf("function");
    }
  });
});
