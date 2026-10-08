import type { Channel } from "@flyee/catalog/channels";

/**
 * How one tool reads for one account on the member screens (migration 0040),
 * from what the catalog reader answers. Pure.
 *
 *  - `open`: the account installs the newest version;
 *  - `entry`: the account with no purchase installs the entry version
 *    (`installs`), and the newer ones come with FlyeeClub;
 *  - `locked`: the account may install no version of it.
 *
 * `newest` is the newest version for everyone, so a screen can show the
 * distance when `installs` is behind it.
 */
export type ModuleAccess = {
  kind: "open" | "entry" | "locked";
  installs: string | null;
  newest: string | null;
};

export function moduleAccess(
  module: { entitled: boolean; latest: { version: string } | null; newest?: { version: string } | null },
  channel: Channel | null,
): ModuleAccess {
  const newest = module.newest?.version ?? module.latest?.version ?? null;
  if (!module.entitled) return { kind: "locked", installs: null, newest };
  return { kind: channel === "free" ? "entry" : "open", installs: module.latest?.version ?? null, newest };
}

/** The newer version an account on the entry version does not get, or null. Pure. */
export function newerThanInstalls(access: ModuleAccess): string | null {
  return access.kind === "entry" && access.newest && access.newest !== access.installs ? access.newest : null;
}
