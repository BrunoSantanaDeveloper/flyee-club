import "server-only";

import { isMeetingEmailKind, MEETING_SENT_COLUMN, type MeetingEmailKind } from "@/lib/meeting-email-kinds";
import { bellCopyFor, type BellText } from "@/lib/messages/bell-copy";
import { dateTimeLabel, localizedText, memberUrl, type MessageLocale } from "@/lib/messages/format";
import { notifyUser } from "@/lib/notifications";
import { BATCH_LIMIT, isEmailConfigured, sendMeetingEmailBatch } from "@flyee/email";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The messages of a live session: the confirmation of a registration, the
 * reminder of the last 24 hours, the reminder of the last hour, and the notice
 * that the recording is available (the kinds and their windows are in
 * lib/meeting-email-kinds.ts).
 *
 * Each goes once to each registrant. `claim_meeting_emails` (migration 0023)
 * marks the registration in the statement that returns it, so the 10-minute
 * cron, the operator's button and a registration made in the same second
 * cannot write to the same person twice. When the provider refuses a batch,
 * the batch is given back and the next run tries it again; when there is no
 * provider at all, the reminders still reach the bell.
 *
 * The time of the session is written on each reader's own clock, in their
 * language. These messages go to people who registered for that session and
 * say how to stop them, so they ignore the news preference.
 */

type Claim = {
  registration_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  locale: string | null;
  timezone: string | null;
};

export type MeetingEmailOutcome = {
  /** Registrations this run marked. */
  claimed: number;
  emailed: number;
  notified: number;
  /** Registrations given back after the provider refused their batch. */
  released: number;
  reason?: string;
  error?: string;
};

/** A run stops after this many batches; the next one continues where it stopped. */
const MAX_BATCHES = 20;

function bellFor(kind: MeetingEmailKind, locale: MessageLocale, title: string, when: string | null): BellText | null {
  const copy = bellCopyFor(locale);
  if (kind === "day") return copy.meetingDay(title, when);
  if (kind === "hour") return copy.meetingHour(title);
  if (kind === "recording") return copy.meetingRecording(title);
  // The page already says "you are registered": a bell notice would repeat it.
  return null;
}

export async function deliverMeetingEmails(
  service: SupabaseClient,
  input: { meetingId: string; kind: MeetingEmailKind; userId?: string | null },
): Promise<MeetingEmailOutcome> {
  const outcome: MeetingEmailOutcome = { claimed: 0, emailed: 0, notified: 0, released: 0 };

  const { data: meeting, error: meetingError } = await service
    .from("meetings")
    .select("id, slug, title, starts_at")
    .eq("id", input.meetingId)
    .maybeSingle();
  if (meetingError) throw new Error(`meetings read failed: ${meetingError.message}`);
  if (!meeting) return { ...outcome, reason: "no-meeting" };

  // A confirmation exists only as an e-mail. Without a provider nothing would
  // be delivered, so nothing is marked as sent either.
  if (input.kind === "confirmation" && !isEmailConfigured) return { ...outcome, reason: "email-not-configured" };

  const path = `/encontros/${meeting.slug as string}`;
  const startsAt = (meeting.starts_at as string | null) ?? null;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data, error } = await service.rpc("claim_meeting_emails", {
      target_meeting: input.meetingId,
      target_kind: input.kind,
      target_user: input.userId ?? null,
      target_limit: BATCH_LIMIT,
    });
    if (error) throw new Error(`claim_meeting_emails failed: ${error.message}`);
    const claims = (data ?? []) as Claim[];
    if (claims.length === 0) break;
    outcome.claimed += claims.length;

    const messages = [];
    for (const claim of claims) {
      const locale: MessageLocale = claim.locale === "en" ? "en" : "pt-BR";
      const title = localizedText(meeting.title, meeting.slug as string, locale);
      const when = startsAt ? dateTimeLabel(startsAt, locale, claim.timezone) : null;

      const bell = bellFor(input.kind, locale, title, when);
      if (bell) {
        const written = await notifyUser(claim.user_id, {
          type: "system",
          ...bell,
          href: path,
          sourceKey: `meeting:${input.meetingId}:${input.kind}`,
        });
        outcome.notified += written.created ?? 0;
      }
      messages.push({
        to: claim.email,
        props: { locale, kind: input.kind, title, whenLabel: when, meetingUrl: memberUrl(path) },
      });
    }

    const sent = await sendMeetingEmailBatch(messages);
    if (sent.sent) {
      outcome.emailed += sent.count;
    } else if (sent.error) {
      // The provider refused the request, and a batch is all or nothing: give
      // these registrations back so the next run writes to them. The bell
      // rows stay (their key keeps a second notice from being written).
      const { error: releaseError } = await service
        .from("meeting_registrations")
        .update({ [MEETING_SENT_COLUMN[input.kind]]: null })
        .in(
          "id",
          claims.map((claim) => claim.registration_id),
        );
      if (!releaseError) outcome.released += claims.length;
      console.error("meeting_emails_failed", { meetingId: input.meetingId, kind: input.kind, error: sent.error });
      return { ...outcome, error: sent.error };
    }
    if (claims.length < BATCH_LIMIT) break;
  }
  return outcome;
}

/** What `due_meeting_emails` (migration 0023) says has someone to write to right now. */
export async function dueMeetingEmails(
  service: SupabaseClient,
): Promise<{ meetingId: string; kind: MeetingEmailKind }[]> {
  const { data, error } = await service.rpc("due_meeting_emails");
  if (error) throw new Error(`due_meeting_emails failed: ${error.message}`);
  return ((data ?? []) as { meeting_id: string; kind: string }[])
    .filter((row) => isMeetingEmailKind(row.kind))
    .map((row) => ({ meetingId: row.meeting_id, kind: row.kind as MeetingEmailKind }));
}
