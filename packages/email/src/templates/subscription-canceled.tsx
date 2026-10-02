import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailList, EmailText } from "./shell";

/**
 * Why a subscription ended: the member asked, a payment was not confirmed, a
 * paid term ran out, or it was ended at the provider and no reason is known
 * (then the message states the fact and gives none).
 */
export type CancelCause = "requested" | "payment" | "term" | "ended";

export type SubscriptionCanceledEmailProps = {
  locale: EmailLocale;
  /** The plan that ended, as it is named in the data. */
  planName: string;
  cause: CancelCause;
  /** The day it ended, already formatted for the reader. */
  endedLabel: string;
  /**
   * What still unlocks the store after the end: null when nothing does and
   * updates stop; otherwise the purchase that does (the one-time access), by
   * the name it has in the data when that name is known.
   */
  keptAccess: { by: string | null } | null;
  /** The billing page the button opens. */
  billingUrl: string;
};

/**
 * "Your subscription has ended": what stays and what stops arriving, in that
 * order, because the first question is whether the installed apps still work
 * (they do). What is said about access comes from the entitlements left after
 * the end, never from an assumption about the plan. Transactional, so it
 * carries no unsubscribe.
 */
export default function SubscriptionCanceledEmail({
  locale,
  planName,
  cause,
  endedLabel,
  keptAccess,
  billingUrl,
}: SubscriptionCanceledEmailProps) {
  const copy = emailCopyFor(locale).subscriptionCanceled;
  const keeps = [copy.keepsInstalled, ...(keptAccess ? [copy.keepsAccess(keptAccess.by)] : [])];
  const stops = keptAccess ? [copy.stopsBenefits] : [copy.stopsUpdates, copy.stopsBenefits];
  return (
    <EmailShell locale={locale} preview={copy.preview} heading={copy.heading} notes={[copy.back]}>
      <EmailText>{copy.cause[cause](planName, endedLabel)}</EmailText>
      <EmailText tight>{copy.keepsTitle}</EmailText>
      <EmailList items={keeps} />
      <EmailText tight>{copy.stopsTitle}</EmailText>
      <EmailList items={stops} />
      <EmailButton href={billingUrl}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
