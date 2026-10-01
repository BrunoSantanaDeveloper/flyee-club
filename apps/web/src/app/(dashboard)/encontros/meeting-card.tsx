"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Box, Button, Card, CardContent, Chip, Typography } from "@mui/material";

import ProductMarkdown from "@/components/product/product-markdown";
import { TILE_TONE } from "@/components/product/tile-tone";
import NiCalendar from "@/icons/nexture/ni-calendar";
import NiCheck from "@/icons/nexture/ni-check";
import {
  cancelMeetingRegistration,
  joinMeeting,
  meetingRecording,
  type MemberActionResult,
  registerForMeeting,
} from "@/lib/member/actions";
import type { MemberMeeting } from "@/lib/member/community";
import { cn } from "@/lib/utils";

const ERROR_KEY: Record<string, string> = {
  too_early: "meetings-error-too-early",
  link_missing: "meetings-error-link-missing",
  closed: "meetings-error-closed",
  not_entitled: "meetings-error-not-entitled",
  not_registered: "meetings-error-not-registered",
  not_available: "meetings-error-no-recording",
  support_session: "meetings-error-support",
};

/**
 * One live meeting: when, what, and the one action that fits its moment:
 * sign up while it is open, enter the room (an external link, handed over
 * from 15 minutes before the start, `meeting_join`), or watch the recording
 * once it ended. A member without the membership reads it and is told what
 * unlocks it.
 *
 * Closest template section: the quick-action card (tinted icon column and a
 * card body); a meeting needs its date and its action in the same place.
 */
export default function MeetingCard({
  meeting,
  entitled,
  expanded = false,
}: {
  meeting: MemberMeeting;
  entitled: boolean;
  /** The detail page shows the whole description; the list a teaser. */
  expanded?: boolean;
}) {
  const t = useTranslations("product");
  const [registered, setRegistered] = useState(meeting.registered);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tone = TILE_TONE[meeting.state === "ao_vivo" ? "accent-4" : "accent-2"];

  const when = meeting.startsAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(meeting.startsAt))
    : t("meetings-date-tbd");

  const duration = meeting.durationMinutes ? t("meetings-duration", { minutes: meeting.durationMinutes }) : null;

  const run = (
    action: () => Promise<MemberActionResult>,
    onOk: (result: MemberActionResult & { ok: true }) => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onOk(result);
      else setError(t(ERROR_KEY[result.code] ?? "meetings-error-generic"));
    });
  };

  const open = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener");
  };

  const stateLabel =
    meeting.state === "ao_vivo"
      ? t("meetings-state-live")
      : meeting.state === "encerrado"
        ? t("meetings-state-ended")
        : t("meetings-state-open");

  return (
    <Card className="flex h-full flex-row p-1">
      <Box
        aria-hidden
        className={cn("flex w-16 flex-none items-start justify-center rounded-2xl pt-5", tone.bg, tone.text)}
      >
        <NiCalendar size="large" />
      </Box>
      <CardContent className="flex min-w-0 flex-1 flex-col gap-2">
        <Box className="flex flex-row flex-wrap items-center gap-2">
          <Typography variant="subtitle1" component="h2" className="mb-0">
            {expanded ? (
              meeting.title
            ) : (
              <Link href={`/encontros/${meeting.slug}`} className="hover:underline">
                {meeting.title}
              </Link>
            )}
          </Typography>
          <Chip
            size="small"
            color={meeting.state === "ao_vivo" ? "primary" : "default"}
            variant={meeting.state === "ao_vivo" ? "filled" : "outlined"}
            label={stateLabel}
          />
        </Box>
        <Typography variant="body2" className="text-text-secondary">
          {[when, duration].filter(Boolean).join(" · ")}
        </Typography>
        {meeting.description ? (
          expanded ? (
            <ProductMarkdown>{meeting.description}</ProductMarkdown>
          ) : (
            <Typography variant="body2" className="line-clamp-2">
              {meeting.description}
            </Typography>
          )
        ) : null}

        <Box className="mt-1 flex flex-row flex-wrap items-center gap-2">
          {!entitled ? (
            <>
              <Typography variant="body2" className="text-text-secondary">
                {t("meetings-locked")}
              </Typography>
              <Button size="small" component={Link} href="/settings/billing?source=meetings">
                {t("meetings-unlock")}
              </Button>
            </>
          ) : meeting.state === "encerrado" ? (
            <Button
              size="small"
              variant="outlined"
              disabled={pending}
              onClick={() =>
                run(
                  () => meetingRecording(meeting.id),
                  (result) => open(result.url),
                )
              }
            >
              {t("meetings-recording")}
            </Button>
          ) : registered ? (
            <>
              <Typography variant="body2" className="flex flex-row items-center gap-1">
                <NiCheck size="small" className="text-success" aria-hidden />
                {t("meetings-registered")}
              </Typography>
              <Button
                size="small"
                variant="contained"
                disabled={pending}
                onClick={() =>
                  run(
                    () => joinMeeting(meeting.id),
                    (result) => open(result.url),
                  )
                }
              >
                {t("meetings-join")}
              </Button>
              <Button
                size="small"
                color="grey"
                disabled={pending}
                onClick={() =>
                  run(
                    () => cancelMeetingRegistration(meeting.id),
                    () => setRegistered(false),
                  )
                }
              >
                {t("meetings-cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="small"
              variant="contained"
              disabled={pending}
              onClick={() =>
                run(
                  () => registerForMeeting(meeting.id),
                  () => setRegistered(true),
                )
              }
            >
              {t("meetings-register")}
            </Button>
          )}
        </Box>
        {error ? (
          <Typography variant="body2" role="status" className="text-text-secondary">
            {error}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
