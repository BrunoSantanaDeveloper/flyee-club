import { isModuleEntitled } from "@/lib/catalog/read";
import { cliLinks, runCliRequest } from "@/lib/cli/gates";
import { trackServerEvent } from "@/lib/product-events-server";
import { isSemver } from "@flyee/catalog/semver";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
/** A download link lives five minutes: long enough to fetch, too short to share. */
const SIGNED_URL_TTL_S = 300;

/**
 * GET /api/cli/modules/{slug}/versions/{version}/download: a short-lived
 * signed URL for one package, with the checksum the CLI must verify before
 * installing and the manifest it installs from.
 *
 * Refused for an unpublished or unknown version (404), a withdrawn one (410,
 * with the reason), a module the plan does not include (403 with the upgrade
 * link, recorded as `update.denied_entitlement`) and past the daily download
 * ceiling (429). Every package handed out is a `module_downloads` row.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  return runCliRequest(
    request,
    { endpoint: "download", scope: "modules:download", device: "required" },
    async ({ service, auth, entitlements, device, rate, locale }) => {
      if (!SLUG.test(slug) || !isSemver(version)) return { ok: false, status: 404, code: "not_found" };

      const { data: module, error: moduleError } = await service
        .from("catalog_modules")
        .select("id, slug, is_free_sample, entitlement_key")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (moduleError) throw new Error("catalog_read_failed");
      if (!module) return { ok: false, status: 404, code: "not_found" };

      const { data: row, error: versionError } = await service
        .from("catalog_module_versions")
        .select("id, version, status, storage_path, sha256, size_bytes, manifest, yank_reason")
        .eq("module_id", module.id)
        .eq("version", version)
        .maybeSingle();
      if (versionError) throw new Error("catalog_read_failed");
      if (!row || row.status === "draft") return { ok: false, status: 404, code: "not_found" };
      if (row.status === "yanked") {
        return {
          ok: false,
          status: 410,
          code: "version_yanked",
          // The database refuses a yanked version without a public reason
          // (catalog_module_versions_yank_reason).
          values: { reason: String(row.yank_reason ?? "").trim() },
          extra: { yank_reason: row.yank_reason },
          trail: "error",
        };
      }

      if (!isModuleEntitled(module as { is_free_sample: boolean; entitlement_key: string }, entitlements.limits)) {
        await trackServerEvent({
          actorId: auth.userId,
          orgId: auth.orgId,
          event: "update.denied_entitlement",
          properties: {
            module: slug,
            version,
            reason: "no_entitlement",
            tier_from: entitlements.tier ?? "none",
          },
          platform: "cli",
        });
        return { ok: false, status: 403, code: "denied_entitlement", actionUrl: cliLinks.billing() };
      }

      if (rate && !rate.downloadsAllowed) {
        return {
          ok: false,
          status: 429,
          code: "download_limit",
          extra: { downloads_limit: rate.downloadsLimit },
        };
      }

      const { data: signed, error: signError } = await service.storage
        .from("modules")
        .createSignedUrl(row.storage_path as string, SIGNED_URL_TTL_S);
      if (signError || !signed?.signedUrl) throw new Error("download_sign_failed");

      const { error: trailError } = await service.from("module_downloads").insert({
        org_id: auth.orgId,
        user_id: auth.userId,
        device_id: device?.deviceId ?? null,
        module_id: module.id,
        version_id: row.id,
      });
      if (trailError) console.error("[cli] download trail failed", trailError);

      return {
        ok: true,
        body: {
          slug,
          version: row.version,
          url: signed.signedUrl,
          expires_in: SIGNED_URL_TTL_S,
          sha256: row.sha256,
          size_bytes: Number(row.size_bytes),
          manifest: row.manifest,
          verify_url: cliLinks.verify(slug, row.version as string, locale),
        },
      };
    },
  );
}
