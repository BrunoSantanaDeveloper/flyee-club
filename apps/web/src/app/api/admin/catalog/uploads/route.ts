import { NextResponse } from "next/server";

import { createUploadSlot, requireSuperadmin } from "@/lib/catalog/upload";
import { createServiceClient } from "@flyee/auth/service";

/**
 * POST /api/admin/catalog/uploads: an upload slot for one module package, a
 * signed URL into private staging storage (superadmin only). The console
 * sends the ZIP there, then finalizes it at /api/admin/catalog/versions.
 */
export async function POST() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const slot = await createUploadSlot(service);
    return NextResponse.json(
      {
        staging_path: slot.stagingPath,
        signed_url: slot.signedUrl,
        token: slot.token,
        max_bytes: slot.maxBytes,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "upload_slot_failed" }, { status: 502 });
  }
}
