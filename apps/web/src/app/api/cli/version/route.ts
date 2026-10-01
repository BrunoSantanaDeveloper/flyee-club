import { NextResponse } from "next/server";

import { readCliSettings } from "@/lib/cli/settings";
import { createServiceClient } from "@flyee/auth/service";

/**
 * GET /api/cli/version: public, unauthenticated. The oldest CLI still served,
 * the newest core and deprecation notices, so `npx flyee` can tell a member to
 * update before anything fails (docs/CLI-CONTRACT.md).
 */
export async function GET() {
  let settings = {
    min_cli_version: "0.1.0",
    latest_core_version: null as string | null,
    deprecations: [] as unknown[],
  };
  try {
    settings = await readCliSettings(createServiceClient());
  } catch {
    // Not configured here: the defaults keep every CLI working.
  }
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
