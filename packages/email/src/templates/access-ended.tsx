import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailList, EmailText } from "./shell";

export type AccessEndedEmailProps = {
  locale: EmailLocale;
  /** The access that ended, as it is named in the data. */
  planName: string;
  /** The day it ended, already formatted for the reader. */
  endedLabel: string;
  /** The billing page the button opens: where the access is bought again. */
  billingUrl: string;
};

/**
 * "Your access has ended": the term of a one-time access ran out and nothing
 * else keeps the store open (a renewal or a subscription would, and then this
 * is not sent). What stays comes first, because the first question is whether
 * the installed apps still work (they do). Transactional, so it carries no
 * unsubscribe.
 */
export default function AccessEndedEmail({ locale, planName, endedLabel, billingUrl }: AccessEndedEmailProps) {
  const copy = emailCopyFor(locale).accessEnded;
  return (
    <EmailShell locale={locale} preview={copy.preview} heading={copy.heading} notes={[copy.back]}>
      <EmailText>{copy.body(planName, endedLabel)}</EmailText>
      <EmailText tight>{copy.keepsTitle}</EmailText>
      <EmailList items={[copy.keepsInstalled]} />
      <EmailText tight>{copy.stopsTitle}</EmailText>
      <EmailList items={[copy.stopsUpdates]} />
      <EmailButton href={billingUrl}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
