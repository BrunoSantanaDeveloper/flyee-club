import type { Channel } from "@flyee/catalog/channels";
import { compareSemver, isSemver } from "@flyee/catalog/semver";

/**
 * What the weekly summary says to one member: which of the apps they have
 * installed got a new version this week. Pure, so the rule is tested without a
 * database (updates-digest.test.ts); the reads are in updates-digest-jobs.ts.
 *
 * Four decisions live here:
 * - only a machine that can still update counts (a live connection): a
 *   revoked or lapsed one would be told to run a command that is refused;
 * - only a version published inside the window counts, so a member who chose
 *   not to update is told once, not every week about the same version;
 * - one line per app, from the OLDEST version the member still has on any
 *   machine: that is the distance the update covers;
 * - only an account whose channel brings new versions is told (keepUpdatingAccounts).
 */

export type DigestDevice = {
  userId: string;
  deviceId: string;
  /** `member_devices.installed_modules`: what the installer last reported. */
  installed: unknown;
};

export type LatestVersion = { version: string; publishedAt: string | null };

export type PendingUpdate = { slug: string; from: string; to: string };

/** The key of one machine of one member. */
export const deviceKey = (userId: string, deviceId: string) => `${userId}:${deviceId}`;

export function pendingUpdates(input: {
  devices: DigestDevice[];
  /** `deviceKey` of every machine with a live connection. */
  liveDevices: ReadonlySet<string>;
  /** The newest published version of each published app, by slug. */
  latestBySlug: ReadonlyMap<string, LatestVersion>;
  /** Versions published before this moment are old news. */
  since: number;
}): Map<string, PendingUpdate[]> {
  const byUser = new Map<string, Map<string, PendingUpdate>>();

  for (const device of input.devices) {
    if (!input.liveDevices.has(deviceKey(device.userId, device.deviceId))) continue;
    const installed = Array.isArray(device.installed)
      ? (device.installed as { slug?: unknown; version?: unknown }[])
      : [];
    for (const entry of installed) {
      if (typeof entry?.slug !== "string" || !isSemver(entry.version)) continue;
      const latest = input.latestBySlug.get(entry.slug);
      if (!latest || compareSemver(entry.version, latest.version) >= 0) continue;
      const published = Date.parse(latest.publishedAt ?? "");
      if (!(published >= input.since)) continue;

      const pending = byUser.get(device.userId) ?? new Map<string, PendingUpdate>();
      const known = pending.get(entry.slug);
      if (!known || compareSemver(entry.version, known.from) < 0) {
        pending.set(entry.slug, { slug: entry.slug, from: entry.version, to: latest.version });
      }
      byUser.set(device.userId, pending);
    }
  }

  return new Map(
    [...byUser].map(([userId, pending]) => [
      userId,
      [...pending.values()].sort((left, right) => left.slug.localeCompare(right.slug)),
    ]),
  );
}

/**
 * Only an account whose channel brings new versions is told about them. The
 * account with no purchase keeps the entry version of each app (migration
 * 0040): a summary of versions it does not get would tell it to run a command
 * that brings nothing. An account whose rights could not be read is left out
 * too, the cautious side of a weekly notice.
 */
export function keepUpdatingAccounts<T>(
  pending: ReadonlyMap<string, T>,
  channelOfUser: (userId: string) => Channel | null,
): Map<string, T> {
  return new Map(
    [...pending].filter(([userId]) => {
      const channel = channelOfUser(userId);
      return channel === "latest" || channel === "stable";
    }),
  );
}
