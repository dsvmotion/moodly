import { describe, expect, it } from "vitest";
import { orderGroupsBySearch } from "./command-order";

const groups = [
  { heading: "Navegación", items: [{ id: "inbox", label: "Bandeja", keywords: ["inbox"] }] },
  { heading: "Agentes", items: [{ id: "agent-admin", label: "Administración", keywords: ["admin"] }] },
  {
    heading: "Ajustes",
    items: [
      { id: "settings-security", label: "Seguridad", keywords: ["security"] },
      { id: "settings-locations", label: "Sedes", keywords: ["locations"] },
    ],
  },
];

const headings = (search: string) => orderGroupsBySearch(groups, search).map((group) => group.heading);

describe("orderGroupsBySearch", () => {
  it("sin búsqueda conserva el orden", () => {
    expect(headings("")).toEqual(["Navegación", "Agentes", "Ajustes"]);
    expect(headings("   ")).toEqual(["Navegación", "Agentes", "Ajustes"]);
  });

  it("sube el grupo con la mejor coincidencia", () => {
    expect(headings("sede")[0]).toBe("Ajustes");
    expect(headings("admin")[0]).toBe("Agentes");
    expect(headings("inbox")[0]).toBe("Navegación");
  });

  it("a igual puntuación (ninguna coincidencia) conserva el orden", () => {
    expect(headings("zzz")).toEqual(["Navegación", "Agentes", "Ajustes"]);
  });

  it("no modifica los grupos recibidos", () => {
    orderGroupsBySearch(groups, "sede");
    expect(groups.map((group) => group.heading)).toEqual(["Navegación", "Agentes", "Ajustes"]);
  });
});
