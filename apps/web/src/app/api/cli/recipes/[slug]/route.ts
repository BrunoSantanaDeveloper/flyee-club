import { loadRecipe } from "@/lib/catalog/read";
import { cliLinks, runCliRequest } from "@/lib/cli/gates";
import { requestedLocale } from "@/lib/cli/settings";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/**
 * GET /api/cli/recipes/{slug}: a named set of modules at their latest
 * versions, plus the workflow that ties them together when the plan includes
 * recipes (`npx flyee add receita:<slug>`). Without the right, the modules
 * still list (each with its own `entitled`) and `workflow` is null.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return runCliRequest(
    request,
    { endpoint: "recipe", scope: "catalog:read", device: "required" },
    async ({ service, entitlements, locale }) => {
      if (!SLUG.test(slug)) return { ok: false, status: 404, code: "not_found" };
      const recipe = await loadRecipe(service, {
        slug,
        locale: requestedLocale(request, locale),
        limits: entitlements.limits,
      });
      if (!recipe) return { ok: false, status: 404, code: "not_found" };
      return { ok: true, body: { ...recipe, upgrade_url: recipe.entitled ? null : cliLinks.billing() } };
    },
  );
}
