import { describe, it, expect } from "vitest";
import { mapViewer } from "./viewer-map";

describe("mapViewer", () => {
  it("maps a member with a household", () => {
    expect(
      mapViewer({
        userId: "u1",
        name: "Jacob",
        householdId: "h1",
        role: "owner",
        canCreateHousehold: true,
      }),
    ).toEqual({
      isAuthenticated: true,
      isMember: true,
      userId: "u1",
      householdId: "h1",
      role: "owner",
      name: "Jacob",
      canCreateHousehold: true,
    });
  });

  it("maps an authenticated non-founder without a household", () => {
    expect(
      mapViewer({
        userId: "u1",
        name: null,
        householdId: null,
        role: null,
        canCreateHousehold: false,
      }),
    ).toEqual({
      isAuthenticated: true,
      isMember: false,
      userId: "u1",
      householdId: null,
      role: null,
      name: null,
      canCreateHousehold: false,
    });
  });

  it("maps an anonymous viewer from null", () => {
    expect(mapViewer(null)).toEqual({
      isAuthenticated: false,
      isMember: false,
      userId: null,
      householdId: null,
      role: null,
      name: null,
      canCreateHousehold: false,
    });
  });
});
