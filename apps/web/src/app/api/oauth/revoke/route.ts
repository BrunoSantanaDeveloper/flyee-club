import { clientCredentials, OAUTH_NO_STORE, oauthError, oauthPreflight, readOauthParams } from "@/lib/oauth/http";
import { revokeToken } from "@/lib/oauth/server";
import { createServiceClient } from "@flyee/auth/service";

/**
 * Token revocation (RFC 7009), `npx flyee logout`: the presented access or
 * refresh token's whole family is revoked, so this machine is signed out.
 * Answers 200 for an unknown token too, as the spec requires: the endpoint
 * never confirms whether a token existed.
 */
export async function POST(request: Request) {
  const params = await readOauthParams(request);
  if (!params) return oauthError("invalid_request", "Unreadable request body.");

  const { clientId } = clientCredentials(request, params);
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);
  if (!params.token) return oauthError("invalid_request", "token is required.");

  let service;
  try {
    service = createServiceClient();
  } catch {
    return oauthError("temporarily_unavailable", "Revocation is not configured.", 503);
  }

  await revokeToken(service, { clientId, token: params.token });
  return new Response(null, { status: 200, headers: OAUTH_NO_STORE });
}

export function OPTIONS() {
  return oauthPreflight();
}
