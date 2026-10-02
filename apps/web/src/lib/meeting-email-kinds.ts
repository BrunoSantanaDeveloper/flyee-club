/**
 * The four messages a registration for a live session can produce, and when
 * each may go out. Pure and import-free: the delivery (lib/meeting-email.ts),
 * the console (/admin/encontros) and the tests share it.
 *
 * The windows are the ones `due_meeting_emails` uses (migration 0023), and the
 * wording of each message is true anywhere inside its window ("within 24
 * hours", "in less than an hour"): a reminder that a late run sends late still
 * says something true.
 */

export const MEETING_EMAIL_KINDS = ["confirmation", "day", "hour", "recording"] as const;

export type MeetingEmailKind = (typeof MEETING_EMAIL_KINDS)[number];

export const isMeetingEmailKind = (value: unknown): value is MeetingEmailKind =>
  (MEETING_EMAIL_KINDS as readonly unknown[]).includes(value);

/** The column of `meeting_registrations` each message is marked in. */
export const MEETING_SENT_COLUMN: Record<MeetingEmailKind, string> = {
  confirmation: "confirmation_sent_at",
  day: "reminder_day_sent_at",
  hour: "reminder_hour_sent_at",
  recording: "recording_sent_at",
};

const HOUR_MS = 3_600_000;

export type MeetingEmailWindow =
  | { open: true }
  | { open: false; why: "state" | "no-date" | "too-early" | "too-late" | "no-recording" };

/**
 * Whether a kind of message may be sent for a session right now.
 *
 * - confirmation: while people can register (registrations open, or live);
 * - day reminder: from 24 hours before the start, never inside the last two;
 * - hour reminder: in the last 60 minutes before the start;
 * - recording: once the session has ended and has a recording.
 */
export function meetingEmailWindow(
  kind: MeetingEmailKind,
  meeting: { state: string; startsAt: string | null; hasRecording: boolean },
  now: number = Date.now(),
): MeetingEmailWindow {
  if (kind === "confirmation") {
    return meeting.state === "inscricoes" || meeting.state === "ao_vivo"
      ? { open: true }
      : { open: false, why: "state" };
  }
  if (kind === "recording") {
    if (meeting.state !== "encerrado") return { open: false, why: "state" };
    return meeting.hasRecording ? { open: true } : { open: false, why: "no-recording" };
  }

  const allowed = kind === "day" ? ["inscricoes"] : ["inscricoes", "ao_vivo"];
  if (!allowed.includes(meeting.state)) return { open: false, why: "state" };
  const start = meeting.startsAt ? Date.parse(meeting.startsAt) : Number.NaN;
  if (!Number.isFinite(start)) return { open: false, why: "no-date" };
  const until = start - now;
  if (kind === "day") {
    if (until > 24 * HOUR_MS) return { open: false, why: "too-early" };
    return until > 2 * HOUR_MS ? { open: true } : { open: false, why: "too-late" };
  }
  if (until > HOUR_MS) return { open: false, why: "too-early" };
  return until > 0 ? { open: true } : { open: false, why: "too-late" };
}
