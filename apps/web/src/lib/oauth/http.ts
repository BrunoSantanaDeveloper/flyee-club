import "server-only";

import { NextResponse } from "next/server";

/**
 * Request and response shapes the OAuth endpoints share: form-encoded bodies
 * per the specs (JSON tolerated), HTTP Basic for confidential clients, errors
 * as `{ error, error_description, error_uri }` and never cached.
 */

export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OAUTH_NO_STORE = { ...OAUTH_CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" };

export function oauthError(error: string, description: string, status = 400, errorUri?: string) {
  return NextResponse.json(
    { error, error_description: description, ...(errorUri ? { error_uri: errorUri } : {}) },
    { status, headers: OAUTH_NO_STORE },
  );
}

export async function readOauthParams(request: Request): Promise<Record<string, string> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(body).filter(([, value]) => typeof value === "string")) as Record<
        string,
        string
      >;
    }
    const form = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params[key] = value;
    }
    return params;
  } catch {
    return null;
  }
}

/** The client's credentials: HTTP Basic (client_secret_basic) first, then the body. */
export function clientCredentials(
  request: Request,
  params: Record<string, string>,
): { clientId: string; clientSecret: string | null } {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        };
      }
    } catch {
      // Fall through to the body.
    }
  }
  return { clientId: params.client_id ?? "", clientSecret: params.client_secret ?? null };
}

export function oauthPreflight() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}
