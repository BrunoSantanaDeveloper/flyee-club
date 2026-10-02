import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailText } from "./shell";

/** The four messages a registration can produce (the `*_sent_at` columns of meeting_registrations). */
export type MeetingEmailKind = "confirmation" | "day" | "hour" | "recording";

export type MeetingEmailProps = {
  locale: EmailLocale;
  kind: MeetingEmailKind;
  /** The session title in the reader's language. */
  title: string;
  /**
   * When it starts, already formatted in the reader's own time zone and
   * language; null for a session without a date and for the recording notice.
   */
  whenLabel: string | null;
  /** The session page in the dashboard: where to join, watch or cancel the registration. */
  meetingUrl: string;
};

/**
 * Confirmation, reminders and the recording notice of a live session. They go
 * only to people who registered for that session, and the small print says
 * how to stop them (cancel the registration), so they are not gated by the
 * news preference.
 */
export default function MeetingEmail({ locale, kind, title, whenLabel, meetingUrl }: MeetingEmailProps) {
  const copy = emailCopyFor(locale).meeting;
  const message = copy[kind];
  return (
    <EmailShell locale={locale} preview={message.body(title)} heading={message.heading} notes={[copy.reason]}>
      <EmailText>{message.body(title)}</EmailText>
      {whenLabel && kind !== "recording" && (
        <EmailText>
          <strong>{copy.when}</strong> {whenLabel}
        </EmailText>
      )}
      <EmailButton href={meetingUrl}>{message.button}</EmailButton>
    </EmailShell>
  );
}
