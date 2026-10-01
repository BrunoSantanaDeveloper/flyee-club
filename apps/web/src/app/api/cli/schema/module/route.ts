import { NextResponse } from "next/server";

import { manifestJsonSchema } from "@flyee/catalog/manifest";

/**
 * GET /api/cli/schema/module: the `flyee.module.json` JSON Schema, public, so
 * the CLI and module authors' editors validate a manifest the same way the
 * upload does (docs/CLI-CONTRACT.md).
 */
export function GET() {
  return NextResponse.json(manifestJsonSchema(), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/schema+json",
    },
  });
}
