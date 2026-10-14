import { NextResponse } from "next/server";

import { checkServiceToken } from "@/lib/catalog/service-token";
import { createUploadSlot } from "@/lib/catalog/upload";
import { createServiceClient } from "@flyee/auth/service";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/service/catalog/uploads: an upload slot for one package, for the
 * product's CI (the service token). Same answer as the console's
 * /api/admin/catalog/uploads: send the ZIP to `signed_url`, then finalize it at
 * /api/service/catalog/versions.
 */
export async function POST(request: Request) {
  const auth = checkServiceToken(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  }

  try {
    const slot = await createUploadSlot(service);
    return NextResponse.json(
      { staging_path: slot.stagingPath, signed_url: slot.signedUrl, token: slot.token, max_bytes: slot.maxBytes },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json({ error: "upload_slot_failed" }, { status: 502, headers: NO_STORE });
  }
}
