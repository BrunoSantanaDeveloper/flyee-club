import type { Localized } from "@/lib/admin/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the roadmap console reads (migrations 0009 and 0026). Items are written
 * by the operator or proposed by a FlyeeClub Pro member into the queue under
 * review (`submitted`); votes only by members through `cast_roadmap_vote`,
 * and the counter on the item is kept by a trigger, so the number shown is
 * the number of votes.
 */

export const ROADMAP_STATUSES = ["submitted", "proposed", "planned", "building", "shipped", "declined"] as const;
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
  /** The member who proposed it, when a member did. */
  proposedBy: { id: string; name: string } | null;
  submittedAt: string | null;
};

export type RoadmapModuleOption = { id: string; slug: string; name: Localized; status: string };

/** The open idea with the most votes cast in a month (`roadmap_month_leader`). */
export type AdminRoadmapLeader = {
  itemId: string;
  title: Localized;
  votesInMonth: number;
  votesTotal: number;
  monthStart: string;
};

/** The first day of the month `offset` months before the current one, as a date string. */
export function monthStart(offset: number, now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

async function readLeader(supabase: SupabaseClient, month: string): Promise<AdminRoadmapLeader | null> {
  const { data } = await supabase.rpc("roadmap_month_leader", { target_month: month });
  const raw = (data ?? null) as {
    item_id?: string;
    title?: Localized;
    votes_in_month?: number;
    votes_total?: number;
    month_start?: string;
  } | null;
  if (!raw?.item_id || !raw.month_start) return null;
  return {
    itemId: raw.item_id,
    title: raw.title ?? {},
    votesInMonth: Number(raw.votes_in_month ?? 0),
    votesTotal: Number(raw.votes_total ?? 0),
    monthStart: raw.month_start,
  };
}

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
  /** This month's leader, and last month's: the one to plan at the turn of the month. */
  leaders: { current: AdminRoadmapLeader | null; previous: AdminRoadmapLeader | null };
}> {
  const [itemsRead, modulesRead, trailsRead, current, previous] = await Promise.all([
    supabase
      .from("roadmap_items")
      .select(
        "id, title, description, trail, status, votes_count, shipped_module_id, sort, created_at, updated_at, proposed_by, submitted_at",
      ),
    supabase.from("catalog_modules").select("id, slug, name, status").order("slug"),
    supabase.from("catalog_trails").select("slug, name").order("sort"),
    readLeader(supabase, monthStart(0)),
    readLeader(supabase, monthStart(1)),
  ]);
  if (itemsRead.error || modulesRead.error || trailsRead.error) throw new Error("roadmap_admin_failed");

  // The proposers' names, read once for the whole queue.
  const proposerIds = [...new Set((itemsRead.data ?? []).map((row) => row.proposed_by).filter(Boolean))] as string[];
  const { data: proposers } = proposerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", proposerIds)
    : { data: [] };
  const nameOf = new Map(
    ((proposers ?? []) as { id: string; display_name: string | null }[]).map((row) => [row.id, row.display_name]),
  );

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
        proposedBy: row.proposed_by
          ? { id: row.proposed_by, name: nameOf.get(row.proposed_by)?.trim() || "integrante" }
          : null,
        submittedAt: row.submitted_at ?? null,
      })),
    ),
    leaders: { current, previous },
    modules: (modulesRead.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name ?? {},
      status: row.status,
    })),
    trails: (trailsRead.data ?? []).map((row) => ({ slug: row.slug, name: row.name ?? {} })),
  };
}
