import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The machines connected to a workspace (`member_devices`, migration 0011)
 * with each one's revalidation date: the latest live refresh token of its
 * chain. Read with the member's session; a member sees their own workspace.
 */
export type MemberDevice = {
  id: string;
  deviceId: string;
  name: string | null;
  os: string | null;
  aiTool: string | null;
  cliVersion: string | null;
  installedModules: number;
  projectKind: "own" | "client" | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUpdateAt: string | null;
  revokedAt: string | null;
  /** When this machine must revalidate if it never updates again; null when no chain is live. */
  refreshExpiresAt: string | null;
};

export type DevicesOverview = {
  devices: MemberDevice[];
  /** Live machines (not revoked). */
  live: number;
  /** The plan's ceiling (`limits.devices`). */
  limit: number;
  /** The live chain closest to lapsing, for the home's "revalidate in N days". */
  nextRevalidationAt: string | null;
};

export async function loadDevices(
  supabase: SupabaseClient,
  input: { orgId: string; limit: number },
): Promise<DevicesOverview> {
  const [{ data: rows, error }, { data: tokens }] = await Promise.all([
    supabase
      .from("member_devices")
      .select(
        "id, device_id, name, os, ai_tool, cli_version, installed_modules, project_kind, first_seen_at, last_seen_at, last_update_at, revoked_at",
      )
      .eq("org_id", input.orgId)
      .order("last_seen_at", { ascending: false }),
    supabase
      .from("oauth_tokens")
      .select("device_id, refresh_expires_at")
      .eq("org_id", input.orgId)
      .is("revoked_at", null)
      .gt("refresh_expires_at", new Date().toISOString()),
  ]);
  if (error) throw new Error("devices_read_failed");

  const expiry = new Map<string, string>();
  for (const token of (tokens ?? []) as { device_id: string | null; refresh_expires_at: string }[]) {
    if (!token.device_id) continue;
    const current = expiry.get(token.device_id);
    if (!current || Date.parse(token.refresh_expires_at) > Date.parse(current)) {
      expiry.set(token.device_id, token.refresh_expires_at);
    }
  }

  const devices: MemberDevice[] = ((rows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    deviceId: row.device_id as string,
    name: (row.name as string | null) ?? null,
    os: (row.os as string | null) ?? null,
    aiTool: (row.ai_tool as string | null) ?? null,
    cliVersion: (row.cli_version as string | null) ?? null,
    installedModules: Array.isArray(row.installed_modules) ? row.installed_modules.length : 0,
    projectKind: (row.project_kind as "own" | "client" | null) ?? null,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    lastUpdateAt: (row.last_update_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    refreshExpiresAt: row.revoked_at ? null : (expiry.get(row.device_id as string) ?? null),
  }));

  const liveExpiries = devices
    .map((device) => device.refreshExpiresAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return {
    devices,
    live: devices.filter((device) => !device.revokedAt).length,
    limit: input.limit,
    nextRevalidationAt: liveExpiries[0] ?? null,
  };
}

/** Whole days until a date, never negative; null without a date. */
export function daysUntil(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  return Math.max(0, Math.ceil((Date.parse(value) - now) / 86_400_000));
}
