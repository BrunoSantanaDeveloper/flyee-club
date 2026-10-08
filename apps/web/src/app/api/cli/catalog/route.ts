import { loadCatalog } from "@/lib/catalog/read";
import { runCliRequest } from "@/lib/cli/gates";
import { requestedLocale } from "@/lib/cli/settings";

/**
 * GET /api/cli/catalog?locale=&stable=: every published trail, module and
 * recipe. Each module names `latest`, the newest version this account may
 * download on its channel (the entry version, for an account with no
 * purchase), `newest`, the newest for everyone, and `entitled`, whether it
 * may download any (0040). `stable=1` narrows latest to stable versions
 * (reserved).
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
