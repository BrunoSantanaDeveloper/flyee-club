import { NextResponse } from "next/server";

import { clientCredentials, OAUTH_NO_STORE, oauthError, oauthPreflight, readOauthParams } from "@/lib/oauth/http";
import {
  exchangeAuthorizationCode,
  exchangeDeviceCode,
  refreshAccessToken,
  type TokenResult,
} from "@/lib/oauth/server";
import { createServiceClient } from "@flyee/auth/service";

/**
 * OAuth 2.1 token endpoint for the flyee CLI (docs/CLI-CONTRACT.md):
 *
 *  - `authorization_code`: PKCE S256, single-use code (browser login);
 *  - `urn:ietf:params:oauth:grant-type:device_code`: the polling half of the
 *    device flow (RFC 8628), answering `authorization_pending`, `slow_down`,
 *    `access_denied` or `expired_token` until the member decides;
 *  - `refresh_token`: rotation. An expired or revoked refresh token answers
 *    `invalid_grant` with `error_uri` pointing at the revalidation page.
 *
 * All grant logic lives in lib/oauth/server.ts; this route parses requests.
 */

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export async function POST(request: Request) {
  const params = await readOauthParams(request);
  if (!params) return oauthError("invalid_request", "Unreadable request body.");

  const { clientId, clientSecret } = clientCredentials(request, params);
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);

  let service;
  try {
    service = createServiceClient();
  } catch {
    return oauthError("temporarily_unavailable", "Token endpoint is not configured.", 503);
  }

  const grantType = params.grant_type ?? "";
  let result: TokenResult | null = null;
  if (grantType === "authorization_code") {
    result = await exchangeAuthorizationCode(service, {
      clientId,
      clientSecret,
      code: params.code ?? "",
      codeVerifier: params.code_verifier ?? "",
      redirectUri: params.redirect_uri ?? "",
    });
  } else if (grantType === DEVICE_GRANT) {
    result = await exchangeDeviceCode(service, { clientId, deviceCode: params.device_code ?? "" });
  } else if (grantType === "refresh_token") {
    result = await refreshAccessToken(service, { clientId, clientSecret, refreshToken: params.refresh_token ?? "" });
  }

  if (!result) {
    return oauthError("unsupported_grant_type", `Use authorization_code, refresh_token or ${DEVICE_GRANT}.`);
  }
  if (!result.ok) {
    return oauthError(result.error, result.description, result.error === "invalid_client" ? 401 : 400, result.errorUri);
  }

  return NextResponse.json(
    {
      access_token: result.access_token,
      token_type: result.token_type,
      expires_in: result.expires_in,
      refresh_token: result.refresh_token,
      refresh_token_expires_in: result.refresh_token_expires_in,
      scope: result.scope,
    },
    { headers: OAUTH_NO_STORE },
  );
}

export function OPTIONS() {
  return oauthPreflight();
}
