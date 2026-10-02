import "server-only";

import { deliverMeetingEmails, dueMeetingEmails, type MeetingEmailOutcome } from "@/lib/meeting-email";
import { isMeetingEmailKind, type MeetingEmailKind } from "@/lib/meeting-email-kinds";
import { createServiceClient } from "@flyee/auth/service";
import { inngest, sendEvent } from "@flyee/jobs";

/**
 * When the messages of a live session go out (lib/meeting-email.ts):
 *
 * - every 10 minutes the database says which sessions have a reminder or a
 *   recording notice owed (`due_meeting_emails`: the day reminder from 24
 *   hours before, the hour reminder in the last 60 minutes, the recording once
 *   an ended session has one) and each is delivered;
 * - `flyee/meeting.email` delivers one kind for one session right away: the
 *   confirmation of a registration just made, or the operator's button in
 *   /admin/encontros.
 *
 * Both paths end in the same claim, so they cannot write to someone twice.
 */

export const meetingEmailSweepFunction = inngest.createFunction(
  { id: "flyee-meeting-emails-sweep", retries: 1, concurrency: { limit: 1 } },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    const due = await step.run("due-meeting-emails", async () => dueMeetingEmails(createServiceClient()));
    const delivered: (MeetingEmailOutcome & { meetingId: string; kind: MeetingEmailKind })[] = [];
    for (const entry of due) {
      const outcome = await step.run(`deliver-${entry.meetingId}-${entry.kind}`, async () =>
        deliverMeetingEmails(createServiceClient(), entry),
      );
      delivered.push({ ...entry, ...outcome });
    }
    return { due: due.length, delivered };
  },
);

export const meetingEmailFunction = inngest.createFunction(
  { id: "flyee-meeting-email", retries: 1 },
  { event: "flyee/meeting.email" },
  async ({ event, step }) => {
    const { meetingId, kind, userId } = event.data;
    if (!isMeetingEmailKind(kind)) return { reason: "unknown-kind" };
    return step.run("deliver", async () => deliverMeetingEmails(createServiceClient(), { meetingId, kind, userId }));
  },
);

export const meetingFunctions = [meetingEmailSweepFunction, meetingEmailFunction];

/**
 * Asks for one kind of message of one session to be delivered now: through the
 * queue when there is one, in this request otherwise (`sendEvent` never
 * throws, and without a queue the message must still go out). Never throws:
 * a registration is not undone because its confirmation could not be sent.
 */
export async function requestMeetingEmails(input: {
  meetingId: string;
  kind: MeetingEmailKind;
  userId?: string;
}): Promise<{ queued: true } | ({ queued: false } & MeetingEmailOutcome)> {
  const queued = await sendEvent("flyee/meeting.email", input);
  if (queued.sent) return { queued: true };
  try {
    return { queued: false, ...(await deliverMeetingEmails(createServiceClient(), input)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("meeting_email_delivery_failed", { ...input, message });
    return { queued: false, claimed: 0, emailed: 0, notified: 0, released: 0, error: message };
  }
}
