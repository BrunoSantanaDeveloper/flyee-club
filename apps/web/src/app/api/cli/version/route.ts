import { NextResponse } from "next/server";

import { cliVersionBody, DEFAULT_CLI_SETTINGS, readCliSettings } from "@/lib/cli/settings";
import { createServiceClient } from "@flyee/auth/service";

/**
 * GET /api/cli/version: public, unauthenticated. The oldest CLI still served,
 * the newest core, deprecation notices, so `npx flyee` can tell a member to
 * update before anything fails, and the address of an app's public page for
 * the person who runs `npx flyee add` without a connection
 * (docs/CLI-CONTRACT.md 4.9).
 */
export async function GET() {
  let settings = DEFAULT_CLI_SETTINGS;
  try {
    settings = await readCliSettings(createServiceClient());
  } catch {
    // Not configured here: the defaults keep every CLI working.
  }
  return NextResponse.json(cliVersionBody(settings), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
