import "server-only";

import type { MembersOverview } from "@/lib/admin/members";
import { REPORT_WEEKS, segmentPopulation, type SegmentWeekRow } from "@/lib/admin/metrics";
import { buildWeeklyDigest } from "@/lib/admin/weekly-digest";
import { notifyUsers } from "@/lib/notifications";
import { createServiceClient } from "@flyee/auth/service";
import { BRAND } from "@flyee/content";
import { sendAdminWeeklyDigestEmail } from "@flyee/email";
import { inngest } from "@flyee/jobs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The operator's Monday digest.
 *
 * The metrics and members consoles answer "which segment is leading, and who
 * needs me?", but only for someone who opens them. Once a week the answer
 * travels instead: one bell notification and one e-mail per superadmin, with
 * last week's five focus metrics per segment, the focus rule, and the counts of
 * accounts that need a person. Nothing to say means nothing is sent.
 *
 * It reads the SAME reports the consoles render (as the service role, which
 * `admin_segment_weekly` and `admin_members_overview` let in explicitly: a cron
 * has no session), so the digest can never describe a state the screen would
 * contradict.
 */

/** Monday 08:30 in Brasília (UTC-3): the start of the working week. */
const CRON = "30 11 * * 1";

export type DigestOutcome = {
  /** Operators who received a NEW notification (the digest's idempotency). */
  notified: number;
  emailed: number;
  week?: string;
  reason?: string;
  error?: string;
};

export async function sendWeeklyDigest(supabase: SupabaseClient, now: number = Date.now()): Promise<DigestOutcome> {
  const [weeklyRead, membersRead] = await Promise.all([
    supabase.rpc("admin_segment_weekly", { target_weeks: REPORT_WEEKS }),
    supabase.rpc("admin_members_overview"),
  ]);
  if (weeklyRead.error) return { notified: 0, emailed: 0, error: weeklyRead.error.message };
  if (membersRead.error || !membersRead.data) {
    return { notified: 0, emailed: 0, error: membersRead.error?.message ?? "members_overview_empty" };
  }

  const overview = membersRead.data as MembersOverview;
  const digest = buildWeeklyDigest(
    (weeklyRead.data ?? []) as SegmentWeekRow[],
    segmentPopulation(overview.members),
    overview.totals,
    now,
  );
  // No "all quiet" digest: an alert that arrives every week with nothing in it stops being read.
  if (!digest) return { notified: 0, emailed: 0, reason: "nothing-to-report" };

  const { data: operators, error: operatorError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_superadmin", true);
  if (operatorError) return { notified: 0, emailed: 0, week: digest.week, error: operatorError.message };
  const operatorIds = (operators ?? []).map((row) => row.id as string);
  if (operatorIds.length === 0) return { notified: 0, emailed: 0, week: digest.week, reason: "no-operator" };

  const href = "/admin/metricas";
  const bell = await notifyUsers(operatorIds, {
    type: "system",
    title: digest.headline,
    body: [digest.focus, ...digest.attention.slice(0, 2).map((entry) => `${entry.count} ${entry.label}`)].join(" · "),
    href,
    // One digest per operator per week, whatever happens to the cron.
    sourceKey: `admin-weekly:${digest.week}`,
  });

  // The bell's key is the fence for the whole digest: an operator who already
  // has this week's row must not receive this week's e-mail a second time.
  let emailed = 0;
  for (const operatorId of bell.createdFor ?? []) {
    const { data: operator } = await supabase.auth.admin.getUserById(operatorId);
    const to = operator?.user?.email;
    if (!to) continue;
    const sent = await sendAdminWeeklyDigestEmail(to, {
      headline: digest.headline,
      focus: digest.focus,
      rows: digest.rows,
      attention: digest.attention,
      appUrl: `${BRAND.siteUrl}${href}`,
    });
    if (sent.sent) emailed += 1;
  }

  return { notified: bell.created ?? 0, emailed, week: digest.week };
}

export const adminWeeklyDigestFunction = inngest.createFunction(
  { id: "admin-weekly-digest", retries: 1, concurrency: { limit: 1 } },
  { cron: CRON },
  async ({ step }) => step.run("send-weekly-digest", async () => sendWeeklyDigest(createServiceClient())),
);

export const adminFunctions = [adminWeeklyDigestFunction];
