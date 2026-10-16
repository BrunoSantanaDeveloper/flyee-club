import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailText } from "./shell";

/** The messages Supabase Auth sends for the app, by the name its templates have (supabase/config.toml). */
export type AuthEmailKind = "confirmation" | "recovery" | "email_change";

/**
 * The fields Supabase fills in when it sends (Go templates). They reach the
 * page as written, because none of them has a character React escapes.
 */
export const SUPABASE_FIELD = {
  url: "{{ .ConfirmationURL }}",
  email: "{{ .Email }}",
  newEmail: "{{ .NewEmail }}",
  site: "{{ .SiteURL }}",
} as const;

export type AuthEmailProps = { locale: EmailLocale; kind: AuthEmailKind };

/** The copy of one message, with the email change's addresses already in its sentences. */
export function authCopy(locale: EmailLocale, kind: AuthEmailKind) {
  const { auth } = emailCopyFor(locale);
  if (kind === "email_change") {
    return { ...auth.emailChange, body: auth.emailChange.body(SUPABASE_FIELD.email, SUPABASE_FIELD.newEmail) };
  }
  return auth[kind];
}

/**
 * Confirmation of a new account, password reset and email change: sent by
 * Supabase Auth, not by this package, so this component is rendered once per
 * language into supabase/templates/ (src/supabase-templates.ts) and Supabase
 * fills in the link when it sends. It is the shell every other message has,
 * with the one link written out under the small print. About the account, so
 * it carries no unsubscribe.
 */
export default function AuthEmail({ locale, kind }: AuthEmailProps) {
  const copy = authCopy(locale, kind);
  return (
    <EmailShell
      locale={locale}
      preview={copy.preview}
      heading={copy.heading}
      notes={copy.notes}
      fallbackUrl={SUPABASE_FIELD.url}
      siteUrl={SUPABASE_FIELD.site}
    >
      {copy.body.map((paragraph) => (
        <EmailText key={paragraph}>{paragraph}</EmailText>
      ))}
      <EmailButton href={SUPABASE_FIELD.url}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
