import { NextResponse } from "next/server";

import { BRAND } from "@/brand";
import { OAUTH_SCOPES } from "@/lib/oauth/scopes";

/**
 * RFC 9728 protected-resource metadata: which authorization server protects
 * the CLI delivery API (`/api/cli`). A 401 from that API points here through
 * `WWW-Authenticate`; from here a client walks to the RFC 8414 metadata.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function GET() {
  return NextResponse.json(
    {
      resource: `${BRAND.siteUrl}/api/cli`,
      authorization_servers: [BRAND.siteUrl],
      scopes_supported: [...OAUTH_SCOPES],
      bearer_methods_supported: ["header"],
      resource_documentation: `${BRAND.siteUrl}/ajuda`,
    },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
