import { describe, expect, it } from "vitest";

import { isRoomFull } from "@/lib/member/device-room-rule";

const machines = (...ids: string[]) => ids.map((deviceId) => ({ deviceId }));

describe("whether a machine finds a place on the account", () => {
  it("is full at the limit for a machine that is not connected yet", () => {
    expect(isRoomFull(machines("pc"), 1, "laptop")).toBe(true);
    expect(isRoomFull(machines("pc", "laptop", "desk"), 3, "cloud")).toBe(true);
    expect(isRoomFull(machines("pc"), 1, null)).toBe(true);
  });

  it("keeps the place of a machine that asks again", () => {
    expect(isRoomFull(machines("pc"), 1, "pc")).toBe(false);
  });

  it("has room below the limit, and no ceiling is never full", () => {
    expect(isRoomFull(machines("pc"), 3, "laptop")).toBe(false);
    expect(isRoomFull(machines(), 1, "laptop")).toBe(false);
    expect(isRoomFull(machines("pc", "laptop"), 0, "desk")).toBe(false);
  });
});
