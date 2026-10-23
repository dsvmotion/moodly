import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { redactEmails } from "./scrub";
import { scrubBreadcrumb, scrubEvent, sentryOptions, withoutUnwantedIntegrations } from "./sentry";

describe("Sentry sin datos personales (ADR 0032)", () => {
  it("de la petición solo quedan el método y la ruta, sin token, cabeceras, cookies ni cuerpo", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: "GET",
        url: "https://staging.moodlycrm.com/app/invitacion?token=secreto#x",
        query_string: "token=secreto",
        headers: { cookie: "sb-access-token=abc", referer: "https://staging.moodlycrm.com/app/invitacion?token=secreto" },
        cookies: { "sb-access-token": "abc" },
        data: { password: "x" },
      },
      user: { id: "u1", email: "ana@example.com", ip_address: "203.0.113.7" },
    } as ErrorEvent);
    expect(event.request).toEqual({ method: "GET", url: "https://staging.moodlycrm.com/app/invitacion" });
    expect(event.user).toBeUndefined();
    expect(JSON.stringify(event)).not.toMatch(/secreto|abc|ana@example\.com|203\.0\.113\.7/);
  });

  it("las rutas de los contextos (la de Next, en el servidor) van sin query", () => {
    const event = scrubEvent({
      type: undefined,
      contexts: {
        nextjs: { request_path: "/app/invitacion?token=secreto", router_path: "/app/invitacion", route_type: "page" },
        runtime: { name: "node" },
      },
    } as ErrorEvent);
    expect(event.contexts).toEqual({
      nextjs: { request_path: "/app/invitacion", router_path: "/app/invitacion", route_type: "page" },
      runtime: { name: "node" },
    });
  });

  it("censura los emails del mensaje y de las excepciones", () => {
    const event = scrubEvent({
      type: undefined,
      message: "fallo para ana@example.com",
      exception: { values: [{ type: "Error", value: "Key (email)=(luis.p@empresa.es) already exists" }] },
    } as ErrorEvent);
    expect(event.message).toBe("fallo para [email]");
    expect(event.exception?.values?.[0]?.value).toBe("Key (email)=([email]) already exists");
    expect(redactEmails("sin datos")).toBe("sin datos");
  });

  it("quita los breadcrumbs de consola y la query de las URLs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "ana@example.com" })).toBeNull();
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "/app/invitacion?token=secreto", status_code: 200 } })).toEqual({
      category: "fetch",
      data: { url: "/app/invitacion", status_code: 200 },
    });
    expect(scrubBreadcrumb({ category: "navigation", data: { from: "/login?next=%2Fapp", to: "/app#top" } })?.data).toEqual({
      from: "/login",
      to: "/app",
    });
    const event = scrubEvent({ type: undefined, breadcrumbs: [{ category: "console", message: "x" }, { category: "ui.click", message: "button" }] } as ErrorEvent);
    expect(event.breadcrumbs).toEqual([{ category: "ui.click", message: "button" }]);
  });

  it("sin `cause` encadenadas (el detalle de Supabase no sale), sin trazas, consola ni sesiones", () => {
    const integrations = ["Dedupe", "LinkedErrors", "GlobalHandlers", "BrowserTracing", "WebVitals", "SpanStreaming", "Console", "BrowserSession"].map(
      (name) => ({ name }),
    );
    expect(withoutUnwantedIntegrations(integrations).map((integration) => integration.name)).toEqual(["Dedupe", "GlobalHandlers"]);
  });

  describe("opciones", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("sin DSN no se activa; sin datos personales y sin trazas", () => {
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
      const options = sentryOptions();
      expect(options.enabled).toBe(false);
      // La SDK 11 lo recoge todo por defecto: aquí, ningún dato de la persona ni de la petición.
      expect(options.dataCollection).toEqual({
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        frameContextLines: 0,
      });
      expect(options).not.toHaveProperty("tracesSampleRate");
      expect(options).not.toHaveProperty("replaysSessionSampleRate");
    });

    it("con DSN se activa en el entorno configurado", () => {
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://clave@o1.ingest.de.sentry.io/2");
      vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "staging");
      expect(sentryOptions()).toMatchObject({ enabled: true, environment: "staging" });
    });
  });
});
