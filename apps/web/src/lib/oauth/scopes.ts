/**
 * OAuth scopes of the CLI delivery API (docs/CLI-CONTRACT.md). Pure constants,
 * imported by server code AND by the consent screens (client-safe).
 *
 * The CLI asks for all four. A client that asks for nothing specific gets the
 * full set too, so `npx flyee login` never has to spell them out.
 */

export const OAUTH_SCOPES = ["profile:read", "catalog:read", "modules:download", "telemetry:write"] as const;

export type OauthScope = (typeof OAUTH_SCOPES)[number];

/** Parse a space-separated scope string into the supported subset (empty/absent → all). */
export function resolveRequestedScopes(scopeParam: string | null | undefined): OauthScope[] {
  const requested = (scopeParam ?? "")
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (requested.length === 0) return [...OAUTH_SCOPES];
  const supported = requested.filter((entry): entry is OauthScope =>
    (OAUTH_SCOPES as readonly string[]).includes(entry),
  );
  return supported.length > 0 ? supported : [...OAUTH_SCOPES];
}

export function scopesToParam(scopes: readonly OauthScope[]): string {
  return scopes.join(" ");
}

export function hasScope(scope: string, wanted: OauthScope): boolean {
  return scope.split(/\s+/u).includes(wanted);
}

/** i18n keys (product namespace) describing each scope in plain language. */
export const SCOPE_LABEL_KEYS: Record<OauthScope, string> = {
  "profile:read": "oauth-scope-profile",
  "catalog:read": "oauth-scope-catalog",
  "modules:download": "oauth-scope-download",
  "telemetry:write": "oauth-scope-telemetry",
};
