# @flyee/email

The e-mails the platform sends to members and to contacts of the list: the Resend client, the React Email templates and their copy in both languages.

## Contract

- Server-only (uses `RESEND_API_KEY`); never import from client components.
- Every sender takes the reader's address and the template's props, picks the subject from the copy of the reader's language, and returns `{ sent: boolean, error? }`. **None of them throws.** Without `RESEND_API_KEY` they return `{ sent: false }` with no error, so a caller can tell "there is no provider" from "the provider refused".
- A caller always has a path that works without e-mail: the bell notice is written either way, the link stays on the page, the form says the list is unavailable.
- A message is written **in the reader's language** (`locale: "pt-BR" | "en"`, from `profiles.locale` or `leads.locale`; `toEmailLocale` reads anything that is not English as Portuguese). Dates and amounts arrive already formatted for the reader: a template never formats.

## Copy

`src/copy/pt-BR.ts` is the structural source of truth: `EmailCopy` is its type and `src/copy/en.ts` has to match it, so the build refuses a line that exists in one language only. Three rules for whoever edits it:

- vocabulary follows the site (`docs/HOME-COPY.md`): app, guia, acesso;
- a plan is called by the name it has in the data (`plans.name`), never by a word written in the copy, and no sentence depends on the grammatical gender of that name;
- a sentence that states a time ("within 24 hours", "in less than an hour") has to be true anywhere inside the window the message is sent in.

## Templates

`src/templates/` holds one React Email component per message, all inside `shell.tsx` (language on the document, preview line, one card, small print, signature). Inline styles only: e-mail clients ignore stylesheets, so the colours in `shell.tsx` are the light values of `packages/design-tokens` copied by hand. Keep them aligned when the palette changes. The button carries the charcoal label on the yellow, not white, and the yellow is never the colour of text or of a link (`docs/DESIGN.md`, palette usage).

| Sender | Message | Can the reader stop it? |
| --- | --- | --- |
| `sendMemberWelcomeEmail` | a new account is confirmed: three steps to a first app | no (about the account) |
| `sendKitReceiptEmail` | receipt of the one-time access, with the end date the grant has | no (a receipt) |
| `sendSubscriptionActiveEmail` | a subscription is live, with what the plan's limits unlock | no |
| `sendSubscriptionCanceledEmail` | a subscription ended: what stays, what stops | no |
| `sendTermEndingEmail` | a paid period that does not renew is about to end | no |
| `sendTokenReminderEmail` | a machine's connection is about to expire | no (about the account) |
| `sendMeetingEmail` / `sendMeetingEmailBatch` | confirmation, reminders and recording notice of a live session | by cancelling the registration |
| `sendLeadConfirmationEmail` | the waitlist's double opt-in link | no (it answers a request) |
| `sendUpdatesDigestEmail` / `sendUpdatesDigestBatch` | weekly summary of new versions of installed apps | **yes** |
| `sendNewsletterBatch` | a message the operator wrote to the confirmed list (Markdown) | **yes** |
| `sendAdminWeeklyDigestEmail`, `sendContactFormEmail` | internal mail to the operator, in Portuguese | no |

A message the reader can stop carries its unsubscribe address twice: as a link in the small print and as `List-Unsubscribe` + `List-Unsubscribe-Post` headers (one click, RFC 8058). The caller builds that address and decides who is left out; this package never reads a preference.

The batch senders send up to `BATCH_LIMIT` (100) messages in one request, each to its own reader with its own content. A batch is all or nothing: on an error nobody is counted as sent, and the caller's bookkeeping decides who is tried again.

## Tests

```bash
npm run test:email     # from the repo root
```

`src/templates.test.tsx` renders every template in both languages and checks the language on the document, that both languages have the same blocks in the same order, that only the stoppable messages carry an unsubscribe link, and the rules a template states (the receipt's end date, what a plan unlocks, why a subscription ended). No test sends anything.

## Env vars (apps/web/.env)

```
RESEND_API_KEY=        # server-only
EMAIL_FROM=            # verified sender, e.g. "flyee.club <oi@flyee.club>"
CONTACT_FORM_TO=       # where the contact form goes (falls back to EMAIL_FROM)
```

Without a verified domain, Resend only delivers from `onboarding@resend.dev` to your own account e-mail, which is enough for development.

## Supabase auth e-mails

Confirmation, password recovery and e-mail change are sent by Supabase Auth, not by this package. Their bilingual templates are in `supabase/templates/`, and `docs/DEPLOY.md` ("E-mails e jobs") says how to point Supabase at Resend's SMTP and where to paste them.
