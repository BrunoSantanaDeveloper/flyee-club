// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { type CliDeps, type CliOutcome, type CliSpec, runCliRequest } from "@/lib/cli/gates";
import type { VerifiedAccess } from "@/lib/oauth/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The gate order is the contract: a CLI that sees `insufficient_scope` knows
 * its token is fine, one that sees `device_unknown` knows its plan is fine.
 * Each case below breaks exactly one gate and checks that nothing after it ran.
 */

const AUTH: VerifiedAccess = {
  tokenId: "token-1",
  orgId: "org-1",
  userId: "user-1",
  scope: "profile:read catalog:read modules:download telemetry:write",
  clientId: "flyee-cli",
  clientName: "flyee CLI",
  firstParty: true,
  familyId: "family-1",
  deviceId: "device-abc-123",
  refreshExpiresAt: "2026-10-31T00:00:00Z",
};

type Trail = { endpoint: string; status: string; deviceId: string | null };

function harness(overrides: Partial<CliDeps> = {}) {
  const trail: Trail[] = [];
  const executed: string[] = [];
  const deps: CliDeps = {
    createService: () => ({}) as SupabaseClient,
    verifyToken: async (_service, token) => (token === "mcat_good" ? AUTH : null),
    readEntitlements: async () => ({ active: true, suspended: false, tier: "kit", limits: { catalog_access: 1 } }),
    findDevice: async (_service, _user, deviceId) =>
      deviceId === "device-abc-123"
        ? { id: "d1", deviceId, name: "Laptop", revokedAt: null, lastUpdateAt: null, tokenFamilyId: "family-1" }
        : null,
    rateAllowance: async () => ({ allowed: true, downloadsAllowed: true, downloadsLimit: 200 }),
    memberLocale: async () => "pt-BR",
    recordRequest: async (_service, row) => {
      trail.push({ endpoint: row.endpoint, status: row.status, deviceId: row.deviceId });
    },
    ...overrides,
  };
  const spec: CliSpec = { endpoint: "catalog", scope: "catalog:read", device: "required" };
  const run = (
    headers: Record<string, string>,
    outcome: CliOutcome | ((context: { device: unknown }) => Promise<CliOutcome>) = { ok: true, body: { fine: true } },
    specOverride: Partial<CliSpec> = {},
  ) =>
    runCliRequest(
      new Request("https://flyee.club/api/cli/catalog", { headers }),
      { ...spec, ...specOverride },
      async (context) => {
        executed.push("ran");
        return typeof outcome === "function" ? outcome(context) : outcome;
      },
      deps,
    );
  return { run, trail, executed };
}

const AUTHORIZED = { authorization: "Bearer mcat_good", "x-flyee-device": "device-abc-123" };

describe("runCliRequest", () => {
  it("serves an authorized call and files it as ok", async () => {
    const { run, trail, executed } = harness();
    const response = await run(AUTHORIZED);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fine: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(executed).toEqual(["ran"]);
    expect(trail).toEqual([{ endpoint: "catalog", status: "ok", deviceId: "device-abc-123" }]);
  });

  it("answers 401 without a valid token, points at the resource metadata, and files nothing", async () => {
    const { run, trail, executed } = harness();
    const attempts: Record<string, string>[] = [
      {},
      { authorization: "Bearer mcat_bad" },
      { authorization: "Basic abc" },
    ];
    for (const headers of attempts) {
      const response = await run(headers);
      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe("invalid_token");
      expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    }
    expect(trail).toEqual([]);
    expect(executed).toEqual([]);
  });

  it("checks the scope before the plan", async () => {
    const { run, trail } = harness({
      verifyToken: async () => ({ ...AUTH, scope: "profile:read" }),
      readEntitlements: async () => ({ active: false, suspended: true, tier: null, limits: {} }),
    });
    const response = await run(AUTHORIZED);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("insufficient_scope");
    expect(trail.map((row) => row.status)).toEqual(["denied_scope"]);
  });

  it("tells a suspended workspace apart from one without a plan", async () => {
    const suspended = harness({
      readEntitlements: async () => ({ active: false, suspended: true, tier: null, limits: {} }),
    });
    const body = await (await suspended.run(AUTHORIZED)).json();
    expect(body.error).toBe("suspended");
    expect(suspended.trail.map((row) => row.status)).toEqual(["denied_entitlement"]);

    const none = harness({
      readEntitlements: async () => ({ active: false, suspended: false, tier: null, limits: {} }),
    });
    const noneBody = await (await none.run(AUTHORIZED)).json();
    expect(noneBody.error).toBe("not_entitled");
    expect(noneBody.action_url).toContain("/settings/billing");
  });

  it("answers 503, never a denial, when the plan cannot be read", async () => {
    const { run, trail, executed } = harness({ readEntitlements: async () => null });
    const response = await run(AUTHORIZED);
    expect(response.status).toBe(503);
    expect(trail.map((row) => row.status)).toEqual(["error"]);
    expect(executed).toEqual([]);
  });

  it("refuses a chain used from another machine", async () => {
    const { run } = harness();
    const response = await run({ authorization: "Bearer mcat_good", "x-flyee-device": "other-device-99" });
    expect((await response.json()).error).toBe("device_mismatch");
  });

  it("requires a registered, live device where the endpoint says so", async () => {
    const unbound = harness({ verifyToken: async () => ({ ...AUTH, deviceId: null }) });
    expect((await (await unbound.run({ authorization: "Bearer mcat_good" })).json()).error).toBe("device_required");
    expect(
      (await (await unbound.run({ authorization: "Bearer mcat_good", "x-flyee-device": "never-seen-01" })).json())
        .error,
    ).toBe("device_unknown");

    const revoked = harness({
      findDevice: async (_service, _user, deviceId) => ({
        id: "d1",
        deviceId,
        name: null,
        revokedAt: "2026-09-30T00:00:00Z",
        lastUpdateAt: null,
        tokenFamilyId: "family-1",
      }),
    });
    const response = await revoked.run(AUTHORIZED);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("device_revoked");
    expect(revoked.trail.map((row) => row.status)).toEqual(["denied_device"]);
  });

  it("lets a disconnected machine back through a new login, as a machine not registered yet", async () => {
    // The operator's case of 2026-10-22: every CLI asks /me right after the login, before /installs.
    const reconnected = harness({
      findDevice: async (_service, _user, deviceId) => ({
        id: "d1",
        deviceId,
        name: "Laptop",
        revokedAt: "2026-10-22T00:00:00Z",
        lastUpdateAt: null,
        tokenFamilyId: "family-0",
      }),
    });
    let seen: unknown = "unset";
    const me = await reconnected.run(
      AUTHORIZED,
      async (context) => {
        seen = context.device;
        return { ok: true, body: { fine: true } };
      },
      { endpoint: "me", device: "optional" },
    );
    expect(me.status).toBe(200);
    // The executor sees no device: the row comes back only through POST /api/cli/installs.
    expect(seen).toBeNull();
    // Before it is revived, a package endpoint answers as for any machine not registered yet.
    const catalog = await reconnected.run(AUTHORIZED);
    expect((await catalog.json()).error).toBe("device_unknown");
  });

  it("lets an optional-device endpoint run without the header, but never for a revoked device", async () => {
    const { run, executed } = harness({ verifyToken: async () => ({ ...AUTH, deviceId: null }) });
    const response = await run({ authorization: "Bearer mcat_good" }, undefined, { device: "optional" });
    expect(response.status).toBe(200);
    expect(executed).toEqual(["ran"]);
  });

  it("stops a runaway loop with 429 and Retry-After", async () => {
    const { run, trail, executed } = harness({
      rateAllowance: async () => ({ allowed: false, downloadsAllowed: true, downloadsLimit: 200 }),
    });
    const response = await run(AUTHORIZED);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(trail.map((row) => row.status)).toEqual(["denied_rate"]);
    expect(executed).toEqual([]);
  });

  it("files an executor's refusal under the gate it belongs to", async () => {
    const { run, trail } = harness();
    const response = await run(AUTHORIZED, {
      ok: false,
      status: 403,
      code: "denied_entitlement",
      actionUrl: "https://flyee.club/settings/billing?source=cli",
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "denied_entitlement", action_url: expect.any(String) });
    expect(trail.map((row) => row.status)).toEqual(["denied_entitlement"]);
  });

  it("turns an executor crash into 500 and an error row", async () => {
    const { run, trail } = harness({ memberLocale: async () => "en" });
    const response = await run(AUTHORIZED, async () => {
      throw new Error("boom");
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("unavailable");
    expect(body.message).toMatch(/could not answer/);
    expect(trail.map((row) => row.status)).toEqual(["error"]);
  });

  it("speaks the member's language", async () => {
    const { run } = harness({ memberLocale: async () => "en", verifyToken: async () => ({ ...AUTH, scope: "" }) });
    const body = await (await run(AUTHORIZED)).json();
    expect(body.message).toMatch(/permission/);
  });
});
