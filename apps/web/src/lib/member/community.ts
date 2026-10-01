import "server-only";

import type { CatalogLocale } from "@/lib/catalog/links";
import { localize } from "@/lib/catalog/read";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The two community surfaces of the membership, read with the member's
 * session: live meetings (`meetings`, migration 0014; the join link stays
 * private until `meeting_join` hands it over) and the roadmap
 * (`roadmap_items`, migration 0009).
 */

export type MeetingState = "inscricoes" | "ao_vivo" | "encerrado";

export type MemberMeeting = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  durationMinutes: number | null;
  state: MeetingState;
  provider: string;
  registered: boolean;
};

export async function loadMeetings(
  supabase: SupabaseClient,
  input: { userId: string; locale: CatalogLocale },
): Promise<MemberMeeting[]> {
  const [{ data: meetings, error }, { data: registrations }] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, slug, title, description, starts_at, duration_minutes, state, provider")
      .in("state", ["inscricoes", "ao_vivo", "encerrado"])
      .order("starts_at", { ascending: true }),
    supabase.from("meeting_registrations").select("meeting_id").eq("user_id", input.userId),
  ]);
  if (error) throw new Error("meetings_read_failed");
  const registered = new Set(((registrations ?? []) as { meeting_id: string }[]).map((row) => row.meeting_id));
  return ((meetings ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    title: localize(row.title as Record<string, string>, input.locale) ?? (row.slug as string),
    description: localize(row.description as Record<string, string>, input.locale),
    startsAt: (row.starts_at as string | null) ?? null,
    durationMinutes: (row.duration_minutes as number | null) ?? null,
    state: row.state as MeetingState,
    provider: row.provider as string,
    registered: registered.has(row.id as string),
  }));
}

/** Upcoming (open or live, soonest first) and past (newest first). Pure. */
export function splitMeetings(meetings: MemberMeeting[]): { upcoming: MemberMeeting[]; past: MemberMeeting[] } {
  const time = (meeting: MemberMeeting) => (meeting.startsAt ? Date.parse(meeting.startsAt) : Number.MAX_SAFE_INTEGER);
  return {
    upcoming: meetings.filter((meeting) => meeting.state !== "encerrado").sort((a, b) => time(a) - time(b)),
    past: meetings.filter((meeting) => meeting.state === "encerrado").sort((a, b) => time(b) - time(a)),
  };
}

export type RoadmapStatus = "proposed" | "planned" | "building" | "shipped" | "declined";

export type RoadmapItem = {
  id: string;
  title: string;
  description: string | null;
  trail: string | null;
  status: RoadmapStatus;
  votes: number;
  voted: boolean;
  shippedModule: { slug: string; name: string } | null;
};

export async function loadRoadmap(
  supabase: SupabaseClient,
  input: { userId: string; locale: CatalogLocale },
): Promise<RoadmapItem[]> {
  const [{ data: items, error }, { data: votes }] = await Promise.all([
    supabase
      .from("roadmap_items")
      .select("id, title, description, trail, status, votes_count, shipped_module_id, sort")
      .order("sort", { ascending: true })
      .order("votes_count", { ascending: false }),
    supabase.from("roadmap_votes").select("item_id").eq("user_id", input.userId),
  ]);
  if (error) throw new Error("roadmap_read_failed");
  const rows = (items ?? []) as Record<string, unknown>[];
  const moduleIds = rows.map((row) => row.shipped_module_id as string | null).filter((id): id is string => Boolean(id));
  const { data: modules } = moduleIds.length
    ? await supabase.from("catalog_modules").select("id, slug, name").in("id", moduleIds)
    : { data: [] };
  const moduleById = new Map(
    ((modules ?? []) as { id: string; slug: string; name: Record<string, string> }[]).map((module) => [
      module.id,
      { slug: module.slug, name: localize(module.name, input.locale) ?? module.slug },
    ]),
  );
  const voted = new Set(((votes ?? []) as { item_id: string }[]).map((row) => row.item_id));

  return rows.map((row) => ({
    id: row.id as string,
    title: localize(row.title as Record<string, string>, input.locale) ?? "",
    description: localize(row.description as Record<string, string>, input.locale),
    trail: (row.trail as string | null) ?? null,
    status: row.status as RoadmapStatus,
    votes: Number(row.votes_count ?? 0),
    voted: voted.has(row.id as string),
    shippedModule: row.shipped_module_id ? (moduleById.get(row.shipped_module_id as string) ?? null) : null,
  }));
}
