"use server";

import { recordAudit } from "@/lib/audit";
import { requireSuperadmin } from "@/lib/catalog/upload";

/**
 * The life of a module version after its upload (superadmin only), the calls
 * the catalog console makes. The database enforces the rules
 * (`guard_module_version`, migration 0008): draft → published → yanked and
 * nothing else; a released version's bytes, checksum, manifest and
 * permissions never change; a withdrawn version is nobody's stable version.
 * These actions only add the session check and the audit trail.
 */

export type VersionActionResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function changeVersion(
  versionId: string,
  change: Record<string, unknown>,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<VersionActionResult> {
  if (!UUID.test(versionId)) return { ok: false, error: "invalid_version" };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "forbidden" };

  const { data, error } = await session.supabase
    .from("catalog_module_versions")
    .update(change)
    .eq("id", versionId)
    .select("id, version, module_id")
    .maybeSingle();
  if (error)
    return {
      ok: false,
      error: error.message.includes("invalid_version_transition") ? "invalid_transition" : error.message,
    };
  if (!data) return { ok: false, error: "not_found" };

  await recordAudit(session.supabase, action, {
    entityType: "catalog_module_version",
    entityId: versionId,
    metadata: { version: data.version, module_id: data.module_id, ...metadata },
  });
  return { ok: true };
}

/** draft → published: members can download it from now on. */
export async function publishVersion(versionId: string): Promise<VersionActionResult> {
  return changeVersion(versionId, { status: "published" }, "catalog.version_published");
}

/** Marks (or unmarks) a published version as stable, reserved for the channel split. */
export async function setVersionStable(versionId: string, stable: boolean): Promise<VersionActionResult> {
  return changeVersion(
    versionId,
    { is_stable: stable },
    stable ? "catalog.version_marked_stable" : "catalog.version_unmarked_stable",
  );
}

/** published → yanked: never served again, still verifiable, with the reason members will read. */
export async function yankVersion(versionId: string, reason: string): Promise<VersionActionResult> {
  const clean = reason.trim().slice(0, 300);
  if (!clean) return { ok: false, error: "reason_required" };
  return changeVersion(versionId, { status: "yanked", yank_reason: clean }, "catalog.version_yanked", {
    reason: clean,
  });
}
