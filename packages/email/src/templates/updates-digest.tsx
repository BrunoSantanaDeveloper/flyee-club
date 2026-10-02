import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailCommand, EmailList, EmailText } from "./shell";

export type UpdatesDigestItem = {
  /** The app's name in the reader's language (its slug when it has none). */
  name: string;
  /** The oldest version this member still has installed on some machine. */
  from: string;
  /** The newest published version. */
  to: string;
};

export type UpdatesDigestEmailProps = {
  locale: EmailLocale;
  items: UpdatesDigestItem[];
  /** The news page the button opens. */
  newsUrl: string;
  /** One-click address that stops this summary (also sent as List-Unsubscribe). */
  unsubscribeUrl: string;
};

/** The apps listed by name; past this many the rest are counted in the subject only. */
export const DIGEST_LIMIT = 12;

/**
 * The weekly summary of new versions for apps the member has installed. Sent
 * only when there is something to update, and never to someone who turned the
 * news off: unlike a receipt it can be stopped, so it carries the unsubscribe
 * link in the body and in the header.
 */
export default function UpdatesDigestEmail({ locale, items, newsUrl, unsubscribeUrl }: UpdatesDigestEmailProps) {
  const copy = emailCopyFor(locale).updatesDigest;
  return (
    <EmailShell
      locale={locale}
      preview={copy.preview}
      heading={copy.heading}
      notes={[copy.reason]}
      unsubscribe={{ label: copy.unsubscribe, url: unsubscribeUrl }}
    >
      <EmailText tight>{copy.intro}</EmailText>
      <EmailList items={items.slice(0, DIGEST_LIMIT).map((item) => copy.item(item.name, item.from, item.to))} />
      <EmailText tight>{copy.how}</EmailText>
      <EmailCommand>{copy.command}</EmailCommand>
      <EmailButton href={newsUrl}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
