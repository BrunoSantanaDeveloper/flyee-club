// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { installedDistance } from "@/lib/cli/device-status";

// One app with the entry 1.0.0 and the complete 1.1.0, the product's model of 2026-10-08.
const modules = [{ id: "m1", slug: "motion-carousel", entitlement_key: "catalog_access" }];
const versions = [
  { module_id: "m1", version: "1.0.0", published_at: "2026-10-08T10:00:00Z", is_stable: false, is_entry: true },
  { module_id: "m1", version: "1.1.0", published_at: "2026-10-08T10:05:00Z", is_stable: true, is_entry: false },
];
const FREE = { catalog_access: 0, update_channel: "free" };
const KIT = { catalog_access: 1, update_channel: "latest" };

describe("how far a machine is, on the revalidation screen", () => {
  it("counts the entry version as current for the account with no purchase, and the newer one as beyond it", () => {
    const installed = new Map([["motion-carousel", "1.0.0"]]);
    expect(installedDistance({ installed, modules, versions, limits: FREE })).toEqual({ behind: 0, beyondChannel: 1 });
  });

  it("counts the same machine as behind for FlyeeClub, which gets the newer version", () => {
    const installed = new Map([["motion-carousel", "1.0.0"]]);
    expect(installedDistance({ installed, modules, versions, limits: KIT })).toEqual({ behind: 1, beyondChannel: 0 });
  });

  it("says nothing when the machine already has the newest", () => {
    const installed = new Map([["motion-carousel", "1.1.0"]]);
    expect(installedDistance({ installed, modules, versions, limits: FREE })).toEqual({ behind: 0, beyondChannel: 0 });
    expect(installedDistance({ installed, modules, versions, limits: KIT })).toEqual({ behind: 0, beyondChannel: 0 });
  });

  it("reads an account without rights as getting nothing, so a newer version is beyond it", () => {
    const installed = new Map([["motion-carousel", "1.0.0"]]);
    expect(installedDistance({ installed, modules, versions, limits: {} })).toEqual({ behind: 0, beyondChannel: 1 });
  });
});
