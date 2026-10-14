import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { checkServiceToken } from "@/lib/catalog/service-token";
import { finalizeVersionUpload, readVersionRequest, serviceActor } from "@/lib/catalog/upload";
import { createServiceClient } from "@flyee/auth/service";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/service/catalog/versions: the product's CI turns an uploaded
 * package into a DRAFT version (the service token; docs/CLI-CONTRACT.md,
 * section 10). The same inspection and answers as the console's
 * /api/admin/catalog/versions: 201 with the checksum, 409 `version_exists`
 * when that version is already in the catalog (a rerun is harmless), 422 with
 * every problem found. Publishing stays a click in /admin/catalogo.
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

  const read = await readVersionRequest(request);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status, headers: NO_STORE });

  const result = await finalizeVersionUpload(service, serviceActor(service), read.input);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
      { status: result.status, headers: NO_STORE },
    );
  }
  revalidatePath(`/admin/catalogo/${result.version.module}`);
  return NextResponse.json({ version: result.version }, { status: 201, headers: NO_STORE });
}
