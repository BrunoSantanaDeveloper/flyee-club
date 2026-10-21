import "server-only";

import { isRoomFull } from "@/lib/member/device-room-rule";
import { loadDevices, type MemberDevice } from "@/lib/member/devices";
import { limitOf } from "@flyee/billing/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether a machine asking to connect finds a place on the account (the
 * product's request of 2026-10-21, item 7.7), read before the approval on
 * /ativar and /oauth/authorize. The CLI registers the machine only after the
 * approval, so the limit used to show then, and the member had to approve a
 * second time; now the page lists the connected machines first and the member
 * disconnects one right there.
 */
export type DeviceRoom = {
  /** The plan's ceiling (`limits.devices`). */
  limit: number;
  /** The computers connected now, the most recently used first (cloud sessions left out). */
  connected: MemberDevice[];
  /** At the limit, and the asking machine is not one of them. */
  full: boolean;
};

/** Null when the machines could not be read: the page then behaves as before. */
export async function loadDeviceRoom(
  supabase: SupabaseClient,
  input: { orgId: string; limits: Record<string, unknown> | null | undefined; deviceId: string | null },
): Promise<DeviceRoom | null> {
  const limit = limitOf(input.limits, "devices");
  let devices: MemberDevice[];
  try {
    devices = (await loadDevices(supabase, { orgId: input.orgId, limit })).devices;
  } catch {
    return null;
  }
  // Computers only: a Claude Code session in the cloud takes its own place (migration 0044).
  const connected = devices.filter((device) => !device.revokedAt && !device.cloud);
  return { limit, connected, full: isRoomFull(connected, limit, input.deviceId) };
}
