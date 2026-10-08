import "server-only";

import { grantsModuleKey } from "@/lib/catalog/read";
import { chainLapsed } from "@/lib/oauth/token-rules";
import { channelOf, resolveChannel } from "@flyee/catalog/channels";
import { compareSemver, isSemver } from "@flyee/catalog/semver";
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
  /** Installed tools with a newer version this account may download (its channel, 0040). */
  behind: number;
  /**
   * Installed tools with a newer version this account does not get: the account
   * with no purchase has the entry version of each app, and the newer ones come
   * with FlyeeClub.
   */
  beyondChannel: number;
  /** The machine's chain lapsed (it was connected and nothing is live): approving now is a revalidation. */
  lapsed: boolean;
  revoked: boolean;
};

type InstalledVersion = { slug?: unknown; version?: unknown };

type CatalogVersion = {
  module_id: string;
  version: string;
  published_at: string | null;
  is_stable: boolean;
  is_entry: boolean;
};

/**
 * How far the installed tools are, per app: behind what the account may
 * download, or behind only what it does not get. Pure.
 */
export function installedDistance(input: {
  installed: Map<string, string>;
  modules: { id: string; slug: string; entitlement_key: string }[];
  versions: CatalogVersion[];
  limits: Record<string, unknown>;
}): { behind: number; beyondChannel: number } {
  const channel = channelOf(input.limits);
  let behind = 0;
  let beyondChannel = 0;
  for (const module of input.modules) {
    const current = input.installed.get(module.slug);
    if (!current) continue;
    const { latest, newest, entitled } = resolveChannel(
      input.versions.filter((row) => row.module_id === module.id),
      { channel, hasKey: grantsModuleKey(module, input.limits) },
    );
    const reachable = entitled && latest ? latest.version : current;
    if (entitled && latest && compareSemver(current, latest.version) < 0) behind += 1;
    else if (newest && compareSemver(newest.version, current) > 0 && compareSemver(newest.version, reachable) > 0) {
      beyondChannel += 1;
    }
  }
  return { behind, beyondChannel };
}

export async function readDeviceStatus(
  service: SupabaseClient,
  input: { userId: string; deviceId: string },
): Promise<DeviceStatus | null> {
  const [{ data: device }, { data: previous }] = await Promise.all([
    service
      .from("member_devices")
      .select("org_id, name, last_update_at, last_seen_at, installed_modules, revoked_at")
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

  const installed = (Array.isArray(device.installed_modules) ? device.installed_modules : []) as InstalledVersion[];
  const installedBySlug = new Map<string, string>();
  for (const entry of installed) {
    if (typeof entry.slug === "string" && isSemver(entry.version)) installedBySlug.set(entry.slug, entry.version);
  }

  let distance = { behind: 0, beyondChannel: 0 };
  if (installedBySlug.size > 0) {
    const [{ data: modules }, { data: entitlements }] = await Promise.all([
      service
        .from("catalog_modules")
        .select("id, slug, entitlement_key")
        .eq("status", "published")
        .in("slug", [...installedBySlug.keys()]),
      service.rpc("org_entitlements", { target_org: device.org_id }),
    ]);
    const moduleRows = (modules ?? []) as { id: string; slug: string; entitlement_key: string }[];
    if (moduleRows.length > 0) {
      const { data: versions } = await service
        .from("catalog_module_versions")
        .select("module_id, version, published_at, is_stable, is_entry")
        .eq("status", "published")
        .in(
          "module_id",
          moduleRows.map((row) => row.id),
        );
      const limits = (entitlements as { active?: boolean; limits?: Record<string, unknown> } | null)?.active
        ? ((entitlements as { limits?: Record<string, unknown> }).limits ?? {})
        : {};
      distance = installedDistance({
        installed: installedBySlug,
        modules: moduleRows,
        versions: (versions ?? []) as CatalogVersion[],
        limits,
      });
    }
  }

  const reference = (device.last_update_at ?? device.last_seen_at) as string | null;
  return {
    name: (device.name as string | null) ?? null,
    lastUpdateAt: (device.last_update_at as string | null) ?? null,
    daysSinceUpdate: reference ? Math.max(0, Math.floor((Date.now() - Date.parse(reference)) / 86_400_000)) : 0,
    behind: distance.behind,
    beyondChannel: distance.beyondChannel,
    lapsed: chainLapsed((previous ?? []) as { revoked_at: string | null; refresh_expires_at: string | null }[]),
    revoked: Boolean(device.revoked_at),
  };
}
