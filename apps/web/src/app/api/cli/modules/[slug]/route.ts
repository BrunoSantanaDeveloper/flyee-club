import { loadModule } from "@/lib/catalog/read";
import { runCliRequest } from "@/lib/cli/gates";
import { requestedLocale } from "@/lib/cli/settings";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** GET /api/cli/modules/{slug}: one module with every released version, changelogs in the member's language. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return runCliRequest(
    request,
    { endpoint: "module", scope: "catalog:read", device: "required" },
    async ({ service, entitlements, locale }) => {
      if (!SLUG.test(slug)) return { ok: false, status: 404, code: "not_found" };
      const body = await loadModule(service, {
        slug,
        locale: requestedLocale(request, locale),
        limits: entitlements.limits,
      });
      return body ? { ok: true, body } : { ok: false, status: 404, code: "not_found" };
    },
  );
}
