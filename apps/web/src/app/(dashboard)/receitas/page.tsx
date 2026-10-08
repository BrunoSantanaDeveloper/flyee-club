import RecipesView, { type RecipesState } from "./recipes-view";

import { loadCatalog } from "@/lib/catalog/read";
import { getMemberContext } from "@/lib/member/context";

/** /receitas: the named sets of tools, each with the workflow that ties them together. */
export default async function RecipesPage() {
  const context = await getMemberContext();
  let state: RecipesState;
  if (!context) {
    state = { kind: "unavailable" };
  } else {
    try {
      const catalog = await loadCatalog(context.supabase, {
        locale: context.locale,
        stableOnly: false,
        limits: context.entitlements.active ? context.entitlements.limits : {},
      });
      state = {
        kind: "ready",
        recipes: catalog.recipes.map((recipe) => ({
          ...recipe,
          moduleNames: recipe.modules.map(
            (slug) => catalog.modules.find((module) => module.slug === slug)?.name ?? slug,
          ),
        })),
      };
    } catch {
      state = { kind: "error" };
    }
  }
  return <RecipesView state={state} />;
}
