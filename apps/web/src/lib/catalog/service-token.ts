import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The service token: how the product's CI sends apps to the catalog without a
 * person signed in (docs/CLI-CONTRACT.md, section 10). One secret, in the
 * environment of both sides under the same name, FLYEE_SERVICE_TOKEN. It can
 * create and update modules from the product's index and upload draft
 * versions; it never publishes, retracts or archives anything, which stays a
 * deliberate act in /admin/catalogo.
 */

/** Shorter than this, the token is refused as not configured: a guessable secret opens the catalog. */
export const SERVICE_TOKEN_MIN_LENGTH = 32;

export type ServiceTokenCheck = { ok: true } | { ok: false; status: 401 | 503; error: string };

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Whether an `Authorization` header carries the configured token. Both sides
 * are hashed first, so the comparison takes the same time for any input.
 */
export function checkServiceToken(
  authorization: string | null,
  configured: string | undefined = process.env.FLYEE_SERVICE_TOKEN,
): ServiceTokenCheck {
  const expected = configured?.trim() ?? "";
  if (expected.length < SERVICE_TOKEN_MIN_LENGTH) {
    return { ok: false, status: 503, error: "service_token_not_configured" };
  }
  const match = /^Bearer\s+(\S+)\s*$/iu.exec(authorization ?? "");
  if (!match) return { ok: false, status: 401, error: "missing_service_token" };
  return timingSafeEqual(digest(match[1]), digest(expected))
    ? { ok: true }
    : { ok: false, status: 401, error: "invalid_service_token" };
}
