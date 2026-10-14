import { NextResponse } from "next/server";

import { consoleActor, finalizeVersionUpload, readVersionRequest, requireSuperadmin } from "@/lib/catalog/upload";
import { createServiceClient } from "@flyee/auth/service";

/**
 * POST /api/admin/catalog/versions: turns an uploaded package into a DRAFT
 * version of a module (superadmin only, docs/CLI-CONTRACT.md).
 *
 *  - JSON `{ module, staging_path }`: the package was sent to the slot from
 *    /api/admin/catalog/uploads (the console's path, any size up to
 *    MODULE_UPLOAD_MAX_MB);
 *  - multipart `module` + `file`: a small package in the request itself
 *    (scripts and tests; bound by the platform's request size limit).
 *
 * Answers 422 with every problem found in the package, 409 when the version
 * already exists, and 201 with the checksum the catalog will publish. The
 * product's CI uses the same steps at /api/service/catalog/versions.
 */
export async function POST(request: Request) {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const read = await readVersionRequest(request);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const result = await finalizeVersionUpload(service, consoleActor(session), read.input);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({ version: result.version }, { status: 201 });
}
