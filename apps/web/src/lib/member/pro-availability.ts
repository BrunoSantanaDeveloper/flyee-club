import "server-only";

import type { ProAvailability } from "@/lib/upgrade";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether each area of FlyeeClub Pro has something to deliver today, so an
 * empty one says "Em breve" wherever Pro is listed (docs/PRODUCT.md,
 * 2026-10-08): the upgrade prompt, the offer cards of the home and of the
 * revalidation. Read with the member's own session (row-level security serves
 * only what is published). A read that fails leaves the area unmarked:
 * "Em breve" is a claim too, and an unreadable area is not evidence of an
 * empty one.
 */
export async function loadProAvailability(supabase: SupabaseClient): Promise<ProAvailability> {
  const [recipes, meetings, versions] = await Promise.all([
    supabase.from("catalog_recipes").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("meetings").select("id", { count: "exact", head: true }).in("state", ["inscricoes", "ao_vivo"]),
    supabase.from("catalog_module_versions").select("guides").eq("status", "published"),
  ]);
  const advancedGuides = ((versions.data ?? []) as { guides: Record<string, unknown> | null }[]).some((row) =>
    Object.values(row.guides ?? {}).some((depths) => Array.isArray(depths) && depths.includes("abrir_o_capo")),
  );
  return {
    recipes: recipes.error ? true : (recipes.count ?? 0) > 0,
    meetings: meetings.error ? true : (meetings.count ?? 0) > 0,
    advancedGuides: versions.error ? true : advancedGuides,
  };
}
