/**
 * The marketing messages the client components of the public site read: the
 * only ones `app/[locale]/layout.tsx` hands to the browser.
 *
 * The provider used to carry the whole `marketing` namespace (539 keys, 40 KB),
 * serialized into the payload of every public page: 37% of the home's, 60% of
 * the catalog's, parsed by a phone before the first paint for strings only the
 * server renders. Server components read every message through
 * `getTranslations`, unaffected by this list.
 *
 * A key a client component reads must be written in its file as a literal
 * (a ternary of literals and a map of literals count), and it goes here under
 * that component. lib/public-shell.test.ts compares this list with the
 * literals of every client component the public pages reach, both ways: a key
 * missing here would render as its name, an extra one is weight for nothing.
 */
export const PUBLIC_CLIENT_MESSAGE_KEYS = [
  // components/marketing/marketing-header.tsx
  "nav-catalog",
  "nav-close-menu",
  "nav-home",
  "nav-how-it-works",
  "nav-menu",
  "nav-open-menu",
  "nav-pricing",
  "nav-sign-in",
  // components/marketing/language-switch.tsx
  "language-switch-label",
  "language-switch-name",
  // components/marketing/language-suggestion.tsx
  "language-suggest-action",
  "language-suggest-dismiss",
  "language-suggest-message",
  // components/consent/cookie-consent.tsx
  "cookie-consent-accept",
  "cookie-consent-description",
  "cookie-consent-privacy",
  "cookie-consent-reject",
  "cookie-consent-title",
  // components/support/support-widget.tsx
  "support-widget-email",
  "support-widget-help",
  "support-widget-label",
  "support-widget-whatsapp",
  // espera/waitlist-form.tsx
  "cta-waitlist",
  "waitlist-consent",
  "waitlist-consent-privacy",
  "waitlist-email-label",
  "waitlist-email-placeholder",
  "waitlist-error-consent",
  "waitlist-error-email",
  "waitlist-error-generic",
  "waitlist-error-rate",
  "waitlist-error-unavailable",
  "waitlist-segment-agency",
  "waitlist-segment-business",
  "waitlist-segment-dev",
  "waitlist-segment-label",
  "waitlist-segment-none",
  "waitlist-segment-other",
  "waitlist-segment-product",
  "waitlist-sent-again",
  "waitlist-sent-body",
  "waitlist-sent-title",
  "waitlist-submitting",
  // espera/confirmar/confirm-panel.tsx (also waitlist-error-unavailable and waitlist-submitting)
  "waitlist-confirm-again",
  "waitlist-confirm-button",
  "waitlist-confirm-invalid",
  "waitlist-confirmed-body",
  "waitlist-confirmed-cta",
  "waitlist-confirmed-title",
  "waitlist-resubscribed-title",
  // contato/contact-form.tsx
  "contact-email",
  "contact-error",
  "contact-invalid-email",
  "contact-message",
  "contact-name",
  "contact-not-configured",
  "contact-required",
  "contact-submit",
  "contact-success",
  // descadastro/unsubscribe-panel.tsx
  "unsubscribe-error",
  "unsubscribe-expired",
  "unsubscribe-home-cta",
  "unsubscribe-lead-button",
  "unsubscribe-lead-done-body",
  "unsubscribe-lead-done-title",
  "unsubscribe-member-button",
  "unsubscribe-member-done-body",
  "unsubscribe-member-done-cta",
  "unsubscribe-member-done-title",
  "unsubscribe-working",
  // blog/[slug]/comments.tsx
  "blog-comment-pending",
  "blog-comment-pending-badge",
  "blog-comment-placeholder",
  "blog-comment-submit",
  "blog-comments-empty",
  "blog-comments-signin",
  "blog-comments-title",
] as const;

/** The part of the `marketing` namespace the public client components read. */
export function pickPublicClientMessages(marketing: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of PUBLIC_CLIENT_MESSAGE_KEYS) {
    if (key in marketing) picked[key] = marketing[key];
  }
  return picked;
}
