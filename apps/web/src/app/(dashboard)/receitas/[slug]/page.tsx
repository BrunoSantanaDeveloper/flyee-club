import RecipeView, { type RecipeState } from "./recipe-view";
import { notFound } from "next/navigation";

import { loadCatalog, loadRecipe } from "@/lib/catalog/read";
import { getMemberContext } from "@/lib/member/context";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** /receitas/<slug>: one recipe, its tools in order, and the workflow when the plan includes it. */
export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();

  const context = await getMemberContext();
  if (!context) return <RecipeView slug={slug} state={{ kind: "unavailable" }} />;

  let state: RecipeState | null = null;
  let missing = false;
  try {
    const limits = context.entitlements.active ? context.entitlements.limits : {};
    const recipe = await loadRecipe(context.supabase, { slug, locale: context.locale, limits });
    if (!recipe) {
      missing = true;
    } else {
      const catalog = await loadCatalog(context.supabase, { locale: context.locale, stableOnly: false, limits });
      state = { kind: "ready", recipe, trails: catalog.trails };
    }
  } catch {
    state = { kind: "error" };
  }
  if (missing) notFound();
  return <RecipeView slug={slug} state={state ?? { kind: "error" }} />;
}
