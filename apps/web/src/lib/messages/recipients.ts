import "server-only";

import type { MessageLocale } from "@/lib/messages/format";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who a message is written to: the address, the language and the clock of a
 * member, plus what they chose about news. Read with the service role through
 * `member_recipients` (migration 0023), which is the only place the address in
 * auth.users meets the profile; a banned account or one without an address is
 * simply not in the answer.
 */
export type Recipient = {
  userId: string;
  email: string;
  name: string | null;
  locale: MessageLocale;
  timezone: string | null;
  /**
   * The member turned the news off. It silences the weekly summary only:
   * receipts, account notices and reminders the member asked for still go.
   */
  optedOut: boolean;
  unsubscribeToken: string | null;
};

type Row = {
  user_id: string;
  email: string;
  display_name: string | null;
  locale: string | null;
  timezone: string | null;
  marketing_email_opt_out: boolean | null;
  email_unsubscribe_token: string | null;
};

const CHUNK = 200;

/** The recipients behind a set of user ids, in no particular order. Throws when the read fails. */
export async function readRecipients(service: SupabaseClient, userIds: string[]): Promise<Recipient[]> {
  const unique = [...new Set(userIds)];
  const recipients: Recipient[] = [];
  for (let start = 0; start < unique.length; start += CHUNK) {
    const { data, error } = await service.rpc("member_recipients", {
      target_users: unique.slice(start, start + CHUNK),
    });
    if (error) throw new Error(`member_recipients failed: ${error.message}`);
    for (const row of (data ?? []) as Row[]) {
      recipients.push({
        userId: row.user_id,
        email: row.email,
        name: row.display_name ?? null,
        locale: row.locale === "en" ? "en" : "pt-BR",
        timezone: row.timezone ?? null,
        optedOut: Boolean(row.marketing_email_opt_out),
        unsubscribeToken: row.email_unsubscribe_token ?? null,
      });
    }
  }
  return recipients;
}

/** The same read, keyed by user id. */
export async function readRecipientMap(service: SupabaseClient, userIds: string[]): Promise<Map<string, Recipient>> {
  return new Map((await readRecipients(service, userIds)).map((recipient) => [recipient.userId, recipient]));
}

/** Everyone who belongs to a workspace: who its bell notices are for. */
export async function workspaceMemberIds(service: SupabaseClient, orgId: string): Promise<string[]> {
  const { data, error } = await service.from("memberships").select("user_id").eq("org_id", orgId);
  if (error) throw new Error(`memberships read failed: ${error.message}`);
  return (data ?? []).map((row) => row.user_id as string);
}

/**
 * The owners and admins of a workspace: who a message about its billing is
 * written to (a receipt, the end of a subscription).
 */
export async function workspaceManagers(service: SupabaseClient, orgId: string): Promise<Recipient[]> {
  const { data, error } = await service
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"]);
  if (error) throw new Error(`memberships read failed: ${error.message}`);
  return readRecipients(
    service,
    (data ?? []).map((row) => row.user_id as string),
  );
}
