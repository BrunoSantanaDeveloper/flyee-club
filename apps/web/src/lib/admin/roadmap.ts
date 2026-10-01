import type { Localized } from "@/lib/admin/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the roadmap console reads (migration 0009). Items are written by the
 * operator; votes only by members through `cast_roadmap_vote`, and the counter
 * on the item is kept by a trigger, so the number shown is the number of votes.
 */

export const ROADMAP_STATUSES = ["proposed", "planned", "building", "shipped", "declined"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export type AdminRoadmapItem = {
  id: string;
  title: Localized;
  description: Localized;
  trail: string | null;
  status: RoadmapStatus;
  votes: number;
  shippedModuleId: string | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

export type RoadmapModuleOption = { id: string; slug: string; name: Localized; status: string };

/** Open items first by votes, then by the operator's order; closed items newest first. */
export function sortRoadmap(items: AdminRoadmapItem[]): AdminRoadmapItem[] {
  return [...items].sort((a, b) => {
    const closed = (item: AdminRoadmapItem) => item.status === "shipped" || item.status === "declined";
    if (closed(a) !== closed(b)) return closed(a) ? 1 : -1;
    if (closed(a)) return b.updatedAt.localeCompare(a.updatedAt);
    return b.votes - a.votes || a.sort - b.sort || a.createdAt.localeCompare(b.createdAt);
  });
}

export async function loadRoadmapAdmin(supabase: SupabaseClient): Promise<{
  items: AdminRoadmapItem[];
  modules: RoadmapModuleOption[];
  trails: { slug: string; name: Localized }[];
}> {
  const [itemsRead, modulesRead, trailsRead] = await Promise.all([
    supabase
      .from("roadmap_items")
      .select("id, title, description, trail, status, votes_count, shipped_module_id, sort, created_at, updated_at"),
    supabase.from("catalog_modules").select("id, slug, name, status").order("slug"),
    supabase.from("catalog_trails").select("slug, name").order("sort"),
  ]);
  if (itemsRead.error || modulesRead.error || trailsRead.error) throw new Error("roadmap_admin_failed");
  return {
    items: sortRoadmap(
      (itemsRead.data ?? []).map((row) => ({
        id: row.id,
        title: row.title ?? {},
        description: row.description ?? {},
        trail: row.trail,
        status: row.status,
        votes: Number(row.votes_count ?? 0),
        shippedModuleId: row.shipped_module_id,
        sort: row.sort,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    ),
    modules: (modulesRead.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name ?? {},
      status: row.status,
    })),
    trails: (trailsRead.data ?? []).map((row) => ({ slug: row.slug, name: row.name ?? {} })),
  };
}
