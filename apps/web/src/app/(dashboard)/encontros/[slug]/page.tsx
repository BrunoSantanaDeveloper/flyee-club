import MeetingCard from "../meeting-card";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Alert, Box } from "@mui/material";

import PageHeader from "@/components/product/page-header";
import { loadMeetings } from "@/lib/member/community";
import { getMemberContext } from "@/lib/member/context";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** /encontros/<slug>: one meeting, with its whole description and the action for its moment. */
export default async function MeetingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const t = await getTranslations("product");
  const context = await getMemberContext();

  const crumbs = (name: string) => [
    { label: t("home-breadcrumb"), href: "/inicio" },
    { label: t("meetings-title"), href: "/encontros" },
    { label: name },
  ];

  if (!context) {
    return (
      <Box className="flex flex-col gap-6">
        <PageHeader title={slug} crumbs={crumbs(slug)} />
        <Alert severity="info" className="neutral bg-background-paper/60!">
          {t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  let meetings;
  try {
    meetings = await loadMeetings(context.supabase, { userId: context.userId, locale: context.locale });
  } catch {
    return (
      <Box className="flex flex-col gap-6">
        <PageHeader title={slug} crumbs={crumbs(slug)} />
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {t("meetings-error")}
        </Alert>
      </Box>
    );
  }
  const meeting = meetings.find((item) => item.slug === slug);
  if (!meeting) notFound();

  return (
    <Box className="flex flex-col gap-6">
      <PageHeader title={meeting.title} crumbs={crumbs(meeting.title)} />
      <MeetingCard meeting={meeting} entitled={context.entitlements.has("meetings")} expanded />
    </Box>
  );
}
