import { randomInt } from "node:crypto";

/**
 * The device authorization grant (RFC 8628) in pure pieces: the short code a
 * member types, and what a polling CLI is told. The database row lives in
 * `oauth_device_codes` (migration 0010).
 */

/** Eight characters, no 0/O or 1/I: the alphabet the database checks. */
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const USER_CODE_LENGTH = 8;
export const DEVICE_CODE_TTL_S = 600;
export const DEVICE_POLL_INTERVAL_S = 5;
/** RFC 8628 §3.5: each `slow_down` adds five seconds to the interval. */
export const SLOW_DOWN_STEP_S = 5;
const MAX_INTERVAL_S = 60;

export function generateUserCode(): string {
  let code = "";
  for (let index = 0; index < USER_CODE_LENGTH; index += 1) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  }
  return code;
}

/** `ABCDEFGH` → `ABCD-EFGH`, the way the CLI prints it and the page shows it. */
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * What a member typed, as the stored code: uppercase, without the hyphen or
 * spaces. Null when it cannot be a code (so the page says "check the code"
 * without a lookup).
 */
export function normalizeUserCode(input: string | null | undefined): string | null {
  const code = (input ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== USER_CODE_LENGTH) return null;
  for (const character of code) {
    if (!USER_CODE_ALPHABET.includes(character)) return null;
  }
  return code;
}

export type DeviceCodeRow = {
  status: "pending" | "approved" | "denied" | "consumed";
  expires_at: string;
  interval_seconds: number;
  last_polled_at: string | null;
};

export type PollDecision =
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "consumed" }
  | { kind: "slow_down"; nextInterval: number }
  | { kind: "pending" }
  | { kind: "approved" };

/**
 * What the token endpoint answers a CLI polling with a device code.
 * `approved` is the only outcome that mints tokens; the caller must still
 * claim the row atomically (approved → consumed) before doing so.
 */
export function pollDecision(row: DeviceCodeRow, now: number): PollDecision {
  if (row.status === "consumed") return { kind: "consumed" };
  if (Date.parse(row.expires_at) <= now) return { kind: "expired" };
  if (row.status === "denied") return { kind: "denied" };
  if (row.status === "approved") return { kind: "approved" };
  const interval = Math.max(1, row.interval_seconds) * 1000;
  if (row.last_polled_at && now - Date.parse(row.last_polled_at) < interval) {
    return { kind: "slow_down", nextInterval: Math.min(row.interval_seconds + SLOW_DOWN_STEP_S, MAX_INTERVAL_S) };
  }
  return { kind: "pending" };
}
