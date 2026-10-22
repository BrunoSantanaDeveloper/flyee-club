import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { BRAND } from "@/brand";
import {
  DEVICE_CODE_TTL_S,
  DEVICE_POLL_INTERVAL_S,
  type DeviceCodeRow,
  formatUserCode,
  generateUserCode,
  pollDecision,
} from "@/lib/oauth/device-code";
import { resolveRequestedScopes, scopesToParam } from "@/lib/oauth/scopes";
import { chainLapsed, daysSinceBucket } from "@/lib/oauth/token-rules";
import { trackServerEvent } from "@/lib/product-events-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The OAuth 2.1 authorization server that issues member tokens to the flyee
 * CLI (migration 0010, docs/CLI-CONTRACT.md).
 *
 * Two ways in, one token family per machine:
 *  - authorization code + PKCE through the browser, with the CLI listening on
 *    a loopback port (`npx flyee login`);
 *  - the device authorization grant (RFC 8628) for a machine without a
 *    browser: the CLI prints a short code the member approves at /ativar.
 *
 * Tokens are opaque: the raw secret travels once and only its SHA-256 lands in
 * the database, so validation is a lookup and revocation is immediate. The
 * refresh token rotates on every use and lives 30 days, which is the
 * revalidation rule itself: a machine that never updates for 30 days has to
 * come back and approve again.
 */

/** Authorization codes: one redirect's lifetime. */
export const OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
/** Access tokens: short, so a leaked one dies within the hour. */
export const OAUTH_ACCESS_TTL_S = 60 * 60;
/** Refresh tokens: rotated on every use; 30 days without one is the revalidation. */
export const OAUTH_REFRESH_TTL_S = 30 * 24 * 60 * 60;

/** The id the CLI generates once per machine; the same rule as `member_devices.device_id`. */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export const isDeviceId = (value: unknown): value is string =>
  typeof value === "string" && DEVICE_ID_PATTERN.test(value);

export type OauthClientRow = {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  client_secret_hash: string | null;
  client_uri: string | null;
  logo_uri: string | null;
  /** Ours (the CLI): device flow, revalidation screen and token events apply. */
  first_party: boolean;
  /** Native client: a loopback redirect matches on any port (RFC 8252 §7.3). */
  loopback_any_port: boolean;
};

const CLIENT_COLUMNS =
  "id, client_id, client_name, redirect_uris, token_endpoint_auth_method, client_secret_hash, client_uri, logo_uri, first_party, loopback_any_port";

export function hashOauthSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function mintSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function timingSafeHashEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getOauthClient(service: SupabaseClient, clientId: string): Promise<OauthClientRow | null> {
  if (!clientId) return null;
  const { data } = await service.from("oauth_clients").select(CLIENT_COLUMNS).eq("client_id", clientId).maybeSingle();
  return (data as OauthClientRow | null) ?? null;
}

/** Confidential clients must present their secret; public clients must not have one. */
function verifyClientSecret(client: OauthClientRow, presented: string | null): boolean {
  if (client.token_endpoint_auth_method === "none") return true;
  if (!client.client_secret_hash || !presented) return false;
  return timingSafeHashEquals(client.client_secret_hash, hashOauthSecret(presented));
}

/** Where a member reads why a machine's connection lapsed (the token endpoint's `error_uri`). */
export function revalidationUrl(deviceId: string | null | undefined): string {
  const url = new URL("/revalidar", BRAND.siteUrl);
  if (deviceId) url.searchParams.set("d", deviceId);
  return url.toString();
}

/** Days since a machine last updated (or was last seen), as a product_events bucket; undefined when unknown. */
async function deviceUpdateBucket(service: SupabaseClient, userId: string, deviceId: string | null) {
  if (!deviceId) return undefined;
  const { data } = await service
    .from("member_devices")
    .select("last_update_at, last_seen_at")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();
  const reference = (data?.last_update_at ?? data?.last_seen_at) as string | null | undefined;
  if (!reference) return undefined;
  return daysSinceBucket(Math.floor((Date.now() - Date.parse(reference)) / 86_400_000));
}

/** Mint the single-use authorization code after the member approves. */
export async function issueAuthorizationCode(
  service: SupabaseClient,
  input: {
    clientRowId: string;
    orgId: string;
    userId: string;
    codeChallenge: string;
    redirectUri: string;
    scope: string;
    deviceId?: string | null;
  },
): Promise<{ ok: true; code: string } | { ok: false; description: string }> {
  const code = mintSecret("mcc");
  const { error } = await service.from("oauth_grants").insert({
    client_id: input.clientRowId,
    org_id: input.orgId,
    user_id: input.userId,
    code_hash: hashOauthSecret(code),
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: input.redirectUri,
    scope: input.scope,
    device_id: isDeviceId(input.deviceId) ? input.deviceId : null,
    expires_at: new Date(Date.now() + OAUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) return { ok: false, description: error.message };
  return { ok: true, code };
}

export type TokenPair = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  /** Seconds until this machine must revalidate if it never refreshes (30 days). */
  refresh_token_expires_in: number;
  scope: string;
};

export type TokenErrorCode =
  | "invalid_client"
  | "invalid_grant"
  | "invalid_request"
  | "authorization_pending"
  | "slow_down"
  | "access_denied"
  | "expired_token";

export type TokenError = { ok: false; error: TokenErrorCode; description: string; errorUri?: string };
export type TokenResult = ({ ok: true } & TokenPair) | TokenError;

async function mintTokenPair(
  service: SupabaseClient,
  input: {
    clientRowId: string;
    orgId: string;
    userId: string;
    scope: string;
    /** Continue a family (refresh rotation); a new login starts a new one. */
    familyId?: string | null;
    deviceId?: string | null;
  },
): Promise<TokenResult> {
  const accessToken = mintSecret("mcat");
  const refreshToken = mintSecret("mcrt");
  const now = Date.now();
  const { error } = await service.from("oauth_tokens").insert({
    client_id: input.clientRowId,
    org_id: input.orgId,
    user_id: input.userId,
    access_token_hash: hashOauthSecret(accessToken),
    refresh_token_hash: hashOauthSecret(refreshToken),
    scope: input.scope,
    ...(input.familyId ? { family_id: input.familyId } : {}),
    device_id: isDeviceId(input.deviceId) ? input.deviceId : null,
    access_expires_at: new Date(now + OAUTH_ACCESS_TTL_S * 1000).toISOString(),
    refresh_expires_at: new Date(now + OAUTH_REFRESH_TTL_S * 1000).toISOString(),
  });
  if (error) return { ok: false, error: "invalid_request", description: error.message };
  return {
    ok: true,
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TTL_S,
    refresh_token: refreshToken,
    refresh_token_expires_in: OAUTH_REFRESH_TTL_S,
    scope: input.scope,
  };
}

/**
 * A login on a machine, through either grant. Retires that machine's previous
 * chain (one live family per machine) and records whether this was a login or
 * a revalidation of a lapsed machine.
 */
async function startFamily(
  service: SupabaseClient,
  client: OauthClientRow,
  input: { orgId: string; userId: string; scope: string; deviceId: string | null },
): Promise<TokenResult> {
  let revalidation = false;
  if (input.deviceId) {
    const { data: previous } = await service
      .from("oauth_tokens")
      .select("revoked_at, refresh_expires_at")
      .eq("client_id", client.id)
      .eq("user_id", input.userId)
      .eq("device_id", input.deviceId)
      .order("created_at", { ascending: false })
      .limit(50);
    revalidation = chainLapsed((previous ?? []) as { revoked_at: string | null; refresh_expires_at: string | null }[]);
    await service
      .from("oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", client.id)
      .eq("user_id", input.userId)
      .eq("device_id", input.deviceId)
      .is("revoked_at", null);
  }

  const pair = await mintTokenPair(service, {
    clientRowId: client.id,
    orgId: input.orgId,
    userId: input.userId,
    scope: input.scope,
    deviceId: input.deviceId,
  });

  if (pair.ok && client.first_party) {
    const bucket = revalidation ? await deviceUpdateBucket(service, input.userId, input.deviceId) : undefined;
    await trackServerEvent({
      actorId: input.userId,
      orgId: input.orgId,
      event: revalidation ? "token.revalidated" : "cli.login",
      properties: bucket ? { days_since_update: bucket } : {},
    });
  }
  return pair;
}

/** authorization_code exchange: PKCE S256, single use, exact redirect match. */
export async function exchangeAuthorizationCode(
  service: SupabaseClient,
  input: { clientId: string; clientSecret: string | null; code: string; codeVerifier: string; redirectUri: string },
): Promise<TokenResult> {
  const client = await getOauthClient(service, input.clientId);
  if (!client || !verifyClientSecret(client, input.clientSecret)) {
    return { ok: false, error: "invalid_client", description: "Unknown client or bad credentials." };
  }
  if (!input.code || !input.codeVerifier) {
    return { ok: false, error: "invalid_request", description: "code and code_verifier are required." };
  }

  const { data: grant } = await service
    .from("oauth_grants")
    .select("id, client_id, org_id, user_id, code_challenge, redirect_uri, scope, device_id, expires_at, consumed_at")
    .eq("code_hash", hashOauthSecret(input.code))
    .maybeSingle();

  if (!grant || grant.client_id !== client.id) {
    return { ok: false, error: "invalid_grant", description: "Unknown authorization code." };
  }
  if (grant.consumed_at || new Date(grant.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "invalid_grant", description: "Authorization code expired or already used." };
  }
  // Identical to the authorization request, port included (RFC 6749 §4.1.3).
  if (grant.redirect_uri !== input.redirectUri) {
    return { ok: false, error: "invalid_grant", description: "redirect_uri does not match the authorization request." };
  }
  const challenge = createHash("sha256").update(input.codeVerifier, "utf8").digest("base64url");
  if (challenge !== grant.code_challenge) {
    return { ok: false, error: "invalid_grant", description: "PKCE verification failed." };
  }

  // Single use is enforced by the WHERE: a raced duplicate exchange finds the
  // row already consumed and gets nothing.
  const { data: consumed } = await service
    .from("oauth_grants")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", grant.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (!consumed) {
    return { ok: false, error: "invalid_grant", description: "Authorization code expired or already used." };
  }

  return startFamily(service, client, {
    orgId: grant.org_id as string,
    userId: grant.user_id as string,
    scope: grant.scope as string,
    deviceId: (grant.device_id as string | null) ?? null,
  });
}

/** Kills one machine's chain: every token of the family. */
async function revokeFamily(service: SupabaseClient, familyId: string) {
  await service
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("family_id", familyId)
    .is("revoked_at", null);
}

/**
 * refresh_token grant with rotation (`npx flyee update` refreshes first).
 *
 * - An expired refresh token is the 30-day rule: the answer carries the
 *   revalidation page as `error_uri` and the CLI starts a new login.
 * - Presenting an ALREADY-ROTATED (or revoked) refresh token is the signature
 *   of a stolen token being replayed: the whole family is revoked (RFC 9700).
 *   Only that machine's chain, never the member's other machines.
 */
export async function refreshAccessToken(
  service: SupabaseClient,
  input: { clientId: string; clientSecret: string | null; refreshToken: string },
): Promise<TokenResult> {
  const client = await getOauthClient(service, input.clientId);
  if (!client || !verifyClientSecret(client, input.clientSecret)) {
    return { ok: false, error: "invalid_client", description: "Unknown client or bad credentials." };
  }
  if (!input.refreshToken) {
    return { ok: false, error: "invalid_request", description: "refresh_token is required." };
  }

  const { data: row } = await service
    .from("oauth_tokens")
    .select("id, client_id, org_id, user_id, scope, family_id, device_id, refresh_expires_at, revoked_at")
    .eq("refresh_token_hash", hashOauthSecret(input.refreshToken))
    .maybeSingle();

  if (!row || row.client_id !== client.id) {
    return { ok: false, error: "invalid_grant", description: "Unknown refresh token." };
  }
  const deviceId = (row.device_id as string | null) ?? null;
  const lapsed = { errorUri: revalidationUrl(deviceId) };

  if (row.revoked_at) {
    await revokeFamily(service, row.family_id as string);
    return {
      ok: false,
      error: "invalid_grant",
      description: "This connection was revoked or the refresh token was reused. Sign in again.",
      ...lapsed,
    };
  }
  if (!row.refresh_expires_at || new Date(row.refresh_expires_at as string).getTime() < Date.now()) {
    if (client.first_party) {
      const bucket = await deviceUpdateBucket(service, row.user_id as string, deviceId);
      await trackServerEvent({
        actorId: row.user_id as string,
        orgId: row.org_id as string,
        event: "update.denied_token_expired",
        properties: { reason: "token_expired", ...(bucket ? { days_since_update: bucket } : {}) },
      });
    }
    return {
      ok: false,
      error: "invalid_grant",
      description: "Thirty days without an update: revalidate this machine.",
      ...lapsed,
    };
  }

  // Rotation is claimed atomically: of two refreshes racing with the same
  // token, one rotates and the other is treated as the replay it looks like.
  const { data: rotated } = await service
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (!rotated) {
    await revokeFamily(service, row.family_id as string);
    return {
      ok: false,
      error: "invalid_grant",
      description: "Refresh token reuse detected; sign in again.",
      ...lapsed,
    };
  }

  return mintTokenPair(service, {
    clientRowId: client.id,
    orgId: row.org_id as string,
    userId: row.user_id as string,
    scope: row.scope as string,
    familyId: row.family_id as string,
    deviceId,
  });
}

// ---------- Device authorization grant (RFC 8628) ----------

export type DeviceAuthorization = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

/** POST /api/oauth/device: a code pair for a machine without a browser. First-party clients only. */
export async function startDeviceAuthorization(
  service: SupabaseClient,
  input: { clientId: string; scope: string | null; deviceId: string | null; cloud?: string | null },
): Promise<{ ok: true; authorization: DeviceAuthorization } | TokenError> {
  const client = await getOauthClient(service, input.clientId);
  if (!client || !client.first_party || client.token_endpoint_auth_method !== "none") {
    return { ok: false, error: "invalid_client", description: "This client cannot use the device flow." };
  }
  if (input.deviceId && !isDeviceId(input.deviceId)) {
    return { ok: false, error: "invalid_request", description: "device_id must be 8 to 64 letters, digits, - or _." };
  }
  if (input.cloud && input.cloud !== "claude_code") {
    return { ok: false, error: "invalid_request", description: "cloud is claude_code or absent." };
  }

  const deviceCode = mintSecret("mcdc");
  const scope = scopesToParam(resolveRequestedScopes(input.scope));
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_S * 1000).toISOString();

  // The user code is short, so a collision is possible in principle; the
  // unique index refuses it and a fresh code is drawn.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userCode = generateUserCode();
    const { error } = await service.from("oauth_device_codes").insert({
      client_id: client.id,
      device_code_hash: hashOauthSecret(deviceCode),
      user_code: userCode,
      scope,
      device_id: input.deviceId,
      cloud: input.cloud || null,
      expires_at: expiresAt,
      interval_seconds: DEVICE_POLL_INTERVAL_S,
    });
    if (!error) {
      const verification = new URL("/ativar", BRAND.siteUrl).toString();
      const complete = new URL("/ativar", BRAND.siteUrl);
      complete.searchParams.set("code", formatUserCode(userCode));
      return {
        ok: true,
        authorization: {
          device_code: deviceCode,
          user_code: formatUserCode(userCode),
          verification_uri: verification,
          verification_uri_complete: complete.toString(),
          expires_in: DEVICE_CODE_TTL_S,
          interval: DEVICE_POLL_INTERVAL_S,
        },
      };
    }
    if (error.code !== "23505") break;
  }
  return { ok: false, error: "invalid_request", description: "Could not start the device authorization." };
}

export type PendingDeviceCode = {
  id: string;
  userCode: string;
  scope: string;
  deviceId: string | null;
  /** `claude_code` when a Claude Code session in the cloud asked for the code (migration 0044). */
  cloud: string | null;
  expiresAt: string;
  client: Pick<OauthClientRow, "id" | "client_id" | "client_name" | "first_party">;
};

/** The code a member typed at /ativar, if it is still waiting for an answer. */
export async function findPendingDeviceCode(
  service: SupabaseClient,
  userCode: string,
): Promise<PendingDeviceCode | null> {
  const { data } = await service
    .from("oauth_device_codes")
    .select(
      "id, user_code, scope, device_id, cloud, expires_at, status, oauth_clients(id, client_id, client_name, first_party)",
    )
    .eq("user_code", userCode)
    .maybeSingle();
  if (!data || data.status !== "pending" || Date.parse(data.expires_at as string) <= Date.now()) return null;
  type ClientRel = Pick<OauthClientRow, "id" | "client_id" | "client_name" | "first_party">;
  const rel = data.oauth_clients as ClientRel | ClientRel[] | null;
  const client = Array.isArray(rel) ? rel[0] : rel;
  if (!client) return null;
  return {
    id: data.id as string,
    userCode: data.user_code as string,
    scope: data.scope as string,
    deviceId: (data.device_id as string | null) ?? null,
    cloud: (data.cloud as string | null) ?? null,
    expiresAt: data.expires_at as string,
    client,
  };
}

/** The member's answer at /ativar. Only a pending, unexpired code changes. */
export async function answerDeviceCode(
  service: SupabaseClient,
  input: { userCode: string; approve: boolean; userId: string; orgId: string },
): Promise<boolean> {
  const { data } = await service
    .from("oauth_device_codes")
    .update(
      input.approve
        ? { status: "approved", user_id: input.userId, org_id: input.orgId, approved_at: new Date().toISOString() }
        : { status: "denied" },
    )
    .eq("user_code", input.userCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

/** Token endpoint, `urn:ietf:params:oauth:grant-type:device_code`: what a polling CLI is told. */
export async function exchangeDeviceCode(
  service: SupabaseClient,
  input: { clientId: string; deviceCode: string },
): Promise<TokenResult> {
  const client = await getOauthClient(service, input.clientId);
  if (!client || !client.first_party) {
    return { ok: false, error: "invalid_client", description: "Unknown client." };
  }
  if (!input.deviceCode) {
    return { ok: false, error: "invalid_request", description: "device_code is required." };
  }

  const { data: row } = await service
    .from("oauth_device_codes")
    .select("id, client_id, scope, device_id, status, expires_at, interval_seconds, last_polled_at, user_id, org_id")
    .eq("device_code_hash", hashOauthSecret(input.deviceCode))
    .maybeSingle();
  if (!row || row.client_id !== client.id) {
    return { ok: false, error: "invalid_grant", description: "Unknown device code." };
  }

  const decision = pollDecision(row as unknown as DeviceCodeRow, Date.now());
  const now = new Date().toISOString();
  switch (decision.kind) {
    case "consumed":
      return { ok: false, error: "invalid_grant", description: "This device code was already used." };
    case "expired":
      return { ok: false, error: "expired_token", description: "The code expired. A new login gives a new one." };
    case "denied":
      return { ok: false, error: "access_denied", description: "The member denied the request." };
    case "slow_down":
      await service
        .from("oauth_device_codes")
        .update({ interval_seconds: decision.nextInterval, last_polled_at: now })
        .eq("id", row.id);
      return { ok: false, error: "slow_down", description: `Poll every ${decision.nextInterval} seconds at most.` };
    case "pending":
      await service.from("oauth_device_codes").update({ last_polled_at: now }).eq("id", row.id);
      return { ok: false, error: "authorization_pending", description: "Waiting for the member to approve." };
    case "approved": {
      const { data: claimed } = await service
        .from("oauth_device_codes")
        .update({ status: "consumed", last_polled_at: now })
        .eq("id", row.id)
        .eq("status", "approved")
        .select("user_id, org_id")
        .maybeSingle();
      if (!claimed?.user_id || !claimed.org_id) {
        return { ok: false, error: "invalid_grant", description: "This device code was already used." };
      }
      return startFamily(service, client, {
        orgId: claimed.org_id as string,
        userId: claimed.user_id as string,
        scope: row.scope as string,
        deviceId: (row.device_id as string | null) ?? null,
      });
    }
  }
}

/**
 * Token revocation (RFC 7009), `npx flyee logout`: the presented token's whole
 * family goes. Unknown tokens are not an error, by the spec.
 */
export async function revokeToken(service: SupabaseClient, input: { clientId: string; token: string }): Promise<void> {
  const client = await getOauthClient(service, input.clientId);
  if (!client || !input.token) return;
  const hash = hashOauthSecret(input.token);
  const column = input.token.startsWith("mcrt_") ? "refresh_token_hash" : "access_token_hash";
  const { data: row } = await service
    .from("oauth_tokens")
    .select("family_id, client_id")
    .eq(column, hash)
    .maybeSingle();
  if (!row || row.client_id !== client.id) return;
  await revokeFamily(service, row.family_id as string);
}

export type VerifiedAccess = {
  tokenId: string;
  orgId: string;
  userId: string;
  scope: string;
  /** The OAuth client_id string (not the row uuid). */
  clientId: string;
  clientName: string;
  firstParty: boolean;
  familyId: string;
  /** The machine this chain belongs to, when the login named one. */
  deviceId: string | null;
  /** When this chain lapses if it is never refreshed. */
  refreshExpiresAt: string | null;
};

/** Bearer validation for /api/cli: live row, not revoked, not expired. */
export async function verifyAccessToken(service: SupabaseClient, token: string): Promise<VerifiedAccess | null> {
  if (!token || !token.startsWith("mcat_")) return null;
  const { data } = await service
    .from("oauth_tokens")
    .select(
      "id, org_id, user_id, scope, family_id, device_id, access_expires_at, refresh_expires_at, revoked_at, oauth_clients(client_id, client_name, first_party)",
    )
    .eq("access_token_hash", hashOauthSecret(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (new Date(data.access_expires_at as string).getTime() < Date.now()) return null;

  // Best-effort freshness stamp: the devices screen shows it.
  void service
    .from("oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  type ClientRel = { client_id?: string; client_name?: string; first_party?: boolean };
  const clientRel = data.oauth_clients as ClientRel | ClientRel[] | null;
  const client = Array.isArray(clientRel) ? clientRel[0] : clientRel;
  return {
    tokenId: data.id as string,
    orgId: data.org_id as string,
    userId: data.user_id as string,
    scope: data.scope as string,
    clientId: client?.client_id ?? "",
    clientName: client?.client_name || "flyee CLI",
    firstParty: Boolean(client?.first_party),
    familyId: data.family_id as string,
    deviceId: (data.device_id as string | null) ?? null,
    refreshExpiresAt: (data.refresh_expires_at as string | null) ?? null,
  };
}
