// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseInstallReport, registerDeviceArgs } = await import("@/lib/cli/installs");

const AUTH = { userId: "user-1", orgId: "org-1", familyId: "family-1" };
const DEVICE_ID = "3f1c2a9e-8b4d-4e6f-9a1b-2c3d4e5f6a7b";

describe("the cloud mark of an install report (migration 0044, item 4)", () => {
  it("takes a Claude Code session in the cloud and hands the mark to the database", () => {
    const parsed = parseInstallReport({ device_id: DEVICE_ID, ai_tool: "claude_code", cloud: "claude_code" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(registerDeviceArgs(AUTH, parsed.report)).toMatchObject({ target_cloud: "claude_code" });
  });

  it("leaves a computer unmarked", () => {
    const parsed = parseInstallReport({ device_id: DEVICE_ID });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(registerDeviceArgs(AUTH, parsed.report).target_cloud).toBeNull();
  });

  it("refuses any other value, as every unknown field", () => {
    for (const cloud of ["codex", "true", true, 1, ""]) {
      expect(parseInstallReport({ device_id: DEVICE_ID, cloud }).ok, String(cloud)).toBe(false);
    }
  });
});
