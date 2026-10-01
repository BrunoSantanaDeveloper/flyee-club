import { NextResponse } from "next/server";

import { BRAND } from "@/brand";
import { OAUTH_SCOPES } from "@/lib/oauth/scopes";

/**
 * RFC 8414 authorization-server metadata: how the flyee CLI discovers where
 * to authorize, exchange, poll and revoke (docs/CLI-CONTRACT.md). Values derive
 * from BRAND.siteUrl, so a preview deployment advertises itself, never
 * production. Dynamic registration is not offered: the CLI is the only client.
 *
 * CORS is permissive: metadata is public by definition.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function GET() {
  const issuer = BRAND.siteUrl;
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      device_authorization_endpoint: `${issuer}/api/oauth/device`,
      revocation_endpoint: `${issuer}/api/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:device_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [...OAUTH_SCOPES],
      service_documentation: `${issuer}/ajuda`,
    },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
