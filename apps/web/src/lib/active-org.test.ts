import { describe, expect, it } from "vitest";
import { pickActiveOrg, sortMemberships, type OrgMembership } from "./active-org";

const d: OrgMembership = { organizationId: "d", organizationName: "Demo D", role: "staff" };
const e: OrgMembership = { organizationId: "e", organizationName: "Demo E", role: "location_manager" };

describe("pickActiveOrg", () => {
  it("sin cookie, la primera por nombre", () => {
    expect(pickActiveOrg([e, d], undefined)).toEqual(d);
  });

  it("con la cookie de una organización suya, esa", () => {
    expect(pickActiveOrg([d, e], "e")).toEqual(e);
  });

  it("una cookie de una organización que no es suya no vale: la primera por nombre", () => {
    expect(pickActiveOrg([d, e], "otra-organizacion")).toEqual(d);
  });

  it("sin memberships, ninguna", () => {
    expect(pickActiveOrg([], "d")).toBeNull();
  });

  it("orden estable por nombre y, a igual nombre, por id", () => {
    const twin: OrgMembership = { organizationId: "a", organizationName: "Demo D", role: "staff" };
    expect(sortMemberships([e, d, twin]).map((m) => m.organizationId)).toEqual(["a", "d", "e"]);
  });
});
