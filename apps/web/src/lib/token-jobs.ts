import "server-only";

import { bellCopyFor } from "@/lib/messages/bell-copy";
import { memberUrl, wholeDaysLeft } from "@/lib/messages/format";
import { readRecipientMap } from "@/lib/messages/recipients";
import { notifyUser } from "@/lib/notifications";
import { createServiceClient } from "@flyee/auth/service";
import { sendTokenReminderEmail } from "@flyee/email";
import { inngest } from "@flyee/jobs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The reminder of day 25.
 *
 * A machine's connection lasts 30 days from its last update, and each update
 * renews it (docs/CLI-CONTRACT.md). The installer warns when it runs, but a
 * machine that is not running anything warns nobody: about five days before
 * the connection expires the member gets one bell notice and one e-mail, with
 * the command that renews it.
 *
 * `claim_token_reminders` (migration 0023) marks the token in the same
 * statement that returns it, so a second run, or two workers at once, find
 * nothing left: a reminder may be lost to a failed send, never sent twice.
 * A notice about the account, so it ignores the news preference.
 */

type Claim = {
  family_id: string;
  user_id: string;
  org_id: string;
  device_id: string | null;
  device_name: string | null;
  refresh_expires_at: string;
};

export type TokenReminderOutcome = { claimed: number; notified: number; emailed: number; failed: number };

const DEVICES_PATH = "/settings/devices";

export async function sendTokenReminders(
  service: SupabaseClient,
  now: number = Date.now(),
): Promise<TokenReminderOutcome> {
  const { data, error } = await service.rpc("claim_token_reminders");
  if (error) throw new Error(`claim_token_reminders failed: ${error.message}`);
  const claims = (data ?? []) as Claim[];
  const outcome: TokenReminderOutcome = { claimed: claims.length, notified: 0, emailed: 0, failed: 0 };
  if (claims.length === 0) return outcome;

  const readers = await readRecipientMap(
    service,
    claims.map((claim) => claim.user_id),
  );

  for (const claim of claims) {
    const reader = readers.get(claim.user_id);
    // A banned account, or one without an address: nobody to remind.
    if (!reader) continue;
    const days = wholeDaysLeft(claim.refresh_expires_at, now);

    const bell = await notifyUser(claim.user_id, {
      type: "system",
      ...bellCopyFor(reader.locale).tokenReminder(claim.device_name, days),
      href: DEVICES_PATH,
      // One notice per expiry of a connection: a renewed one expires on another
      // day and is reminded again, 30 days later.
      sourceKey: `token-reminder:${claim.family_id}:${claim.refresh_expires_at.slice(0, 10)}`,
    });
    outcome.notified += bell.created ?? 0;

    const sent = await sendTokenReminderEmail(reader.email, {
      locale: reader.locale,
      deviceName: claim.device_name,
      daysLeft: days,
      devicesUrl: memberUrl(DEVICES_PATH),
    });
    if (sent.sent) outcome.emailed += 1;
    else if (sent.error) outcome.failed += 1;
  }

  if (outcome.failed > 0) console.error("token_reminder_emails_failed", { failed: outcome.failed });
  return outcome;
}

/** Every day at 10:00 in Brasília (13:00 UTC). */
export const tokenReminderCronFunction = inngest.createFunction(
  { id: "flyee-token-reminders", retries: 1, concurrency: { limit: 1 } },
  { cron: "0 13 * * *" },
  async ({ step }) => step.run("send-token-reminders", async () => sendTokenReminders(createServiceClient())),
);

/** The same run, started by hand (`flyee/token.reminder`). */
export const tokenReminderManualFunction = inngest.createFunction(
  { id: "flyee-token-reminders-manual", retries: 1, concurrency: { limit: 1 } },
  { event: "flyee/token.reminder" },
  async ({ step }) => step.run("send-token-reminders", async () => sendTokenReminders(createServiceClient())),
);

export const tokenFunctions = [tokenReminderCronFunction, tokenReminderManualFunction];
