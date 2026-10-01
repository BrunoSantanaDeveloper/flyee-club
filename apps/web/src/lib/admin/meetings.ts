import type { Localized } from "@/lib/admin/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the meetings console reads (migrations 0014 and 0021). A meeting
 * happens on an external tool; the platform holds the page, the registrations
 * and the door, and the join link lives apart from what members can read.
 */

export const MEETING_STATES = ["rascunho", "inscricoes", "ao_vivo", "encerrado", "arquivado"] as const;
export type MeetingState = (typeof MEETING_STATES)[number];

export const MEETING_PROVIDERS = ["zoom", "meet", "youtube", "outro"] as const;

/** One row of `meetings_overview()`. */
export type MeetingSummary = {
  id: string;
  slug: string;
  title: Localized;
  state: MeetingState;
  provider: string;
  startsAt: string | null;
  durationMinutes: number | null;
  publishedAt: string | null;
  hasJoinUrl: boolean;
  hasRecording: boolean;
  registered: number;
  joined: number;
};

export type MeetingDetail = {
  id: string;
  slug: string;
  title: Localized;
  description: Localized;
  state: MeetingState;
  provider: string;
  startsAt: string | null;
  durationMinutes: number | null;
  publishedAt: string | null;
  updatedAt: string;
  joinUrl: string | null;
  recordingUrl: string | null;
};

export type MeetingResults = {
  registered: number;
  joined: number;
  bySegment: { segment: string; registered: number; joined: number }[];
};

export type MeetingRegistrant = {
  userId: string;
  name: string | null;
  email: string | null;
  segment: string | null;
  locale: string | null;
  registeredAt: string;
  joinedAt: string | null;
};

/**
 * What can happen next to a meeting, in the order the operator does it. The
 * database only refuses archiving a meeting that has not ended; the rest is
 * the console keeping the story straight.
 */
export function nextStates(state: MeetingState): { state: MeetingState; label: string }[] {
  switch (state) {
    case "rascunho":
      return [
        { state: "inscricoes", label: "Abrir inscrições" },
        { state: "arquivado", label: "Arquivar" },
      ];
    case "inscricoes":
      return [
        { state: "ao_vivo", label: "Começar ao vivo" },
        { state: "rascunho", label: "Voltar para rascunho" },
      ];
    case "ao_vivo":
      return [{ state: "encerrado", label: "Encerrar" }];
    case "encerrado":
      return [{ state: "arquivado", label: "Arquivar" }];
    default:
      return [{ state: "rascunho", label: "Reabrir como rascunho" }];
  }
}

export async function loadMeetingsOverview(supabase: SupabaseClient): Promise<MeetingSummary[]> {
  const { data, error } = await supabase.rpc("meetings_overview");
  if (error) throw new Error("meetings_overview_failed");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    title: (row.title as Localized) ?? {},
    state: row.state as MeetingState,
    provider: row.provider as string,
    startsAt: (row.starts_at as string | null) ?? null,
    durationMinutes: (row.duration_minutes as number | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    hasJoinUrl: Boolean(row.has_join_url),
    hasRecording: Boolean(row.has_recording),
    registered: Number(row.registered ?? 0),
    joined: Number(row.joined ?? 0),
  }));
}

export async function loadMeetingAdmin(
  supabase: SupabaseClient,
  id: string,
): Promise<{ meeting: MeetingDetail; results: MeetingResults; registrants: MeetingRegistrant[] } | null> {
  const [meetingRead, linkRead, resultsRead, registrantsRead] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, slug, title, description, state, provider, starts_at, duration_minutes, published_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("meeting_links").select("join_url, recording_url").eq("meeting_id", id).maybeSingle(),
    supabase.rpc("meeting_results", { target_meeting: id }),
    supabase.rpc("admin_meeting_registrants", { target_meeting: id }),
  ]);
  if (meetingRead.error || linkRead.error || resultsRead.error || registrantsRead.error)
    throw new Error("meeting_failed");
  if (!meetingRead.data) return null;
  const row = meetingRead.data;
  const results = (resultsRead.data ?? {}) as {
    registered?: number;
    joined?: number;
    by_segment?: { segment: string; registered: number; joined: number }[];
  };
  return {
    meeting: {
      id: row.id,
      slug: row.slug,
      title: row.title ?? {},
      description: row.description ?? {},
      state: row.state,
      provider: row.provider,
      startsAt: row.starts_at,
      durationMinutes: row.duration_minutes,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      joinUrl: linkRead.data?.join_url ?? null,
      recordingUrl: linkRead.data?.recording_url ?? null,
    },
    results: {
      registered: Number(results.registered ?? 0),
      joined: Number(results.joined ?? 0),
      bySegment: (results.by_segment ?? []).map((entry) => ({
        segment: entry.segment,
        registered: Number(entry.registered ?? 0),
        joined: Number(entry.joined ?? 0),
      })),
    },
    registrants: ((registrantsRead.data ?? []) as MeetingRegistrant[]).map((entry) => ({
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      segment: entry.segment,
      locale: entry.locale,
      registeredAt: entry.registeredAt,
      joinedAt: entry.joinedAt,
    })),
  };
}
