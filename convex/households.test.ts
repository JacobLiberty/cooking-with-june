// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// convex-test needs the Convex module map; import.meta.glob must be literal here
// so Vite transforms it (must include the _generated dir).
const modules = import.meta.glob("./**/*.*s");

async function newUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run(async (ctx) => ctx.db.insert("users", { email }));
}

test("createHousehold makes the creator an owner", async () => {
  const t = convexTest(schema, modules);
  const userId = await newUser(t, "jacob@example.com");
  const as = t.withIdentity({ subject: userId });

  const householdId = await as.mutation(api.households.createHousehold, {
    name: "Jacob & Lily",
  });

  const viewer = await as.query(api.households.viewer, {});
  expect(viewer).toMatchObject({ householdId, role: "owner" });
});

test("createHousehold rejects a second household for the same user", async () => {
  const t = convexTest(schema, modules);
  const userId = await newUser(t, "jacob@example.com");
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: "One" });
  await expect(
    as.mutation(api.households.createHousehold, { name: "Two" }),
  ).rejects.toThrow(/already/i);
});

test("createHousehold is invite-only when FOUNDER_EMAILS is set", async () => {
  vi.stubEnv("FOUNDER_EMAILS", "founder@example.com");
  try {
    const t = convexTest(schema, modules);
    const outsider = await newUser(t, "random@example.com");
    await expect(
      t
        .withIdentity({ subject: outsider })
        .mutation(api.households.createHousehold, { name: "Nope" }),
    ).rejects.toThrow(/invite-only/i);

    const founder = await newUser(t, "founder@example.com");
    const hid = await t
      .withIdentity({ subject: founder })
      .mutation(api.households.createHousehold, { name: "Yes" });
    expect(hid).toBeTruthy();
  } finally {
    vi.unstubAllEnvs();
  }
});

test("invite code lets a second user join", async () => {
  const t = convexTest(schema, modules);
  const owner = await newUser(t, "jacob@example.com");
  const ownerAs = t.withIdentity({ subject: owner });
  await ownerAs.mutation(api.households.createHousehold, { name: "Home" });
  const code = await ownerAs.mutation(api.households.createInvite, {});

  const joiner = await newUser(t, "lily@example.com");
  const joinerAs = t.withIdentity({ subject: joiner });
  await joinerAs.mutation(api.households.acceptInvite, { code });

  const v = await joinerAs.query(api.households.viewer, {});
  expect(v).toMatchObject({ role: "member" });
});

test("acceptInvite rejects an unknown or already-used code", async () => {
  const t = convexTest(schema, modules);
  const owner = await newUser(t, "jacob@example.com");
  const ownerAs = t.withIdentity({ subject: owner });
  await ownerAs.mutation(api.households.createHousehold, { name: "Home" });
  const code = await ownerAs.mutation(api.households.createInvite, {});

  const a = await newUser(t, "a@example.com");
  await t
    .withIdentity({ subject: a })
    .mutation(api.households.acceptInvite, { code });

  const b = await newUser(t, "b@example.com");
  await expect(
    t.withIdentity({ subject: b }).mutation(api.households.acceptInvite, { code }),
  ).rejects.toThrow(/invalid|used/i);
  await expect(
    t
      .withIdentity({ subject: b })
      .mutation(api.households.acceptInvite, { code: "NOPE2345" }),
  ).rejects.toThrow(/invalid/i);
});
