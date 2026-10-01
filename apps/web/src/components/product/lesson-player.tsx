"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Box, Button, Card, CardContent, Tab, Tabs, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiCheck from "@/icons/nexture/ni-check";
import NiLock from "@/icons/nexture/ni-lock";
import NiPlay from "@/icons/nexture/ni-play";
import { recordLessonProgress } from "@/lib/member/actions";

export type LessonView = {
  id: string;
  depth: "usar" | "abrir_o_capo";
  title: string;
  /** "4 min", formatted by the caller. */
  durationLabel: string | null;
  isAdvanced: boolean;
  /** Null when this member may not watch it: the database decided (can_watch_lesson). */
  youtubeId: string | null;
  completed: boolean;
};

/**
 * A module's short lessons: "usar" (how to use it) and "abrir o capô" (how it
 * works inside). The video loads only when the member presses play, from
 * youtube-nocookie, so opening the page sends nothing to YouTube; pressing
 * play records `lesson.started`, and "marcar como concluída" records
 * `lesson.completed` (record_lesson_progress).
 *
 * A lesson this plan does not include shows why and the one way to unlock it,
 * never a blank frame: the advanced lesson needs the membership, the base one
 * the kit (or it is a free sample, which always plays).
 *
 * Closest template section: a Card holding Tabs, as the settings panels use;
 * nothing in the catalog played a video.
 */
export default function LessonPlayer({ lessons, upgradeHref }: { lessons: LessonView[]; upgradeHref: string }) {
  const t = useTranslations("product");
  const [active, setActive] = useState(lessons[0]?.depth ?? "usar");
  const [playing, setPlaying] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(lessons.filter((lesson) => lesson.completed).map((lesson) => lesson.id)),
  );
  const [pending, startTransition] = useTransition();

  if (lessons.length === 0) return null;
  const lesson = lessons.find((item) => item.depth === active) ?? lessons[0];

  const play = (target: LessonView) => {
    setPlaying(target.id);
    startTransition(async () => {
      await recordLessonProgress(target.id, false);
    });
  };

  const finish = (target: LessonView) => {
    startTransition(async () => {
      const result = await recordLessonProgress(target.id, true);
      if (result.ok) setCompleted((current) => new Set(current).add(target.id));
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {lessons.length > 1 ? (
          <Tabs
            value={lesson.depth}
            onChange={(_, value: LessonView["depth"]) => setActive(value)}
            aria-label={t("module-lessons-tabs")}
          >
            {lessons.map((item) => (
              <Tab
                key={item.depth}
                value={item.depth}
                label={item.depth === "usar" ? t("module-lesson-use") : t("module-lesson-inside")}
              />
            ))}
          </Tabs>
        ) : null}

        <Box className="flex flex-col gap-1">
          <Typography variant="subtitle1" component="h3" className="mb-0">
            {lesson.title}
          </Typography>
          {lesson.durationLabel ? (
            <Typography variant="body2" className="text-text-secondary">
              {lesson.durationLabel}
            </Typography>
          ) : null}
        </Box>

        {lesson.youtubeId ? (
          <>
            <Box className="bg-grey-50 relative aspect-video w-full overflow-hidden rounded-2xl">
              {playing === lesson.id ? (
                <iframe
                  className="absolute inset-0 h-full w-full border-0"
                  src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                  title={lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <Button
                  onClick={() => play(lesson)}
                  className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl"
                  color="primary"
                  aria-label={t("module-lesson-play", { title: lesson.title })}
                >
                  <Box className="bg-primary text-text-contrast flex h-16 w-16 items-center justify-center rounded-full">
                    <NiPlay size="large" />
                  </Box>
                  <Typography variant="body2" className="text-text-secondary">
                    {t("module-lesson-privacy")}
                  </Typography>
                </Button>
              )}
            </Box>
            <Box className="flex flex-row flex-wrap items-center gap-2">
              {completed.has(lesson.id) ? (
                <Typography variant="body2" className="text-text-secondary flex flex-row items-center gap-1.5">
                  <NiCheck size="small" className="text-success" aria-hidden />
                  {t("module-lesson-done")}
                </Typography>
              ) : (
                <Button variant="outlined" size="small" disabled={pending} onClick={() => finish(lesson)}>
                  {t("module-lesson-mark-done")}
                </Button>
              )}
            </Box>
          </>
        ) : (
          <EmptyState
            icon={<NiLock size="large" />}
            title={lesson.isAdvanced ? t("module-lesson-locked-advanced") : t("module-lesson-locked")}
            description={lesson.isAdvanced ? t("module-lesson-locked-advanced-body") : t("module-lesson-locked-body")}
            action={{ label: t("module-lesson-unlock"), href: upgradeHref }}
          />
        )}
      </CardContent>
    </Card>
  );
}
