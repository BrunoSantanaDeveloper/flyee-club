import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailList, EmailText } from "./shell";

export type MemberWelcomeEmailProps = {
  locale: EmailLocale;
  name: string | null;
  /** The dashboard address the button opens. */
  appUrl: string;
  /** /instalar.md in the reader's language: the page their AI follows to install flyee. */
  installUrl: string;
};

/**
 * "Your account is ready": sent once, when a new account is confirmed, with
 * the three steps to a first app. The install step is a sentence to give the
 * AI, never a command to type (docs/PRODUCT.md, 2026-10-08). A message about
 * the account the person just created, so it carries no unsubscribe and
 * promotes nothing.
 */
export default function MemberWelcomeEmail({ locale, name, appUrl, installUrl }: MemberWelcomeEmailProps) {
  const copy = emailCopyFor(locale).memberWelcome;
  return (
    <EmailShell locale={locale} preview={copy.preview} heading={copy.heading} notes={[copy.reason]}>
      <EmailText>{copy.greeting(name)}</EmailText>
      <EmailText>{copy.body}</EmailText>
      <EmailList ordered items={copy.steps(installUrl)} />
      <EmailButton href={appUrl}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
