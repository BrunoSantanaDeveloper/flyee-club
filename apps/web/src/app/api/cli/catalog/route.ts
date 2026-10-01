import { loadCatalog } from "@/lib/catalog/read";
import { runCliRequest } from "@/lib/cli/gates";
import { requestedLocale } from "@/lib/cli/settings";

/**
 * GET /api/cli/catalog?locale=&stable=: every published trail, module (with
 * its latest version, declared permissions, lessons and whether this
 * workspace may install it) and recipe. `stable=1` restricts the latest
 * version to versions marked stable (reserved; one channel in v1).
 */
export async function GET(request: Request) {
  return runCliRequest(
    request,
    { endpoint: "catalog", scope: "catalog:read", device: "required" },
    async ({ service, entitlements, locale }) => {
      const stable = new URL(request.url).searchParams.get("stable");
      const body = await loadCatalog(service, {
        locale: requestedLocale(request, locale),
        stableOnly: stable === "1" || stable === "true",
        limits: entitlements.limits,
      });
      return { ok: true, body };
    },
  );
}
