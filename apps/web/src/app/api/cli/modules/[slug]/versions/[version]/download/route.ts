import { grantsModuleKey } from "@/lib/catalog/read";
import { cliLinks, runCliRequest } from "@/lib/cli/gates";
import { platformPackageUrl, servesPackages } from "@/lib/cli/package-host";
import { readPackageHost } from "@/lib/cli/settings";
import { trackServerEvent } from "@/lib/product-events-server";
import { channelOf, versionAllowed } from "@flyee/catalog/channels";
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
 * with the reason), a version this account may not download (403 with the
 * upgrade link, recorded as `update.denied_entitlement`): a module the plan does
 * not include, or a version outside the account's channel, since the account
 * with no purchase gets only the entry version of each app (0040). Past the
 * daily download ceiling, 429. Every package handed out is a `module_downloads` row.
 *
 * The URL is the storage's, or, when `platform_settings.cli.package_host` says
 * so, the same signed link on the platform's own host (lib/cli/package-host.ts,
 * the product's request of 2026-10-20, item 2): the host the CLI called, so a
 * session in the cloud downloads from the one address it allows.
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
        .select("id, slug, entitlement_key")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (moduleError) throw new Error("catalog_read_failed");
      if (!module) return { ok: false, status: 404, code: "not_found" };

      const { data: row, error: versionError } = await service
        .from("catalog_module_versions")
        .select("id, version, status, is_stable, is_entry, storage_path, sha256, size_bytes, manifest, yank_reason")
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

      const allowed = versionAllowed(
        { is_stable: Boolean(row.is_stable), is_entry: Boolean(row.is_entry) },
        channelOf(entitlements.limits),
        grantsModuleKey(module as { entitlement_key: string }, entitlements.limits),
      );
      if (!allowed) {
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
      // Same token, same 300 seconds; a URL the platform cannot map keeps the storage's.
      const url =
        (servesPackages(await readPackageHost(service)) &&
          platformPackageUrl(signed.signedUrl, new URL(request.url).origin)) ||
        signed.signedUrl;

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
          url,
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
