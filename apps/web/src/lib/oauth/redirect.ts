/**
 * Redirect targets of the OAuth server. Pure, so the rules are unit-tested
 * without a database.
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** `http://127.0.0.1:<port>/…` or `http://localhost:<port>/…`: where a native app listens. */
export function isLoopbackUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname) && !url.hash;
  } catch {
    return false;
  }
}

/**
 * A registered redirect target must be an absolute https URL (http only for
 * loopback), with no fragment and no wildcard.
 */
export function isValidRedirectUri(value: string): boolean {
  if (value.includes("*")) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return isLoopbackUri(value);
}

/**
 * Whether a presented redirect URI matches the client's registration.
 *
 * Exact match, always. A native client (`loopback_any_port`) listens on an
 * ephemeral port, so for it a LOOPBACK target also matches a registered
 * loopback target that differs only in the port (RFC 8252 §7.3): same scheme,
 * host, path and query. A web client never gets that allowance, and the port
 * rule never applies to anything that is not loopback.
 */
export function redirectUriMatches(
  registered: readonly string[],
  presented: string,
  loopbackAnyPort: boolean,
): boolean {
  if (!presented) return false;
  if (registered.includes(presented)) return true;
  if (!loopbackAnyPort || !isLoopbackUri(presented)) return false;
  const target = new URL(presented);
  return registered.some((entry) => {
    if (!isLoopbackUri(entry)) return false;
    const candidate = new URL(entry);
    return (
      candidate.protocol === target.protocol &&
      candidate.hostname === target.hostname &&
      candidate.pathname === target.pathname &&
      candidate.search === target.search
    );
  });
}
