import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import { inspectModulePackage } from "@/lib/catalog/package";
import { logAuditEvent } from "@flyee/audit";
import { createClient } from "@flyee/auth/server";
import { guideAvailability } from "@flyee/catalog/guides";
import { minimumOfRange } from "@flyee/catalog/semver";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Module packages enter the catalog in two steps (docs/CLI-CONTRACT.md):
 *
 *  1. the superadmin console asks for an upload slot and sends the ZIP
 *     straight to private storage (`staging/…`), so the size is not bound by
 *     the 4.5 MB request limit of a serverless function;
 *  2. it then asks to finalize: the backend reads the staged bytes, inspects
 *     them (lib/catalog/package.ts), checks them against the module, stores
 *     them at their permanent path and records a DRAFT version.
 *
 * The checksum is computed from the bytes stored at the permanent path, never
 * trusted from the client. Publishing is a separate, deliberate act.
 *
 * The same two steps serve the product's CI, authenticated by the service
 * token instead of a session (/api/service/catalog/*, lib/catalog/service-token.ts).
 */

export const MODULES_BUCKET = "modules";
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
const STAGING_PATH = /^staging\/[0-9a-f-]{36}\.zip$/;

export function uploadLimitBytes(): number {
  const megabytes = Number(process.env.MODULE_UPLOAD_MAX_MB ?? 20);
  return (Number.isFinite(megabytes) && megabytes > 0 ? megabytes : 20) * 1024 * 1024;
}

/** The session's user when they are a superadmin; null otherwise (including support sessions). */
export async function requireSuperadmin(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  return profile?.is_superadmin ? { supabase, userId: user.id } : null;
}

export type UploadSlot = { stagingPath: string; signedUrl: string; token: string; maxBytes: number };

export async function createUploadSlot(service: SupabaseClient): Promise<UploadSlot> {
  const stagingPath = `staging/${randomUUID()}.zip`;
  const { data, error } = await service.storage.from(MODULES_BUCKET).createSignedUploadUrl(stagingPath);
  if (error || !data) throw new Error("upload_slot_failed");
  return { stagingPath, signedUrl: data.signedUrl, token: data.token, maxBytes: uploadLimitBytes() };
}

export type VersionRequest = { moduleSlug: string; bytes?: Uint8Array; stagingPath?: string };

/**
 * Reads a request to finalize a version, in either shape:
 *  - JSON `{ module, staging_path }`: the package went to a slot from the
 *    uploads endpoint first (any size up to MODULE_UPLOAD_MAX_MB);
 *  - multipart `module` + `file`: a small package in the request itself,
 *    bound by the platform's request size limit.
 */
export async function readVersionRequest(
  request: Request,
): Promise<{ ok: true; input: VersionRequest } | { ok: false; status: number; error: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > uploadLimitBytes() + 1024 * 1024) return { ok: false, status: 413, error: "package_too_large" };
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, status: 400, error: "invalid_request" };
    }
    const file = form.get("file");
    return {
      ok: true,
      input: {
        moduleSlug: String(form.get("module") ?? ""),
        bytes: file instanceof File ? new Uint8Array(await file.arrayBuffer()) : undefined,
      },
    };
  }
  let body: { module?: unknown; staging_path?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { ok: false, status: 400, error: "invalid_request" };
  }
  return {
    ok: true,
    input: {
      moduleSlug: typeof body.module === "string" ? body.module : "",
      stagingPath: typeof body.staging_path === "string" ? body.staging_path : undefined,
    },
  };
}

type AuditOptions = { entityType?: string; entityId?: string; metadata?: Record<string, unknown> };

/** Who sends a package: a superadmin in the console, or the product's CI with the service token. */
export type UploadActor = {
  /** Recorded as the version's author; null for the CI. */
  userId: string | null;
  audit: (action: string, options: AuditOptions) => Promise<void>;
};

export function consoleActor(session: { supabase: SupabaseClient; userId: string }): UploadActor {
  return { userId: session.userId, audit: (action, options) => recordAudit(session.supabase, action, options) };
}

/** No person acts: the event says it came through the service token, like a webhook's says its provider. */
export function serviceActor(service: SupabaseClient): UploadActor {
  return {
    userId: null,
    audit: async (action, options) => {
      await logAuditEvent(service, {
        orgId: null,
        actorId: null,
        action,
        entityType: options.entityType,
        entityId: options.entityId,
        metadata: { ...options.metadata, via: "service_token" },
      });
    },
  };
}

export type FinalizeResult =
  | {
      ok: true;
      version: { id: string; module: string; version: string; status: string; sha256: string; size_bytes: number };
    }
  | { ok: false; status: number; error: string; errors?: string[] };

export async function finalizeVersionUpload(
  service: SupabaseClient,
  actor: UploadActor,
  input: VersionRequest,
): Promise<FinalizeResult> {
  if (!SLUG.test(input.moduleSlug)) return { ok: false, status: 400, error: "invalid_module" };

  let bytes = input.bytes;
  if (!bytes && input.stagingPath) {
    if (!STAGING_PATH.test(input.stagingPath)) return { ok: false, status: 400, error: "invalid_staging_path" };
    const { data: staged, error } = await service.storage.from(MODULES_BUCKET).download(input.stagingPath);
    if (error || !staged) return { ok: false, status: 404, error: "staged_package_not_found" };
    bytes = new Uint8Array(await staged.arrayBuffer());
  }
  if (!bytes || bytes.byteLength === 0) return { ok: false, status: 400, error: "missing_package" };
  if (bytes.byteLength > uploadLimitBytes()) return { ok: false, status: 413, error: "package_too_large" };

  const inspection = inspectModulePackage(bytes);
  if (!inspection.ok) return { ok: false, status: 422, error: "invalid_package", errors: inspection.errors };
  const { manifest } = inspection;

  const { data: module, error: moduleError } = await service
    .from("catalog_modules")
    .select("id, slug, trail, type")
    .eq("slug", input.moduleSlug)
    .maybeSingle();
  if (moduleError) return { ok: false, status: 500, error: "catalog_read_failed" };
  if (!module) return { ok: false, status: 404, error: "module_not_found" };

  const mismatches: string[] = [];
  if (manifest.name !== module.slug) mismatches.push(`name is "${manifest.name}", the module is "${module.slug}"`);
  if (manifest.trail !== module.trail)
    mismatches.push(`trail is "${manifest.trail}", the module's is "${module.trail}"`);
  if (manifest.type !== module.type) mismatches.push(`type is "${manifest.type}", the module's is "${module.type}"`);
  if (mismatches.length > 0) return { ok: false, status: 422, error: "manifest_mismatch", errors: mismatches };

  const { data: existing } = await service
    .from("catalog_module_versions")
    .select("id")
    .eq("module_id", module.id)
    .eq("version", manifest.version)
    .maybeSingle();
  if (existing) return { ok: false, status: 409, error: "version_exists" };

  const storagePath = `${module.slug}/${manifest.version}/${module.slug}-${manifest.version}.zip`;
  const { error: uploadError } = await service.storage
    .from(MODULES_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/zip", upsert: false });
  if (uploadError) return { ok: false, status: 409, error: "package_already_stored" };

  const { data: version, error: insertError } = await service
    .from("catalog_module_versions")
    .insert({
      module_id: module.id,
      version: manifest.version,
      status: "draft",
      storage_path: storagePath,
      sha256: inspection.sha256,
      size_bytes: inspection.sizeBytes,
      manifest,
      changelog: manifest.changelog ?? {},
      min_core_version: minimumOfRange(manifest.min_core),
      compatible_ais: manifest.compatible_ais,
      permissions: manifest.permissions,
      // Which written guides the package carries (migration 0030); the text goes to catalog_guides below.
      guides: guideAvailability(inspection.guides),
      created_by: actor.userId,
    })
    .select("id, version, status, sha256, size_bytes")
    .single();
  if (insertError || !version) {
    // Never leave bytes behind that no version points to.
    await service.storage.from(MODULES_BUCKET).remove([storagePath]);
    return { ok: false, status: 500, error: "version_insert_failed" };
  }

  if (inspection.guides.length > 0) {
    const { error: guidesError } = await service.from("catalog_guides").insert(
      inspection.guides.map((guide) => ({
        version_id: version.id,
        depth: guide.depth,
        locale: guide.locale,
        body_md: guide.body,
      })),
    );
    if (guidesError) {
      // A version is its package: without its guides it is not the version uploaded.
      await service.from("catalog_module_versions").delete().eq("id", version.id);
      await service.storage.from(MODULES_BUCKET).remove([storagePath]);
      return { ok: false, status: 500, error: "guides_insert_failed" };
    }
  }

  if (input.stagingPath) await service.storage.from(MODULES_BUCKET).remove([input.stagingPath]);

  await actor.audit("catalog.version_uploaded", {
    entityType: "catalog_module_version",
    entityId: version.id as string,
    metadata: {
      module: module.slug,
      version: manifest.version,
      sha256: inspection.sha256,
      size_bytes: inspection.sizeBytes,
      guides: inspection.guides.map((guide) => `${guide.locale}/${guide.depth}`),
    },
  });

  return {
    ok: true,
    version: {
      id: version.id as string,
      module: module.slug as string,
      version: version.version as string,
      status: version.status as string,
      sha256: version.sha256 as string,
      size_bytes: Number(version.size_bytes),
    },
  };
}
