import { describe, expect, it } from "vitest";
import {
  ilikePattern,
  inboxHref,
  inScope,
  isInboxChannel,
  latestByConversation,
  messageSide,
  modesFor,
  parseInboxFilter,
  parseSearch,
  previewText,
} from "./inbox";

describe("parseInboxFilter", () => {
  it.each([
    ["human", "human"],
    ["closed", "closed"],
    ["open", "open"],
    [["closed", "human"], "closed"],
  ])("%j → %s", (value, expected) => {
    expect(parseInboxFilter(value)).toBe(expected);
  });

  it.each([undefined, null, "", "agent", "CLOSED", "all", 3, ["nope"]])("%j → open (por defecto)", (value) => {
    expect(parseInboxFilter(value)).toBe("open");
  });
});

describe("modesFor", () => {
  it("abiertas son las del agente y las del equipo; el resto, su modo", () => {
    expect(modesFor("open")).toEqual(["agent", "human"]);
    expect(modesFor("human")).toEqual(["human"]);
    expect(modesFor("closed")).toEqual(["closed"]);
  });
});

describe("parseSearch", () => {
  it("quita espacios de sobra, toma el primero si viene repetido y corta en 100", () => {
    expect(parseSearch("  Ana   García ")).toBe("Ana García");
    expect(parseSearch(["Luis", "Ana"])).toBe("Luis");
    expect(parseSearch("x".repeat(150))).toHaveLength(100);
    expect(parseSearch(undefined)).toBe("");
    expect(parseSearch(42)).toBe("");
  });
});

describe("ilikePattern", () => {
  it("busca el texto tal cual, sin comodines de LIKE", () => {
    expect(ilikePattern("Ana")).toBe("%Ana%");
    expect(ilikePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("inScope", () => {
  const scoped = new Set(["a1"]);

  it("lo de un local, si el local está en el alcance", () => {
    expect(inScope("a1", { kind: "location", locationId: "a1" }, scoped)).toBe(true);
    expect(inScope("a2", { kind: "location", locationId: "a1" }, scoped)).toBe(false);
  });

  it("lo de toda la organización, solo con «Toda la organización»", () => {
    expect(inScope(null, { kind: "all" }, scoped)).toBe(true);
    expect(inScope(null, { kind: "region", regionId: "r1" }, scoped)).toBe(false);
    expect(inScope(null, { kind: "location", locationId: "a1" }, scoped)).toBe(false);
  });
});

describe("isInboxChannel", () => {
  it("nombra los canales reales y nunca el de pruebas", () => {
    expect(isInboxChannel("whatsapp")).toBe(true);
    expect(isInboxChannel("webchat")).toBe(true);
    expect(isInboxChannel("test")).toBe(false);
    expect(isInboxChannel(null)).toBe(false);
    expect(isInboxChannel(undefined)).toBe(false);
  });
});

describe("previewText", () => {
  it("deja una línea y corta con «…»", () => {
    expect(previewText("Hola,\n\n  ¿tenéis   hueco?")).toBe("Hola, ¿tenéis hueco?");
    expect(previewText("abcdefghij", 5)).toBe("abcd…");
    expect(previewText("abcde", 5)).toBe("abcde");
  });
});

describe("latestByConversation", () => {
  it("se queda con el último mensaje de cada conversación, venga en el orden que venga", () => {
    const previews = latestByConversation([
      {
        conversation_id: "c1",
        author: "agent",
        content: "Te reservo a las 10",
        created_at: "2026-11-09T10:01:00Z",
      },
      {
        conversation_id: "c1",
        author: "contact",
        content: "¿Mañana?",
        created_at: "2026-11-09T10:00:00Z",
      },
      {
        conversation_id: "c2",
        author: "contact",
        content: "Hola",
        created_at: "2026-11-09T09:00:00Z",
      },
    ]);
    expect(previews.get("c1")).toEqual({
      author: "agent",
      text: "Te reservo a las 10",
    });
    expect(previews.get("c2")).toEqual({ author: "contact", text: "Hola" });
    expect(previews.size).toBe(2);
  });

  it("ignora un autor desconocido en lugar de pintarlo", () => {
    const previews = latestByConversation([
      {
        conversation_id: "c1",
        author: "robot",
        content: "?",
        created_at: "2026-11-09T10:00:00Z",
      },
    ]);
    expect(previews.has("c1")).toBe(false);
  });
});

describe("messageSide", () => {
  it("el cliente a un lado, el negocio al otro y el sistema en medio", () => {
    expect(messageSide("contact")).toBe("start");
    expect(messageSide("agent")).toBe("end");
    expect(messageSide("user")).toBe("end");
    expect(messageSide("system")).toBe("center");
  });
});

describe("inboxHref", () => {
  it("sin nada de más, la bandeja a secas", () => {
    expect(inboxHref({ filter: "open", search: "", scope: null })).toBe("/app/inbox");
    expect(inboxHref({ filter: "open", search: "", scope: "all" })).toBe("/app/inbox");
  });

  it("conserva el filtro, la búsqueda y el alcance al abrir una conversación", () => {
    expect(inboxHref({ filter: "human", search: "Ana G", scope: "location:a1" }, "c-1")).toBe(
      "/app/inbox/c-1?status=human&q=Ana+G&scope=location%3Aa1",
    );
  });

  it("codifica el id de la conversación", () => {
    expect(inboxHref({ filter: "open", search: "", scope: null }, "a/b?c")).toBe("/app/inbox/a%2Fb%3Fc");
  });
});
