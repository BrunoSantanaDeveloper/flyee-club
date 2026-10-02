import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailCommand, EmailText } from "./shell";

export type TokenReminderEmailProps = {
  locale: EmailLocale;
  /** The name the member gave the machine, when there is one. */
  deviceName: string | null;
  /** Whole days left before the connection expires, rounded up (1 = within 24 hours). */
  daysLeft: number;
  /** The devices page the button opens. */
  devicesUrl: string;
};

/**
 * "Time to update": a machine's connection lasts 30 days from its last update
 * (docs/CLI-CONTRACT.md) and this goes out once, about five days before it
 * runs out. It says what one command does and what happens otherwise (nothing
 * is uninstalled), so it reads as a notice, not a threat. A message about the
 * account: it is sent whatever the member chose about news.
 */
export default function TokenReminderEmail({ locale, deviceName, daysLeft, devicesUrl }: TokenReminderEmailProps) {
  const copy = emailCopyFor(locale).tokenReminder;
  return (
    <EmailShell locale={locale} preview={copy.preview} heading={copy.heading} notes={[copy.reason]}>
      <EmailText>{copy.body(deviceName, daysLeft)}</EmailText>
      <EmailText tight>{copy.how}</EmailText>
      <EmailCommand>{copy.command}</EmailCommand>
      <EmailText>{copy.after}</EmailText>
      <EmailButton href={devicesUrl}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
