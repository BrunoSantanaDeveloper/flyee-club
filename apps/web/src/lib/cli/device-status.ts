import "server-only";

import { chainLapsed } from "@/lib/oauth/token-rules";
import { compareSemver, isSemver, latestVersion } from "@flyee/catalog/semver";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the revalidation screens say about one machine: how long since it last
 * updated, and how many of the tools installed there have a newer version
 * waiting. Read with the service role (the screens already checked the session
 * owns the device).
 */
export type DeviceStatus = {
  name: string | null;
  lastUpdateAt: string | null;
  /** Whole days since the last update (or, without one, since it was last seen). */
  daysSinceUpdate: number;
  /** Installed tools with a newer published version. */
  behind: number;
  /** The machine's chain lapsed (it was connected and nothing is live): approving now is a revalidation. */
  lapsed: boolean;
  revoked: boolean;
};

export async function readDeviceStatus(
  service: SupabaseClient,
  input: { userId: string; deviceId: string },
): Promise<DeviceStatus | null> {
  const [{ data: device }, { data: previous }] = await Promise.all([
    service
      .from("member_devices")
      .select("name, last_update_at, last_seen_at, installed_modules, revoked_at")
      .eq("user_id", input.userId)
      .eq("device_id", input.deviceId)
      .maybeSingle(),
    service
      .from("oauth_tokens")
      .select("revoked_at, refresh_expires_at")
      .eq("user_id", input.userId)
      .eq("device_id", input.deviceId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (!device) return null;

  const installed = (Array.isArray(device.installed_modules) ? device.installed_modules : []) as {
    slug?: unknown;
    version?: unknown;
  }[];
  const installedBySlug = new Map<string, string>();
  for (const entry of installed) {
    if (typeof entry.slug === "string" && isSemver(entry.version)) installedBySlug.set(entry.slug, entry.version);
  }

  let behind = 0;
  if (installedBySlug.size > 0) {
    const { data: modules } = await service
      .from("catalog_modules")
      .select("id, slug")
      .eq("status", "published")
      .in("slug", [...installedBySlug.keys()]);
    const slugById = new Map(((modules ?? []) as { id: string; slug: string }[]).map((row) => [row.id, row.slug]));
    if (slugById.size > 0) {
      const { data: versions } = await service
        .from("catalog_module_versions")
        .select("module_id, version, published_at")
        .eq("status", "published")
        .in("module_id", [...slugById.keys()]);
      const byModule = new Map<string, { version: string; published_at: string | null }[]>();
      for (const row of (versions ?? []) as { module_id: string; version: string; published_at: string | null }[]) {
        const list = byModule.get(row.module_id) ?? [];
        list.push(row);
        byModule.set(row.module_id, list);
      }
      for (const [moduleId, list] of byModule) {
        const latest = latestVersion(list);
        const current = installedBySlug.get(slugById.get(moduleId) ?? "");
        if (latest && current && compareSemver(current, latest.version) < 0) behind += 1;
      }
    }
  }

  const reference = (device.last_update_at ?? device.last_seen_at) as string | null;
  return {
    name: (device.name as string | null) ?? null,
    lastUpdateAt: (device.last_update_at as string | null) ?? null,
    daysSinceUpdate: reference ? Math.max(0, Math.floor((Date.now() - Date.parse(reference)) / 86_400_000)) : 0,
    behind,
    lapsed: chainLapsed((previous ?? []) as { revoked_at: string | null; refresh_expires_at: string | null }[]),
    revoked: Boolean(device.revoked_at),
  };
}
