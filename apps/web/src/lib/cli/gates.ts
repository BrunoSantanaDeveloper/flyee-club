import "server-only";

import { NextResponse } from "next/server";

import { BRAND } from "@/brand";
import { verifyUrl } from "@/lib/catalog/links";
import { type CliErrorCode, type CliLocale, cliMessage } from "@/lib/cli/messages";
import { hasScope, type OauthScope } from "@/lib/oauth/scopes";
import { type VerifiedAccess, verifyAccessToken } from "@/lib/oauth/server";
import { createServiceClient } from "@flyee/auth/service";
import { isTier, type Tier } from "@flyee/billing/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The gate pipeline every `/api/cli/*` call walks, in order (docs/CLI-CONTRACT.md):
 *
 *   token → scope → entitlement → device → rate → execute → trail
 *
 * Enforced here, in code, on every call: the CLI is untrusted input, and a
 * token minted while the workspace was entitled must stop working the moment
 * it is not (`org_entitlements` is read on every request, never cached in the
 * token). Every denial answers `{ error, message, action_url? }`, the message
 * in the member's language, and every call past the token lands as one
 * `cli_requests` row, which is also the rate window.
 */

export const DEVICE_HEADER = "x-flyee-device";

export type CliEntitlements = {
  active: boolean;
  suspended: boolean;
  tier: Tier | null;
  limits: Record<string, unknown>;
};

export type CliDevice = {
  id: string;
  deviceId: string;
  name: string | null;
  revokedAt: string | null;
  lastUpdateAt: string | null;
  tokenFamilyId: string | null;
};

export type CliRate = {
  allowed: boolean;
  downloadsAllowed: boolean;
  downloadsLimit: number;
};

export type CliContext = {
  service: SupabaseClient;
  auth: VerifiedAccess;
  entitlements: CliEntitlements;
  /** The live device named by the header, when there is one. */
  device: CliDevice | null;
  /** The raw header value (a device the CLI is about to register is not in the table yet). */
  deviceHeader: string | null;
  rate: CliRate | null;
  locale: CliLocale;
};

/** The `cli_requests.status` values (migration 0011). */
export type CliTrailStatus = "ok" | "denied_scope" | "denied_entitlement" | "denied_device" | "denied_rate" | "error";

export type CliOutcome =
  | { ok: true; body: unknown; status?: number }
  | {
      ok: false;
      status: number;
      code: CliErrorCode;
      actionUrl?: string;
      values?: Record<string, string | number>;
      extra?: Record<string, unknown>;
      trail?: CliTrailStatus;
    };

export type CliSpec = {
  /** Recorded in `cli_requests.endpoint` (≤ 60 characters). */
  endpoint: string;
  scope: OauthScope;
  /** `required`: the header must name a live device of the member. `optional`: checked when present. */
  device: "required" | "optional";
  /** Refuse an inactive workspace (default true). */
  requireActive?: boolean;
  /**
   * Let a revoked device through to the executor, whatever its token family.
   * Only the registration endpoint: a machine the member disconnected comes
   * back through a NEW login, and `register_member_device` revives it when the
   * token family differs (and refuses it when it does not). Elsewhere a newer
   * family passes as a machine not registered yet, and the old one is refused.
   */
  allowRevokedDevice?: boolean;
};

export type CliDeps = {
  createService: () => SupabaseClient;
  verifyToken: (service: SupabaseClient, token: string) => Promise<VerifiedAccess | null>;
  readEntitlements: (service: SupabaseClient, orgId: string) => Promise<CliEntitlements | null>;
  findDevice: (service: SupabaseClient, userId: string, deviceId: string) => Promise<CliDevice | null>;
  rateAllowance: (service: SupabaseClient, orgId: string) => Promise<CliRate | null>;
  memberLocale: (service: SupabaseClient, userId: string) => Promise<CliLocale>;
  recordRequest: (
    service: SupabaseClient,
    row: { orgId: string; tokenId: string; deviceId: string | null; endpoint: string; status: CliTrailStatus },
  ) => Promise<void>;
};

/** Absolute links the CLI prints. */
export const cliLinks = {
  billing: () => new URL("/settings/billing?source=cli", BRAND.siteUrl).toString(),
  devices: () => new URL("/settings/devices", BRAND.siteUrl).toString(),
  support: () => new URL("/contato", BRAND.siteUrl).toString(),
  /** The public verification page, in the member's language. */
  verify: (slug: string, version: string, locale: CliLocale = "pt-BR") => verifyUrl(slug, version, locale),
};

const NO_STORE = { "Cache-Control": "no-store" };

export function cliJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function cliError(
  code: CliErrorCode,
  status: number,
  locale: CliLocale,
  options: {
    actionUrl?: string;
    values?: Record<string, string | number>;
    extra?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  return cliJson(
    {
      error: code,
      message: cliMessage(code, locale, options.values),
      ...(options.actionUrl ? { action_url: options.actionUrl } : {}),
      ...options.extra,
    },
    status,
    options.headers,
  );
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export const defaultCliDeps: CliDeps = {
  createService: () => createServiceClient(),
  verifyToken: verifyAccessToken,
  async readEntitlements(service, orgId) {
    const { data, error } = await service.rpc("org_entitlements", { target_org: orgId });
    if (error || !data) return null;
    const raw = data as {
      active?: boolean;
      suspended?: boolean;
      tier?: string | null;
      limits?: Record<string, unknown>;
    };
    return {
      active: Boolean(raw.active),
      suspended: Boolean(raw.suspended),
      tier: isTier(raw.tier) ? raw.tier : null,
      limits: raw.limits ?? {},
    };
  },
  async findDevice(service, userId, deviceId) {
    const { data } = await service
      .from("member_devices")
      .select("id, device_id, name, revoked_at, last_update_at, token_family_id")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      deviceId: data.device_id as string,
      name: (data.name as string | null) ?? null,
      revokedAt: (data.revoked_at as string | null) ?? null,
      lastUpdateAt: (data.last_update_at as string | null) ?? null,
      tokenFamilyId: (data.token_family_id as string | null) ?? null,
    };
  },
  async rateAllowance(service, orgId) {
    const { data, error } = await service.rpc("cli_rate_allowance", { target_org: orgId });
    if (error || !data) return null;
    const raw = data as { allowed?: boolean; downloads_allowed?: boolean; downloads_limit?: number };
    return {
      allowed: raw.allowed !== false,
      downloadsAllowed: raw.downloads_allowed !== false,
      downloadsLimit: Number(raw.downloads_limit ?? 0),
    };
  },
  async memberLocale(service, userId) {
    const { data } = await service.from("profiles").select("locale").eq("id", userId).maybeSingle();
    return data?.locale === "en" ? "en" : "pt-BR";
  },
  async recordRequest(service, row) {
    try {
      await service.from("cli_requests").insert({
        org_id: row.orgId,
        token_id: row.tokenId,
        device_id: row.deviceId,
        endpoint: row.endpoint.slice(0, 60),
        status: row.status,
      });
    } catch (error) {
      console.error("[cli] request trail failed", error);
    }
  },
};

/** Which trail status an execution failure is recorded as, when the executor does not say. */
function trailFor(code: CliErrorCode): CliTrailStatus {
  switch (code) {
    case "denied_entitlement":
    case "not_entitled":
    case "suspended":
      return "denied_entitlement";
    case "device_required":
    case "device_unknown":
    case "device_revoked":
    case "device_mismatch":
    case "device_limit_reached":
      return "denied_device";
    case "rate_limited":
    case "download_limit":
      return "denied_rate";
    case "insufficient_scope":
      return "denied_scope";
    default:
      return "error";
  }
}

export async function runCliRequest(
  request: Request,
  spec: CliSpec,
  execute: (context: CliContext) => Promise<CliOutcome>,
  deps: CliDeps = defaultCliDeps,
): Promise<Response> {
  let service: SupabaseClient;
  try {
    service = deps.createService();
  } catch {
    return cliError("unavailable", 503, "pt-BR");
  }

  // 1. Token. No trail: without a valid token there is no workspace to file it under.
  const token = bearerToken(request);
  const auth = token ? await deps.verifyToken(service, token) : null;
  if (!auth) {
    return cliError("invalid_token", 401, "pt-BR", {
      headers: {
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${new URL("/.well-known/oauth-protected-resource", BRAND.siteUrl).toString()}"`,
      },
    });
  }

  const deviceHeader = request.headers.get(DEVICE_HEADER)?.trim() || null;
  const [locale, entitlements] = await Promise.all([
    deps.memberLocale(service, auth.userId),
    deps.readEntitlements(service, auth.orgId),
  ]);
  const trail = (status: CliTrailStatus) =>
    deps.recordRequest(service, {
      orgId: auth.orgId,
      tokenId: auth.tokenId,
      deviceId: deviceHeader ?? auth.deviceId,
      endpoint: spec.endpoint,
      status,
    });

  // 2. Scope.
  if (!hasScope(auth.scope, spec.scope)) {
    await trail("denied_scope");
    return cliError("insufficient_scope", 403, locale);
  }

  // 3. Entitlement, read fresh on every call.
  if (!entitlements) {
    await trail("error");
    return cliError("unavailable", 503, locale);
  }
  if ((spec.requireActive ?? true) && !entitlements.active) {
    await trail("denied_entitlement");
    return entitlements.suspended
      ? cliError("suspended", 403, locale, { actionUrl: cliLinks.support() })
      : cliError("not_entitled", 403, locale, { actionUrl: cliLinks.billing() });
  }

  // 4. Device. A chain bound to a machine only works from that machine.
  if (auth.deviceId && deviceHeader && deviceHeader !== auth.deviceId) {
    await trail("denied_device");
    return cliError("device_mismatch", 403, locale);
  }
  let device: CliDevice | null = null;
  if (deviceHeader) {
    device = await deps.findDevice(service, auth.userId, deviceHeader);
    if (device?.revokedAt && !spec.allowRevokedDevice) {
      // The row keeps the token family it had when it was disconnected, and that family stays refused.
      // A newer one comes from a new login the member approved: until POST /api/cli/installs revives
      // the row (register_member_device, the same rule), the machine is simply not registered yet.
      if (!auth.familyId || auth.familyId === device.tokenFamilyId) {
        await trail("denied_device");
        return cliError("device_revoked", 403, locale);
      }
      device = null;
    }
  }
  if (spec.device === "required") {
    if (!deviceHeader) {
      await trail("denied_device");
      return cliError("device_required", 400, locale);
    }
    if (!device) {
      await trail("denied_device");
      return cliError("device_unknown", 403, locale);
    }
  }

  // 5. Rate: a runaway loop hits this wall, not the database.
  const rate = await deps.rateAllowance(service, auth.orgId);
  if (rate && !rate.allowed) {
    await trail("denied_rate");
    return cliError("rate_limited", 429, locale, { headers: { "Retry-After": "60" } });
  }

  // 6. Execute.
  let outcome: CliOutcome;
  try {
    outcome = await execute({ service, auth, entitlements, device, deviceHeader, rate, locale });
  } catch (error) {
    console.error(`[cli] ${spec.endpoint} failed`, error);
    outcome = { ok: false, status: 500, code: "unavailable", trail: "error" };
  }

  // 7. Trail.
  if (!outcome.ok) {
    await trail(outcome.trail ?? trailFor(outcome.code));
    return cliError(outcome.code, outcome.status, locale, {
      actionUrl: outcome.actionUrl,
      values: outcome.values,
      extra: outcome.extra,
    });
  }
  await trail("ok");
  return cliJson(outcome.body, outcome.status ?? 200);
}
