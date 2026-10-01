/**
 * Versions as the catalog stores and orders them. Pure and import-free.
 *
 * The rules mirror the database exactly (migration 0008): `semver_ok` accepts
 * MAJOR.MINOR.PATCH with no leading zeros and up to five digits each, plus an
 * optional prerelease of up to 20 characters, and no build metadata;
 * `semver_sort_key` orders by major, minor and patch, and puts a release after
 * its own prereleases. Two prereleases of the same release compare equal: the
 * database breaks that tie by publication date, and so must callers.
 */

export const SEMVER_PATTERN =
  /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})(?:-([0-9A-Za-z][0-9A-Za-z.-]{0,19}))?$/;

export const isSemver = (value: unknown): value is string => typeof value === "string" && SEMVER_PATTERN.test(value);

/** [major, minor, patch, 1 for a release or 0 for a prerelease]; null when the value is not a version. */
export function semverKey(value: string): [number, number, number, number] | null {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : 0];
}

/**
 * Negative when `a` sorts before `b`, positive after, 0 when the database
 * would consider them equal. Anything that is not a version sorts first.
 */
export function compareSemver(a: string, b: string): number {
  const left = semverKey(a);
  const right = semverKey(b);
  if (!left || !right) return (left ? 1 : 0) - (right ? 1 : 0);
  for (let index = 0; index < 4; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The newest of some released versions, ties broken by the latest
 * publication, the same answer `catalog_latest_version` gives.
 */
export function latestVersion<T extends { version: string; published_at?: string | null }>(
  versions: readonly T[],
): T | null {
  let best: T | null = null;
  for (const candidate of versions) {
    if (!isSemver(candidate.version)) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    const order = compareSemver(candidate.version, best.version);
    // An unparseable date compares false, so it never wins a tie.
    const newer = order > 0 || (order === 0 && Date.parse(candidate.published_at ?? "") > Date.parse(best.published_at ?? ""));
    if (newer) best = candidate;
  }
  return best;
}

/**
 * The lowest core version a declared range admits, for the
 * `min_core_version` column: `>=0.3.0`, `^0.3.0`, `~0.3.0`, `=0.3.0` and a
 * bare `0.3.0` all give `0.3.0`. Null for anything else.
 */
export function minimumOfRange(range: string | null | undefined): string | null {
  if (typeof range !== "string") return null;
  const bare = range.trim().replace(/^(?:\^|~|>=|=)\s*/, "");
  return isSemver(bare) ? bare : null;
}
