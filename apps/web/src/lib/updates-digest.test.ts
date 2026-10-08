import {
  deviceKey,
  type DigestDevice,
  keepUpdatingAccounts,
  type LatestVersion,
  pendingUpdates,
} from "./updates-digest";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-10-06T13:00:00Z");
const WEEK = 7 * 86_400_000;
const since = NOW - WEEK;

const fresh = (version: string): LatestVersion => ({ version, publishedAt: new Date(NOW - 86_400_000).toISOString() });
const old = (version: string): LatestVersion => ({ version, publishedAt: new Date(NOW - 3 * WEEK).toISOString() });

const device = (userId: string, deviceId: string, installed: unknown): DigestDevice => ({
  userId,
  deviceId,
  installed,
});
const live = (...devices: DigestDevice[]) => new Set(devices.map((entry) => deviceKey(entry.userId, entry.deviceId)));

describe("what the weekly summary tells a member", () => {
  it("lists an installed app whose newer version came out this week", () => {
    const laptop = device("ana", "laptop", [{ slug: "deploy-check", version: "1.1.0" }]);
    const pending = pendingUpdates({
      devices: [laptop],
      liveDevices: live(laptop),
      latestBySlug: new Map([["deploy-check", fresh("1.2.0")]]),
      since,
    });
    expect(pending.get("ana")).toEqual([{ slug: "deploy-check", from: "1.1.0", to: "1.2.0" }]);
  });

  it("says nothing about a version that is old news, however far behind the member is", () => {
    const laptop = device("ana", "laptop", [{ slug: "deploy-check", version: "1.0.0" }]);
    const pending = pendingUpdates({
      devices: [laptop],
      liveDevices: live(laptop),
      latestBySlug: new Map([["deploy-check", old("1.2.0")]]),
      since,
    });
    expect(pending.size).toBe(0);
  });

  it("says nothing when the member is already on the newest version, or ahead of it", () => {
    const laptop = device("ana", "laptop", [
      { slug: "deploy-check", version: "1.2.0" },
      { slug: "product-scope", version: "2.0.0-beta.1" },
    ]);
    const pending = pendingUpdates({
      devices: [laptop],
      liveDevices: live(laptop),
      latestBySlug: new Map([
        ["deploy-check", fresh("1.2.0")],
        ["product-scope", fresh("1.9.0")],
      ]),
      since,
    });
    expect(pending.size).toBe(0);
  });

  it("ignores a machine that can no longer update (revoked or lapsed connection)", () => {
    const laptop = device("ana", "laptop", [{ slug: "deploy-check", version: "1.1.0" }]);
    const pending = pendingUpdates({
      devices: [laptop],
      liveDevices: new Set(),
      latestBySlug: new Map([["deploy-check", fresh("1.2.0")]]),
      since,
    });
    expect(pending.size).toBe(0);
  });

  it("gives one line per app, from the oldest version the member has on any machine", () => {
    const laptop = device("ana", "laptop", [{ slug: "deploy-check", version: "1.1.0" }]);
    const desktop = device("ana", "desktop", [
      { slug: "deploy-check", version: "1.0.3" },
      { slug: "api-contract", version: "0.4.0" },
    ]);
    const pending = pendingUpdates({
      devices: [laptop, desktop],
      liveDevices: live(laptop, desktop),
      latestBySlug: new Map([
        ["deploy-check", fresh("1.2.0")],
        ["api-contract", fresh("0.5.0")],
      ]),
      since,
    });
    // Sorted by slug, so the message reads the same on every run.
    expect(pending.get("ana")).toEqual([
      { slug: "api-contract", from: "0.4.0", to: "0.5.0" },
      { slug: "deploy-check", from: "1.0.3", to: "1.2.0" },
    ]);
  });

  it("keeps each member's apps apart", () => {
    const ana = device("ana", "laptop", [{ slug: "deploy-check", version: "1.1.0" }]);
    const bia = device("bia", "laptop", [{ slug: "deploy-check", version: "1.2.0" }]);
    const pending = pendingUpdates({
      devices: [ana, bia],
      liveDevices: live(ana, bia),
      latestBySlug: new Map([["deploy-check", fresh("1.2.0")]]),
      since,
    });
    expect([...pending.keys()]).toEqual(["ana"]);
  });

  it("survives what an installer might report: unknown apps, bad versions, no list at all", () => {
    const odd = device("ana", "laptop", [
      { slug: "gone-from-store", version: "1.0.0" },
      { slug: "deploy-check", version: "not-a-version" },
      { slug: 42, version: "1.0.0" },
      null,
    ]);
    const empty = device("bia", "laptop", null);
    const pending = pendingUpdates({
      devices: [odd, empty],
      liveDevices: live(odd, empty),
      latestBySlug: new Map([["deploy-check", fresh("1.2.0")]]),
      since,
    });
    expect(pending.size).toBe(0);
  });

  it("does not count a version with no publication date as new", () => {
    const laptop = device("ana", "laptop", [{ slug: "deploy-check", version: "1.1.0" }]);
    const pending = pendingUpdates({
      devices: [laptop],
      liveDevices: live(laptop),
      latestBySlug: new Map([["deploy-check", { version: "1.2.0", publishedAt: null }]]),
      since,
    });
    expect(pending.size).toBe(0);
  });
});

describe("who is told about new versions", () => {
  it("keeps the accounts whose channel brings them, and leaves out the rest", () => {
    const pending = new Map([
      ["kit", 1],
      ["free", 1],
      ["unreadable", 1],
    ]);
    const channels: Record<string, "latest" | "free" | null> = { kit: "latest", free: "free", unreadable: null };
    expect([...keepUpdatingAccounts(pending, (userId) => channels[userId] ?? null).keys()]).toEqual(["kit"]);
  });
});
