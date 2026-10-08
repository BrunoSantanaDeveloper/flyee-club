import { latestVersion } from "@flyee/catalog/semver";

/**
 * Which versions of an app an account may download (docs/PRODUCT.md,
 * decisions of 2026-10-06 and 2026-10-08, option 1). The account's plan names
 * its channel in `limits.update_channel`:
 *
 *   latest  FlyeeClub and FlyeeClub Pro: every released version the app's
 *           entitlement key allows;
 *   stable  reserved: the versions marked stable;
 *   free    the account with no purchase: only the entry version of each app.
 *
 * The entry version (one per app, `catalog_module_versions.is_entry`, migration
 * 0040) opens to every active account, whatever the channel. The account with
 * no purchase is never updated because no new version enters its channel, not
 * because anything blocks it. Pure; the database merges the channel of every
 * live source so the widest one wins (`entitlement_merge`).
 */

export const CHANNELS = ["free", "stable", "latest"] as const;

export type Channel = (typeof CHANNELS)[number];

/**
 * The channel the limits name. Null when they name none: an inactive account
 * reads as `{}` on the member screens, and such an account downloads nothing.
 */
export function channelOf(limits: Record<string, unknown> | null | undefined): Channel | null {
  const value = limits?.update_channel;
  return (CHANNELS as readonly unknown[]).includes(value) ? (value as Channel) : null;
}

export type ChannelVersion = {
  version: string;
  published_at?: string | null;
  status?: string;
  is_stable: boolean;
  is_entry: boolean;
};

/**
 * May an account on `channel` download this released version? `hasKey` says
 * whether its limits grant the app's entitlement key (catalog_access, for most).
 */
export function versionAllowed(
  version: Pick<ChannelVersion, "is_stable" | "is_entry">,
  channel: Channel | null,
  hasKey: boolean,
): boolean {
  if (!channel) return false;
  if (version.is_entry) return true;
  if (!hasKey || channel === "free") return false;
  return channel === "stable" ? version.is_stable : true;
}

/**
 * The versions a catalog answer names for one app, from its released versions:
 *  - `latest`: the newest this account may download (only stable ones when
 *    asked); with nothing allowed, the newest published, so a locked app
 *    still names a version and the CLI tells "locked" from "not found" by
 *    `entitled`, as it always did;
 *  - `newest`: the newest published version, the same for every account;
 *  - `entitled`: whether the account may download any version of the app.
 */
export function resolveChannel<T extends ChannelVersion>(
  versions: readonly T[],
  input: { channel: Channel | null; hasKey: boolean; stableOnly?: boolean },
): { latest: T | null; newest: T | null; entitled: boolean } {
  const published = versions.filter((row) => (row.status ?? "published") === "published");
  const pool = input.stableOnly ? published.filter((row) => row.is_stable) : published;
  const allowed = published.filter((row) => versionAllowed(row, input.channel, input.hasKey));
  const best = latestVersion(input.stableOnly ? allowed.filter((row) => row.is_stable) : allowed);
  return {
    latest: best ?? latestVersion(pool),
    newest: latestVersion(published),
    entitled: allowed.length > 0,
  };
}
