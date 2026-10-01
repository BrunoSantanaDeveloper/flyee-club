import { NextResponse } from "next/server";

import { finalizeVersionUpload, requireSuperadmin, uploadLimitBytes } from "@/lib/catalog/upload";
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
 * already exists, and 201 with the checksum the catalog will publish.
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

  const contentType = request.headers.get("content-type") ?? "";
  let moduleSlug = "";
  let stagingPath: string | undefined;
  let bytes: Uint8Array | undefined;

  if (contentType.includes("multipart/form-data")) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > uploadLimitBytes() + 1024 * 1024) {
      return NextResponse.json({ error: "package_too_large" }, { status: 413 });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    moduleSlug = String(form.get("module") ?? "");
    const file = form.get("file");
    if (file instanceof File) bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    let body: { module?: unknown; staging_path?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    moduleSlug = typeof body.module === "string" ? body.module : "";
    stagingPath = typeof body.staging_path === "string" ? body.staging_path : undefined;
  }

  const result = await finalizeVersionUpload(service, session, { moduleSlug, bytes, stagingPath });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({ version: result.version }, { status: 201 });
}
