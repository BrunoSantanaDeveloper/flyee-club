import { createElement } from "react";
import { Resend } from "resend";

import AdminWeeklyDigestEmail, { type AdminWeeklyDigestEmailProps } from "./templates/admin-weekly-digest";
import ContactFormEmail, { ContactFormEmailProps } from "./templates/contact-form";
import KitReceiptEmail, { KIT_RECEIPT_COPY, type KitReceiptEmailProps } from "./templates/kit-receipt";
import LeadConfirmEmail, { LEAD_CONFIRM_COPY, type LeadConfirmLocale } from "./templates/lead-confirm";
import SubscriptionActiveEmail, { type SubscriptionActiveEmailProps } from "./templates/subscription-active";

export type { AdminWeeklyDigestEmailProps, KitReceiptEmailProps, LeadConfirmLocale, SubscriptionActiveEmailProps };

/** True when transactional email is configured (server-only env var). */
export const isEmailConfigured = Boolean(process.env.RESEND_API_KEY);

/**
 * A defined-but-empty variable (`EMAIL_FROM=` on its own line — what
 * `vercel env pull` writes for a variable with no value) is not null, so `??`
 * would keep the empty string and every send would be rejected for an empty
 * From. Treat unset and empty as the same thing.
 */
const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const DEFAULT_FROM = env("EMAIL_FROM") ?? "onboarding@resend.dev";

export type SendResult = { sent: boolean; error?: string };

/**
 * Confirms that a paid plan is live.
 *
 * Transactional (it confirms a purchase), so it carries no unsubscribe.
 * Returns { sent: false } without failing when RESEND_API_KEY is absent — the
 * in-app notification is written either way, so a missing provider degrades to
 * "it shows in the bell" instead of taking the webhook down.
 */
export async function sendSubscriptionActiveEmail(
  to: string,
  props: SubscriptionActiveEmailProps,
): Promise<SendResult> {
  if (!isEmailConfigured) {
    return { sent: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject: `Pagamento confirmado — ${props.planName} está ativo`,
    react: createElement(SubscriptionActiveEmail, props),
  });
  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}

/**
 * The operator's Monday digest: last week's focus metrics per segment and the
 * accounts that need someone. Internal mail to our own staff, so it carries no
 * unsubscribe; without RESEND_API_KEY the caller still leaves the same digest
 * in the operator's bell, so the alert degrades instead of disappearing.
 */
export async function sendAdminWeeklyDigestEmail(to: string, props: AdminWeeklyDigestEmailProps): Promise<SendResult> {
  if (!isEmailConfigured) {
    return { sent: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject: `flyee.club · ${props.headline}`,
    react: createElement(AdminWeeklyDigestEmail, props),
  });
  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}

/**
 * Forwards a public contact-form submission to CONTACT_FORM_TO (falls back to
 * EMAIL_FROM). Returns { sent: false } without failing when RESEND_API_KEY or
 * the destination is absent — the contact page must tell the visitor to use
 * an alternative channel in that case.
 */
export async function sendContactFormEmail(props: ContactFormEmailProps): Promise<SendResult> {
  const to = env("CONTACT_FORM_TO") ?? env("EMAIL_FROM");
  if (!isEmailConfigured || !to) {
    return { sent: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    replyTo: props.email,
    subject: `Contact form: ${props.name}`,
    react: createElement(ContactFormEmail, props),
  });
  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}

/**
 * The waitlist's double opt-in link, in the language the person signed up in.
 * Returns { sent: false } without failing when RESEND_API_KEY is absent; the
 * caller decides what the visitor is told (the address stays unconfirmed and
 * is erased after 7 days).
 */
export async function sendLeadConfirmationEmail({
  to,
  locale,
  confirmUrl,
}: {
  to: string;
  locale: LeadConfirmLocale;
  confirmUrl: string;
}): Promise<SendResult> {
  if (!isEmailConfigured) {
    return { sent: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject: LEAD_CONFIRM_COPY[locale].subject,
    react: createElement(LeadConfirmEmail, { locale, confirmUrl }),
  });
  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}

/**
 * The receipt of the one-time kit, in the buyer's language. Transactional, so
 * no unsubscribe. Returns { sent: false } without failing when RESEND_API_KEY
 * is absent: the grant is already in the database and the bell already rang.
 */
export async function sendKitReceiptEmail(to: string, props: KitReceiptEmailProps): Promise<SendResult> {
  if (!isEmailConfigured) {
    return { sent: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject: KIT_RECEIPT_COPY[props.locale].subject,
    react: createElement(KitReceiptEmail, props),
  });
  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}
