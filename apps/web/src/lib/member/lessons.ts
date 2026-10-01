import "server-only";

import type { CatalogLocale } from "@/lib/catalog/links";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A module's lessons as the member may see them: titles and durations are
 * public, the video id is not. `catalog_lesson_videos` only returns the rows
 * `can_watch_lesson` allows (migration 0008), so a missing id IS the lock: the
 * page never decides access on its own.
 */
export type MemberLesson = {
  id: string;
  depth: "usar" | "abrir_o_capo";
  locale: CatalogLocale;
  title: string;
  durationSeconds: number | null;
  isAdvanced: boolean;
  /** The unlisted YouTube id; null when this member may not watch it. */
  youtubeId: string | null;
  completed: boolean;
};

/** The lessons in the member's language when they exist, otherwise the other one. Pure. */
export function lessonsForLocale<T extends { depth: string; locale: string }>(
  lessons: T[],
  locale: CatalogLocale,
): T[] {
  const byDepth = new Map<string, T>();
  for (const lesson of lessons) {
    const current = byDepth.get(lesson.depth);
    if (!current || (lesson.locale === locale && current.locale !== locale)) byDepth.set(lesson.depth, lesson);
  }
  return ["usar", "abrir_o_capo"].flatMap((depth) => (byDepth.has(depth) ? [byDepth.get(depth)!] : []));
}

export async function loadLessons(
  supabase: SupabaseClient,
  input: { moduleId: string; userId: string; locale: CatalogLocale },
): Promise<MemberLesson[]> {
  const { data: lessons, error } = await supabase
    .from("catalog_lessons")
    .select("id, depth, locale, title, duration_seconds, is_advanced, sort")
    .eq("module_id", input.moduleId)
    .order("sort");
  if (error) throw new Error("lessons_read_failed");
  const rows = lessonsForLocale(
    (lessons ?? []) as {
      id: string;
      depth: "usar" | "abrir_o_capo";
      locale: CatalogLocale;
      title: string;
      duration_seconds: number | null;
      is_advanced: boolean;
    }[],
    input.locale,
  );
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [{ data: videos }, { data: progress }] = await Promise.all([
    supabase.from("catalog_lesson_videos").select("lesson_id, youtube_id").in("lesson_id", ids),
    supabase.from("lesson_progress").select("lesson_id, completed_at").eq("user_id", input.userId).in("lesson_id", ids),
  ]);
  const videoByLesson = new Map(
    ((videos ?? []) as { lesson_id: string; youtube_id: string }[]).map((video) => [video.lesson_id, video.youtube_id]),
  );
  const completed = new Set(
    ((progress ?? []) as { lesson_id: string; completed_at: string | null }[])
      .filter((row) => row.completed_at)
      .map((row) => row.lesson_id),
  );

  return rows.map((row) => ({
    id: row.id,
    depth: row.depth,
    locale: row.locale,
    title: row.title,
    durationSeconds: row.duration_seconds,
    isAdvanced: row.is_advanced,
    youtubeId: videoByLesson.get(row.id) ?? null,
    completed: completed.has(row.id),
  }));
}
