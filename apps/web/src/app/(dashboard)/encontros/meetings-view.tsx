"use client";

import MeetingCard from "./meeting-card";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Grid, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import PageHeader from "@/components/product/page-header";
import NiCalendar from "@/icons/nexture/ni-calendar";
import type { MemberMeeting } from "@/lib/member/community";

export type MeetingsState =
  | { kind: "ready"; upcoming: MemberMeeting[]; past: MemberMeeting[]; entitled: boolean }
  | { kind: "error" }
  | { kind: "unavailable" };

/**
 * Who: a member of the membership. Job: be in the next live meeting, or catch
 * up on one they missed. Success: signed up (the reminders follow by e-mail)
 * or the recording opened. Upcoming meetings lead; past ones are the archive.
 */
export default function MeetingsView({ state }: { state: MeetingsState }) {
  const t = useTranslations("product");
  const router = useRouter();

  const header = (
    <PageHeader
      title={t("meetings-title")}
      crumbs={[{ label: t("home-breadcrumb"), href: "/inicio" }, { label: t("meetings-title") }]}
      description={t("meetings-subtitle")}
    />
  );

  if (state.kind !== "ready") {
    return (
      <Box className="flex flex-col gap-6">
        {header}
        <Alert
          severity={state.kind === "error" ? "error" : "info"}
          className="neutral bg-background-paper/60!"
          action={
            state.kind === "error" ? (
              <Button color="inherit" size="small" onClick={() => router.refresh()}>
                {t("retry")}
              </Button>
            ) : undefined
          }
        >
          {state.kind === "error" ? t("meetings-error") : t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  if (state.upcoming.length === 0 && state.past.length === 0) {
    return (
      <Box className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<NiCalendar size="large" />}
          title={t("meetings-empty-title")}
          description={t("meetings-empty-body")}
          action={{ label: t("meetings-empty-cta"), href: "/roadmap" }}
        />
      </Box>
    );
  }

  return (
    <Box className="flex flex-col gap-8">
      {header}
      <Box className="flex flex-col gap-3">
        <Typography variant="h5" component="h2" className="mb-0">
          {t("meetings-upcoming")}
        </Typography>
        {state.upcoming.length === 0 ? (
          <Typography variant="body1" className="text-text-secondary">
            {t("meetings-upcoming-none")}
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {state.upcoming.map((meeting) => (
              <Grid key={meeting.id} size={{ xs: 12, lg: 6 }}>
                <MeetingCard meeting={meeting} entitled={state.entitled} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      {state.past.length > 0 ? (
        <Box className="flex flex-col gap-3">
          <Typography variant="h5" component="h2" className="mb-0">
            {t("meetings-past")}
          </Typography>
          <Grid container spacing={3}>
            {state.past.map((meeting) => (
              <Grid key={meeting.id} size={{ xs: 12, lg: 6 }}>
                <MeetingCard meeting={meeting} entitled={state.entitled} />
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : null}
    </Box>
  );
}
