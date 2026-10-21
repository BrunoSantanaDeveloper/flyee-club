import { NextResponse } from "next/server";

import { clientCredentials, OAUTH_NO_STORE, oauthError, oauthPreflight, readOauthParams } from "@/lib/oauth/http";
import { startDeviceAuthorization } from "@/lib/oauth/server";
import { createServiceClient } from "@flyee/auth/service";

/**
 * Device authorization endpoint (RFC 8628 §3.1): `npx flyee login --device`
 * on a machine without a browser. Answers the code pair; the member approves
 * the short code at `/ativar` on any device while the CLI polls the token
 * endpoint. `device_id` (our extension) names the machine, like the browser
 * flow's authorize parameter. `cloud=claude_code` (since migration 0044) marks a
 * Claude Code session in the cloud, so /ativar does not ask it to disconnect a
 * computer: a cloud session takes the account's cloud place.
 */
export async function POST(request: Request) {
  const params = await readOauthParams(request);
  if (!params) return oauthError("invalid_request", "Unreadable request body.");

  const { clientId } = clientCredentials(request, params);
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);

  let service;
  try {
    service = createServiceClient();
  } catch {
    return oauthError("temporarily_unavailable", "Device authorization is not configured.", 503);
  }

  const result = await startDeviceAuthorization(service, {
    clientId,
    scope: params.scope ?? null,
    deviceId: params.device_id || null,
    cloud: params.cloud || null,
  });
  if (!result.ok) {
    return oauthError(result.error, result.description, result.error === "invalid_client" ? 401 : 400);
  }
  return NextResponse.json(result.authorization, { headers: OAUTH_NO_STORE });
}

export function OPTIONS() {
  return oauthPreflight();
}
