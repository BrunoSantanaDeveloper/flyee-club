import { createElement } from "react";

import { emailCopyFor } from "./copy";
import type { EmailLocale } from "./locale";
import { emailEnv, isEmailConfigured, send, sendBatch, type SendResult } from "./send";
import AccessEndedEmail, { type AccessEndedEmailProps } from "./templates/access-ended";
import AdminWeeklyDigestEmail, { type AdminWeeklyDigestEmailProps } from "./templates/admin-weekly-digest";
import ContactFormEmail, { type ContactFormEmailProps } from "./templates/contact-form";
import KitReceiptEmail, { type KitReceiptEmailProps } from "./templates/kit-receipt";
import LeadConfirmEmail from "./templates/lead-confirm";
import MeetingEmail, { type MeetingEmailKind, type MeetingEmailProps } from "./templates/meeting";
import MemberWelcomeEmail, { type MemberWelcomeEmailProps } from "./templates/member-welcome";
import NewsletterEmail from "./templates/newsletter";
import SubscriptionActiveEmail, { type SubscriptionActiveEmailProps } from "./templates/subscription-active";
import SubscriptionCanceledEmail, {
  type CancelCause,
  type SubscriptionCanceledEmailProps,
} from "./templates/subscription-canceled";
import TermEndingEmail, { type TermEndingEmailProps } from "./templates/term-ending";
import TokenReminderEmail, { type TokenReminderEmailProps } from "./templates/token-reminder";
import UpdatesDigestEmail, { type UpdatesDigestEmailProps, type UpdatesDigestItem } from "./templates/updates-digest";

export { toEmailLocale, type EmailLocale } from "./locale";
export { BATCH_LIMIT, isEmailConfigured, type SendResult } from "./send";
export type {
  AccessEndedEmailProps,
  AdminWeeklyDigestEmailProps,
  CancelCause,
  ContactFormEmailProps,
  KitReceiptEmailProps,
  MeetingEmailKind,
  MeetingEmailProps,
  MemberWelcomeEmailProps,
  SubscriptionActiveEmailProps,
  SubscriptionCanceledEmailProps,
  TermEndingEmailProps,
  TokenReminderEmailProps,
  UpdatesDigestEmailProps,
  UpdatesDigestItem,
};

/*
 * One sender per message. Each takes the reader's address and the template's
 * props (the language among them), picks the subject from the copy of that
 * language, and returns { sent } without throwing: a missing provider or a
 * rejected send degrades to "it is in the bell" or "the link is on the page",
 * never to a failed purchase, job or sign-up.
 */

/** A new account is confirmed: the three steps to a first app. */
export const sendMemberWelcomeEmail = (to: string, props: MemberWelcomeEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).memberWelcome.subject,
    react: createElement(MemberWelcomeEmail, props),
  });

/** The receipt of the one-time access. Transactional, so no unsubscribe. */
export const sendKitReceiptEmail = (to: string, props: KitReceiptEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).accessReceipt.subject(props.planName),
    react: createElement(KitReceiptEmail, props),
  });

/** A subscription is live, with what it unlocks. Transactional. */
export const sendSubscriptionActiveEmail = (to: string, props: SubscriptionActiveEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).subscriptionActive.subject(props.planName),
    react: createElement(SubscriptionActiveEmail, props),
  });

/** A subscription has ended: what stays, what stops. Transactional. */
export const sendSubscriptionCanceledEmail = (to: string, props: SubscriptionCanceledEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).subscriptionCanceled.subject(props.planName),
    react: createElement(SubscriptionCanceledEmail, props),
  });

/** The term of a one-time access ran out and nothing else keeps the store open. Transactional. */
export const sendAccessEndedEmail = (to: string, props: AccessEndedEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).accessEnded.subject(props.planName),
    react: createElement(AccessEndedEmail, props),
  });

/** A paid period that does not renew is about to end. Transactional. */
export const sendTermEndingEmail = (to: string, props: TermEndingEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).termEnding.subject(props.planName, props.endsLabel),
    react: createElement(TermEndingEmail, props),
  });

/** A machine's connection is about to expire. An account notice: not gated by the news preference. */
export const sendTokenReminderEmail = (to: string, props: TokenReminderEmailProps): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(props.locale).tokenReminder.subject(props.daysLeft),
    react: createElement(TokenReminderEmail, props),
  });

/**
 * The weekly summary of new versions. The caller has already left out anyone
 * who turned the news off; the message still carries the way out, in the body
 * and in the List-Unsubscribe header.
 */
export const sendUpdatesDigestEmail = (to: string, props: UpdatesDigestEmailProps): Promise<SendResult> =>
  send(updatesDigestMessage(to, props));

function updatesDigestMessage(to: string, props: UpdatesDigestEmailProps) {
  return {
    to,
    subject: emailCopyFor(props.locale).updatesDigest.subject(props.items.length),
    react: createElement(UpdatesDigestEmail, props),
    unsubscribeUrl: props.unsubscribeUrl,
  };
}

/**
 * The weekly summary for up to BATCH_LIMIT members in one request, each with
 * their own apps and their own unsubscribe address. All or nothing: see
 * `sendBatch`.
 */
export const sendUpdatesDigestBatch = (
  messages: { to: string; props: UpdatesDigestEmailProps }[],
): Promise<SendResult & { count: number }> =>
  sendBatch(messages.map(({ to, props }) => updatesDigestMessage(to, props)));

/**
 * The waitlist's double opt-in link, in the language the person signed up in.
 * The caller decides what the visitor is told when it cannot be sent (the
 * address stays unconfirmed and is erased after 7 days).
 */
export const sendLeadConfirmationEmail = ({
  to,
  locale,
  confirmUrl,
}: {
  to: string;
  locale: EmailLocale;
  confirmUrl: string;
}): Promise<SendResult> =>
  send({
    to,
    subject: emailCopyFor(locale).leadConfirm.subject,
    react: createElement(LeadConfirmEmail, { locale, confirmUrl }),
  });

/** Confirmation, reminder or recording notice of a live session the reader registered for. */
export const sendMeetingEmail = (to: string, props: MeetingEmailProps): Promise<SendResult> =>
  send(meetingMessage(to, props));

function meetingMessage(to: string, props: MeetingEmailProps) {
  return {
    to,
    subject: emailCopyFor(props.locale).meeting[props.kind].subject(props.title),
    react: createElement(MeetingEmail, props),
  };
}

/**
 * One message of a live session for up to BATCH_LIMIT registrants in one
 * request, each in their own language and on their own clock. All or nothing:
 * see `sendBatch`.
 */
export const sendMeetingEmailBatch = (
  messages: { to: string; props: MeetingEmailProps }[],
): Promise<SendResult & { count: number }> => sendBatch(messages.map(({ to, props }) => meetingMessage(to, props)));

export type NewsletterMessage = {
  to: string;
  locale: EmailLocale;
  /** Written by the operator, in the reader's language. */
  subject: string;
  bodyMarkdown: string;
  /** This reader's own one-click address off the list. */
  unsubscribeUrl: string;
};

/**
 * One batch of an operator-written message (at most BATCH_LIMIT readers), each
 * with its own unsubscribe address. All or nothing: see `sendBatch`.
 */
export const sendNewsletterBatch = (messages: NewsletterMessage[]): Promise<SendResult & { count: number }> =>
  sendBatch(
    messages.map((message) => ({
      to: message.to,
      subject: message.subject,
      react: createElement(NewsletterEmail, {
        locale: message.locale,
        heading: message.subject,
        bodyMarkdown: message.bodyMarkdown,
        unsubscribeUrl: message.unsubscribeUrl,
      }),
      unsubscribeUrl: message.unsubscribeUrl,
    })),
  );

/**
 * The operator's Monday digest: last week's focus metrics per segment and the
 * accounts that need someone. Internal mail to our own staff, in Portuguese
 * like the consoles, with no unsubscribe.
 */
export const sendAdminWeeklyDigestEmail = (to: string, props: AdminWeeklyDigestEmailProps): Promise<SendResult> =>
  send({ to, subject: `flyee.club · ${props.headline}`, react: createElement(AdminWeeklyDigestEmail, props) });

/**
 * Forwards a public contact-form submission to CONTACT_FORM_TO (falls back to
 * EMAIL_FROM). Returns { sent: false } when there is no provider or no
 * destination: the contact page then tells the visitor to use another channel.
 */
export async function sendContactFormEmail(props: ContactFormEmailProps): Promise<SendResult> {
  const to = emailEnv("CONTACT_FORM_TO") ?? emailEnv("EMAIL_FROM");
  if (!isEmailConfigured || !to) return { sent: false };
  return send({
    to,
    replyTo: props.email,
    subject: `Contato pelo site: ${props.name}`,
    react: createElement(ContactFormEmail, props),
  });
}
