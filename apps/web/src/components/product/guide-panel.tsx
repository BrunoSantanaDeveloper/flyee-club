"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Alert, Box, Button, Card, CardContent, Tab, Tabs, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import ProductMarkdown from "@/components/product/product-markdown";
import { useUpgradePrompt } from "@/components/product/upgrade-prompt";
import IllustrationDocumentation from "@/icons/illustrations/illustration-documentation";
import NiCheck from "@/icons/nexture/ni-check";
import NiLock from "@/icons/nexture/ni-lock";
import NiPlay from "@/icons/nexture/ni-play";
import { recordLessonProgress } from "@/lib/member/actions";

export type GuideVideo = {
  id: string;
  title: string;
  /** "4 min", formatted by the caller. */
  durationLabel: string | null;
  /** Null when this member may not watch it: the database decided (can_watch_lesson). */
  youtubeId: string | null;
  completed: boolean;
};

export type GuideTab = {
  depth: "usar" | "abrir_o_capo";
  /** The written guide of this depth; null when the version carries none. */
  guide: {
    /** Null when this member may not read it: the database decided (can_read_guide). */
    markdown: string | null;
    /** True when the text is in another language than the member's (no translation yet). */
    otherLanguage: boolean;
  } | null;
  /** The video of this depth, shown inside the guide, when there is one. */
  video: GuideVideo | null;
  /** A depth with nothing written or recorded yet: it says "Em breve". */
  soon?: boolean;
};

/**
 * An app's guide: "usar" (how to use it) and "abrir o capô" (how it works
 * inside), each a written guide from the package of the version shown, with
 * its short video above when there is one. The video loads only when the
 * member presses play, from youtube-nocookie, so opening the page sends
 * nothing to YouTube; pressing play records `lesson.started`, and "marcar como
 * visto" records `lesson.completed` (record_lesson_progress).
 *
 * A depth this plan does not include shows why and the one way to unlock it,
 * never a blank frame: the advanced guide needs FlyeeClub Pro, and its button
 * opens the upgrade prompt (docs/PRODUCT.md, 2026-10-08); the basic one needs
 * FlyeeClub, or it is the entry version, which every account reads (0040). A depth with
 * nothing yet, and an app whose versions carry no guide at all, say
 * "Em breve".
 *
 * Closest template section: a Card holding Tabs, as the settings panels use;
 * it replaced the video-only LessonPlayer when guides became written
 * (migration 0030).
 */
export default function GuidePanel({
  tabs,
  versionLine,
  newerLine,
  upgradeHref,
}: {
  tabs: GuideTab[];
  /** "Guia da versão 1.4.0, a instalada nos seus computadores", formatted by the caller. */
  versionLine: string | null;
  /** The newer release and how to get it, when there is one. */
  newerLine: string | null;
  upgradeHref: string;
}) {
  const t = useTranslations("product");
  const [active, setActive] = useState(tabs[0]?.depth ?? "usar");
  const [playing, setPlaying] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(tabs.flatMap((tab) => (tab.video?.completed ? [tab.video.id] : []))),
  );
  const [pending, startTransition] = useTransition();
  const openUpgrade = useUpgradePrompt();

  if (tabs.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            framed={false}
            illustration={<IllustrationDocumentation />}
            badge={t("soon")}
            title={t("module-guide-empty-title")}
            description={t("module-guide-empty-body")}
          />
        </CardContent>
      </Card>
    );
  }

  const tab = tabs.find((item) => item.depth === active) ?? tabs[0];
  const advanced = tab.depth === "abrir_o_capo";
  const guideLocked = Boolean(tab.guide && tab.guide.markdown === null);
  const videoLocked = Boolean(tab.video && !tab.video.youtubeId);
  // Locked when what this depth carries is closed to the member; a written
  // guide decides over its video, which follows the same rule.
  const locked = tab.guide ? guideLocked : videoLocked;

  const play = (video: GuideVideo) => {
    setPlaying(video.id);
    startTransition(async () => {
      await recordLessonProgress(video.id, false);
    });
  };

  const finish = (video: GuideVideo) => {
    startTransition(async () => {
      const result = await recordLessonProgress(video.id, true);
      if (result.ok) setCompleted((current) => new Set(current).add(video.id));
    });
  };

  return (
    <Card component="section" aria-labelledby="module-guide-title">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-col gap-1">
          <Typography id="module-guide-title" variant="subtitle1" component="h2" className="mb-0">
            {t("module-guide-title")}
          </Typography>
          {versionLine ? (
            <Typography variant="body2" className="text-text-secondary">
              {versionLine}
            </Typography>
          ) : null}
        </Box>

        {newerLine ? (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            {newerLine}
          </Alert>
        ) : null}

        {tabs.length > 1 ? (
          <Tabs
            value={tab.depth}
            onChange={(_, value: GuideTab["depth"]) => setActive(value)}
            aria-label={t("module-guide-tabs")}
          >
            {tabs.map((item) => (
              <Tab
                key={item.depth}
                value={item.depth}
                label={item.depth === "usar" ? t("module-lesson-use") : t("module-lesson-inside")}
              />
            ))}
          </Tabs>
        ) : null}

        {tab.soon ? (
          <EmptyState
            framed={false}
            titleAs="h3"
            illustration={<IllustrationDocumentation />}
            badge={t("soon")}
            title={t("module-guide-soon-title")}
            description={t("module-guide-soon-body")}
          />
        ) : locked ? (
          // Closed to this plan: a state of permission keeps its icon, with the one way to open it.
          <EmptyState
            titleAs="h3"
            icon={<NiLock size="large" />}
            title={advanced ? t("module-lesson-locked-advanced") : t("module-lesson-locked")}
            description={advanced ? t("module-lesson-locked-advanced-body") : t("module-lesson-locked-body")}
            action={
              advanced
                ? { label: t("module-lesson-advanced-cta"), onClick: () => openUpgrade("advanced_guide") }
                : { label: t("module-lesson-unlock"), href: upgradeHref }
            }
          />
        ) : (
          <>
            {tab.video?.youtubeId ? (
              <Box className="flex flex-col gap-2">
                <Box className="flex flex-col gap-0.5">
                  <Typography variant="subtitle2" component="h3" className="mb-0">
                    {tab.video.title}
                  </Typography>
                  {tab.video.durationLabel ? (
                    <Typography variant="body2" className="text-text-secondary">
                      {tab.video.durationLabel}
                    </Typography>
                  ) : null}
                </Box>
                <Box className="bg-grey-50 relative aspect-video w-full overflow-hidden rounded-2xl">
                  {playing === tab.video.id ? (
                    <iframe
                      className="absolute inset-0 h-full w-full border-0"
                      src={`https://www.youtube-nocookie.com/embed/${tab.video.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                      title={tab.video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <Button
                      onClick={() => tab.video && play(tab.video)}
                      className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl"
                      color="primary"
                      aria-label={t("module-lesson-play", { title: tab.video.title })}
                    >
                      <Box className="bg-primary text-primary-contrast flex h-16 w-16 items-center justify-center rounded-full">
                        <NiPlay size="large" />
                      </Box>
                      <Typography variant="body2" className="text-text-secondary">
                        {t("module-lesson-privacy")}
                      </Typography>
                    </Button>
                  )}
                </Box>
                <Box className="flex flex-row flex-wrap items-center gap-2">
                  {completed.has(tab.video.id) ? (
                    <Typography variant="body2" className="text-text-secondary flex flex-row items-center gap-1.5">
                      <NiCheck size="small" className="text-success" aria-hidden />
                      {t("module-lesson-done")}
                    </Typography>
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={pending}
                      onClick={() => tab.video && finish(tab.video)}
                    >
                      {t("module-lesson-mark-done")}
                    </Button>
                  )}
                </Box>
              </Box>
            ) : null}

            {tab.guide?.markdown ? (
              <Box className="flex flex-col gap-2">
                {tab.guide.otherLanguage ? (
                  <Typography variant="body2" className="text-text-secondary">
                    {t("module-guide-other-language")}
                  </Typography>
                ) : null}
                <ProductMarkdown>{tab.guide.markdown}</ProductMarkdown>
              </Box>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
