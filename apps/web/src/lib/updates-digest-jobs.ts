import "server-only";

import { fetchAllPages } from "@/lib/fetch-all-pages";
import { bellCopyFor } from "@/lib/messages/bell-copy";
import { isoWeekKey, localizedText, memberUrl, unsubscribeUrl } from "@/lib/messages/format";
import { readRecipientMap, type Recipient } from "@/lib/messages/recipients";
import { notifyUser } from "@/lib/notifications";
import {
  deviceKey,
  type DigestDevice,
  keepUpdatingAccounts,
  type LatestVersion,
  pendingUpdates,
} from "@/lib/updates-digest";
import { createServiceClient } from "@flyee/auth/service";
import { type Channel, channelOf } from "@flyee/catalog/channels";
import { latestVersion } from "@flyee/catalog/semver";
import { BATCH_LIMIT, sendUpdatesDigestBatch, type UpdatesDigestEmailProps } from "@flyee/email";
import { inngest } from "@flyee/jobs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The weekly summary of new versions.
 *
 * Once a week, a member whose installed apps got a new version in the last
 * seven days is told so: a bell notice for everyone, and an e-mail for those
 * who did not turn the news off. The rule of who is told what is
 * `pendingUpdates` (lib/updates-digest.ts); this file does the reads and the
 * sends.
 *
 * The bell row is the fence. Its key names the week, so a second run of the
 * same week writes nothing and, finding nobody new, e-mails nobody: the
 * summary goes out once per member per week whatever happens to the cron.
 */

/**
 * A week plus a margin: the cron does not start at the same second every week,
 * and a version published in the gap between two runs must not fall through.
 */
const WINDOW_MS = 7 * 86_400_000 + 6 * 3_600_000;

const NEWS_PATH = "/novidades";

export type UpdatesDigestOutcome = {
  /** Members with at least one new version waiting. */
  members: number;
  notified: number;
  emailed: number;
  failed: number;
  week: string;
  reason?: string;
};

type ModuleRow = { id: string; slug: string; name: unknown };
type VersionRow = { module_id: string; version: string; published_at: string | null };

export async function sendUpdatesDigest(
  service: SupabaseClient,
  now: number = Date.now(),
): Promise<UpdatesDigestOutcome> {
  const week = isoWeekKey(now);
  const outcome: UpdatesDigestOutcome = { members: 0, notified: 0, emailed: 0, failed: 0, week };
  const since = now - WINDOW_MS;

  // 1. What the store published: the newest version of each published app.
  const modules = await fetchAllPages<ModuleRow>((from, to) =>
    service.from("catalog_modules").select("id, slug, name").eq("status", "published").order("id").range(from, to),
  );
  if (modules.error) throw new Error(`catalog_modules read failed: ${modules.error}`);
  const versions = await fetchAllPages<VersionRow>((from, to) =>
    service
      .from("catalog_module_versions")
      .select("module_id, version, published_at")
      .eq("status", "published")
      .order("id")
      .range(from, to),
  );
  if (versions.error) throw new Error(`catalog_module_versions read failed: ${versions.error}`);

  const byModule = new Map<string, VersionRow[]>();
  for (const row of versions.data) byModule.set(row.module_id, [...(byModule.get(row.module_id) ?? []), row]);
  const latestBySlug = new Map<string, LatestVersion>();
  const nameBySlug = new Map<string, unknown>();
  for (const app of modules.data) {
    const latest = latestVersion(byModule.get(app.id) ?? []);
    if (!latest) continue;
    latestBySlug.set(app.slug, { version: latest.version, publishedAt: latest.published_at ?? null });
    nameBySlug.set(app.slug, app.name);
  }
  // Nothing came out this week: no machine has to be read.
  const anyNew = [...latestBySlug.values()].some((latest) => Date.parse(latest.publishedAt ?? "") >= since);
  if (!anyNew) return { ...outcome, reason: "nothing-new" };

  // 2. The machines, and which of them can still update.
  const devices = await fetchAllPages<{
    user_id: string;
    org_id: string;
    device_id: string;
    installed_modules: unknown;
  }>((from, to) =>
    service
      .from("member_devices")
      .select("user_id, org_id, device_id, installed_modules")
      .is("revoked_at", null)
      .order("id")
      .range(from, to),
  );
  if (devices.error) throw new Error(`member_devices read failed: ${devices.error}`);
  const tokens = await fetchAllPages<{ user_id: string; device_id: string | null }>((from, to) =>
    service
      .from("oauth_tokens")
      .select("user_id, device_id")
      .is("revoked_at", null)
      .gt("refresh_expires_at", new Date(now).toISOString())
      .not("device_id", "is", null)
      .order("id")
      .range(from, to),
  );
  if (tokens.error) throw new Error(`oauth_tokens read failed: ${tokens.error}`);

  const behind = pendingUpdates({
    devices: devices.data.map(
      (row): DigestDevice => ({ userId: row.user_id, deviceId: row.device_id, installed: row.installed_modules }),
    ),
    liveDevices: new Set(tokens.data.map((row) => deviceKey(row.user_id, row.device_id ?? ""))),
    latestBySlug,
    since,
  });

  // 3. Only an account whose channel brings new versions: the account with no
  // purchase keeps the entry version of each app (migration 0040).
  const orgOf = new Map(devices.data.map((row) => [row.user_id, row.org_id]));
  const channels = new Map<string, Channel | null>();
  for (const orgId of new Set([...behind.keys()].flatMap((userId) => orgOf.get(userId) ?? []))) {
    const { data, error } = await service.rpc("org_entitlements", { target_org: orgId });
    const rights = error ? null : (data as { active?: boolean; limits?: Record<string, unknown> } | null);
    channels.set(orgId, rights?.active ? channelOf(rights.limits) : null);
  }
  const pending = keepUpdatingAccounts(behind, (userId) => channels.get(orgOf.get(userId) ?? "") ?? null);
  outcome.members = pending.size;
  if (pending.size === 0) return { ...outcome, reason: "nobody-behind" };

  // 4. The bell for everyone, then the e-mail for whoever just got a NEW notice.
  const readers = await readRecipientMap(service, [...pending.keys()]);
  const mail: { to: string; props: UpdatesDigestEmailProps }[] = [];
  for (const [userId, updates] of pending) {
    const reader: Recipient | undefined = readers.get(userId);
    if (!reader) continue;
    const bell = await notifyUser(userId, {
      type: "system",
      ...bellCopyFor(reader.locale).updatesAvailable(updates.length),
      href: NEWS_PATH,
      sourceKey: `updates:${week}`,
    });
    if ((bell.created ?? 0) === 0) continue;
    outcome.notified += 1;
    // The summary is news: a member who turned it off keeps the bell only.
    if (reader.optedOut || !reader.unsubscribeToken) continue;
    mail.push({
      to: reader.email,
      props: {
        locale: reader.locale,
        items: updates.map((update) => ({
          name: localizedText(nameBySlug.get(update.slug), update.slug, reader.locale),
          from: update.from,
          to: update.to,
        })),
        newsUrl: memberUrl(NEWS_PATH),
        unsubscribeUrl: unsubscribeUrl("member", reader.unsubscribeToken, reader.locale),
      },
    });
  }

  for (let start = 0; start < mail.length; start += BATCH_LIMIT) {
    const batch = mail.slice(start, start + BATCH_LIMIT);
    const sent = await sendUpdatesDigestBatch(batch);
    if (sent.sent) outcome.emailed += sent.count;
    else if (sent.error) outcome.failed += batch.length;
  }
  if (outcome.failed > 0) console.error("updates_digest_emails_failed", { failed: outcome.failed, week });
  return outcome;
}

/** Tuesdays at 10:00 in Brasília (13:00 UTC): a working day, clear of the Monday operator digest. */
export const updatesDigestCronFunction = inngest.createFunction(
  { id: "flyee-updates-digest", retries: 1, concurrency: { limit: 1 } },
  { cron: "0 13 * * 2" },
  async ({ step }) => step.run("send-updates-digest", async () => sendUpdatesDigest(createServiceClient())),
);

/** The same run, started by hand (`flyee/updates.digest`). */
export const updatesDigestManualFunction = inngest.createFunction(
  { id: "flyee-updates-digest-manual", retries: 1, concurrency: { limit: 1 } },
  { event: "flyee/updates.digest" },
  async ({ step }) => step.run("send-updates-digest", async () => sendUpdatesDigest(createServiceClient())),
);

export const updatesDigestFunctions = [updatesDigestCronFunction, updatesDigestManualFunction];
