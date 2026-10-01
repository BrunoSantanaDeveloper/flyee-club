/**
 * Pure rules about token chains, shared by the token server and the
 * revalidation screens (and unit-tested without a database).
 */

/**
 * Whether a machine's chain lapsed: it held tokens before and none is live
 * now (revoked, or its refresh expired after 30 days without an update). A
 * login on such a machine is a revalidation; a login while a chain is still
 * live is just a new login.
 */
export function chainLapsed(
  tokens: readonly { revoked_at: string | null; refresh_expires_at: string | null }[],
  now = Date.now(),
): boolean {
  if (tokens.length === 0) return false;
  return !tokens.some(
    (token) => !token.revoked_at && token.refresh_expires_at !== null && Date.parse(token.refresh_expires_at) > now,
  );
}

/** The bucket `product_events` stores for "days since the last update" (product_event_sanitize). */
export function daysSinceBucket(days: number): string {
  if (days <= 7) return "0_7";
  if (days <= 14) return "8_14";
  if (days <= 24) return "15_24";
  if (days <= 30) return "25_30";
  return "31_plus";
}
