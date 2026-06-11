import { describe, it, expect } from "vitest";
import { mapViewer } from "./viewer-map";

describe("mapViewer", () => {
  it("maps a member with a household", () => {
    expect(
      mapViewer({ userId: "u1", name: "Jacob", householdId: "h1", role: "owner" }),
    ).toEqual({
      isAuthenticated: true,
      isMember: true,
      userId: "u1",
      householdId: "h1",
      role: "owner",
      name: "Jacob",
    });
  });

  it("maps an authenticated user without a household", () => {
    expect(
      mapViewer({ userId: "u1", name: null, householdId: null, role: null }),
    ).toEqual({
      isAuthenticated: true,
      isMember: false,
      userId: "u1",
      householdId: null,
      role: null,
      name: null,
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
    });
  });
});
