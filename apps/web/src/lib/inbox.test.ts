import { describe, expect, it } from "vitest";
import {
  canReplyOn,
  encodeCursor,
  ilikePattern,
  inboxErrorFor,
  inboxHref,
  inScope,
  isInboxChannel,
  latestByConversation,
  messageSide,
  modesFor,
  olderThan,
  parseCursor,
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

// Auditoría de preproducción, M-07: la lista se pagina por posición (la última
// fila de la página), no por número de página, para que un mensaje nuevo no
// repita ni se salte conversaciones al pasar de página.
describe("el cursor de la lista", () => {
  const withMessages = {
    lastMessageAt: "2026-11-09T10:01:00.123456+00:00",
    createdAt: "2026-11-08T09:00:00+00:00",
    id: "5eed000b-0000-4000-8000-0000000000b1",
  };
  const withoutMessages = { ...withMessages, lastMessageAt: null };

  it("va y vuelve de la URL sin perder nada", () => {
    expect(parseCursor(encodeCursor(withMessages))).toEqual(withMessages);
    expect(parseCursor(encodeCursor(withoutMessages))).toEqual(withoutMessages);
    expect(parseCursor([encodeCursor(withMessages), "otro"])).toEqual(withMessages);
  });

  it.each([
    undefined,
    null,
    "",
    42,
    "~",
    "ayer~hoy~uno",
    // Fechas o id que no lo son.
    "2026-11-09~2026-11-08T09:00:00+00:00~5eed000b-0000-4000-8000-0000000000b1",
    "2026-11-09T10:01:00+00:00~2026-11-08T09:00:00+00:00~b1",
    // Sin fecha de creación.
    "2026-11-09T10:01:00+00:00~~5eed000b-0000-4000-8000-0000000000b1",
    // Intentos de colar otro filtro en la consulta.
    "2026-11-09T10:01:00+00:00~2026-11-08T09:00:00+00:00~5eed000b-0000-4000-8000-0000000000b1),id.neq.x",
    '2026-11-09T10:01:00+00:00",id.neq."x~2026-11-08T09:00:00+00:00~5eed000b-0000-4000-8000-0000000000b1',
    "2026-11-09T10:01:00+00:00~2026-11-08T09:00:00+00:00~5eed000b-0000-4000-8000-0000000000b1~de-mas",
  ])("%j no es un cursor: la lista empieza por el principio", (value) => {
    expect(parseCursor(value)).toBeNull();
  });

  it("lo anterior a una conversación con mensajes: mensajes más antiguos, el desempate y las que no tienen mensajes", () => {
    expect(olderThan(withMessages)).toEqual({
      onlyWithoutMessages: false,
      or: 'last_message_at.lt."2026-11-09T10:01:00.123456+00:00",last_message_at.is.null,and(last_message_at.eq."2026-11-09T10:01:00.123456+00:00",or(created_at.lt."2026-11-08T09:00:00+00:00",and(created_at.eq."2026-11-08T09:00:00+00:00",id.lt.5eed000b-0000-4000-8000-0000000000b1)))',
    });
  });

  it("lo anterior a una conversación sin mensajes: solo otras sin mensajes, creadas antes", () => {
    expect(olderThan(withoutMessages)).toEqual({
      onlyWithoutMessages: true,
      or: 'created_at.lt."2026-11-08T09:00:00+00:00",and(created_at.eq."2026-11-08T09:00:00+00:00",id.lt.5eed000b-0000-4000-8000-0000000000b1)',
    });
  });

  it("el enlace a la página anterior lleva el cursor, y las conversaciones abiertas desde ella lo conservan", () => {
    const before = encodeCursor(withMessages);
    const href = inboxHref({ filter: "human", search: "", scope: null, before });
    expect(new URL(href, "http://x").searchParams.get("before")).toBe(before);
    expect(
      new URL(inboxHref({ filter: "open", search: "", scope: null, before }, "c-1"), "http://x").searchParams.get("before"),
    ).toBe(before);
  });
});

describe("inboxErrorFor", () => {
  it("sin permiso, mensaje vacío o fallo nuestro", () => {
    expect(inboxErrorFor("42501")).toBe("not_allowed");
    expect(inboxErrorFor("23514")).toBe("invalid");
    expect(inboxErrorFor("XX000")).toBe("failed");
    expect(inboxErrorFor(undefined)).toBe("failed");
  });
});

// Auditoría de preproducción, M-01: el equipo solo escribe donde el mensaje
// llega de verdad. Hasta la capa de canales (O-01), un mensaje del equipo por
// WhatsApp, Instagram, email o voz se quedaría «pendiente» para siempre.
describe("canReplyOn", () => {
  it("el chat web entrega lo que escribe el equipo: se puede contestar", () => {
    expect(canReplyOn("webchat")).toBe(true);
  });

  it.each(["whatsapp", "instagram", "email", "voice", "test", null, undefined, "otro"])(
    "%j aún no entrega: el cuadro de respuesta queda bloqueado",
    (channel) => {
      expect(canReplyOn(channel)).toBe(false);
    },
  );
});
