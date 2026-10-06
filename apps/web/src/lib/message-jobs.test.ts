// @vitest-environment node
import {
  keptAccess,
  notifySubscriptionEnded,
  sendAccessEndNotices,
  sendTermEndNotices,
  settleAccessEndings,
} from "./billing-notices";
import { sweepStagedUploads } from "./maintenance-jobs";
import { deliverMeetingEmails } from "./meeting-email";
import { deliverNewsletter, deliverNewsletterBatch } from "./newsletter";
import { sendTokenReminders } from "./token-jobs";
import { decodeUnsubscribeCookie, encodeUnsubscribeCookie, parseUnsubscribe, unsubscribe } from "./unsubscribe";
import { sendUpdatesDigest } from "./updates-digest-jobs";
import { isNewAccount, welcomeOnce } from "./welcome";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The jobs are wired to Inngest, Resend and the service role. None of that is
 * what these tests are about. What is worth pinning is the bookkeeping: who is
 * written to, that nobody is written to twice, what happens when the provider
 * refuses a request or does not exist, and that a notice never takes a billing
 * event down with it.
 */
const mocks = vi.hoisted(() => ({
  configured: true,
  service: null as unknown,
  notifyUser: vi.fn(),
  notifyLocalized: vi.fn(),
  sendTokenReminderEmail: vi.fn(),
  sendMeetingEmailBatch: vi.fn(),
  sendNewsletterBatch: vi.fn(),
  sendUpdatesDigestBatch: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
  sendTermEndingEmail: vi.fn(),
  sendAccessEndedEmail: vi.fn(),
  sendMemberWelcomeEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => undefined }) }));
vi.mock("@flyee/jobs", () => ({
  inngest: { createFunction: () => ({}) },
  sendEvent: vi.fn(async () => ({ sent: false, hint: "no queue in tests" })),
}));
vi.mock("@flyee/auth/service", () => ({ createServiceClient: () => mocks.service }));
vi.mock("@/lib/catalog/upload", () => ({ MODULES_BUCKET: "modules" }));
vi.mock("@/lib/notifications", () => ({ notifyUser: mocks.notifyUser, notifyLocalized: mocks.notifyLocalized }));
vi.mock("@flyee/email", () => ({
  BATCH_LIMIT: 100,
  get isEmailConfigured() {
    return mocks.configured;
  },
  sendTokenReminderEmail: mocks.sendTokenReminderEmail,
  sendMeetingEmailBatch: mocks.sendMeetingEmailBatch,
  sendNewsletterBatch: mocks.sendNewsletterBatch,
  sendUpdatesDigestBatch: mocks.sendUpdatesDigestBatch,
  sendSubscriptionCanceledEmail: mocks.sendSubscriptionCanceledEmail,
  sendTermEndingEmail: mocks.sendTermEndingEmail,
  sendAccessEndedEmail: mocks.sendAccessEndedEmail,
  sendMemberWelcomeEmail: mocks.sendMemberWelcomeEmail,
  sendKitReceiptEmail: vi.fn(),
  sendSubscriptionActiveEmail: vi.fn(),
}));

type Answer = { data?: unknown; error?: { message: string } | null; count?: number | null };
type Query = { table: string; calls: [string, ...unknown[]][] };

/**
 * A stand-in for the service client. `rpc` answers come from a handler per
 * function name; a table answers through a handler that sees every call made
 * on the query (select, eq, in, update…), so a test can assert on the filters.
 */
function fakeService(handlers: {
  rpc?: Record<string, (args: Record<string, unknown>) => Answer>;
  tables?: Record<string, (query: Query) => Answer>;
  storage?: { list: () => Answer; remove: (paths: string[]) => Answer };
}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const queries: Query[] = [];

  const builder = (table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    const answer = () => ({ data: null, error: null, ...(handlers.tables?.[table]?.(query) ?? {}) });
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(answer()).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            query.calls.push([name, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const service = {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ fn, args });
      const handler = handlers.rpc?.[fn];
      if (!handler) throw new Error(`unexpected rpc: ${fn}`);
      return { data: null, error: null, ...handler(args) };
    },
    from: (table: string) => builder(table),
    storage: {
      from: () => ({
        list: async () => ({ data: null, error: null, ...(handlers.storage?.list() ?? {}) }),
        remove: async (paths: string[]) => ({ data: null, error: null, ...(handlers.storage?.remove(paths) ?? {}) }),
      }),
    },
  };
  return { service: service as unknown as SupabaseClient, rpcCalls, queries };
}

const recipient = (userId: string, overrides: Record<string, unknown> = {}) => ({
  user_id: userId,
  email: `${userId}@flyee.invalid`,
  display_name: userId,
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  marketing_email_opt_out: false,
  email_unsubscribe_token: "00000000-0000-4000-8000-0000000000aa",
  ...overrides,
});

const recipients =
  (...rows: ReturnType<typeof recipient>[]) =>
  (args: Record<string, unknown>) => ({
    data: rows.filter((row) => (args.target_users as string[]).includes(row.user_id)),
  });

beforeEach(() => {
  mocks.configured = true;
  mocks.service = null;
  mocks.notifyUser.mockReset().mockResolvedValue({ sent: true, created: 1, createdFor: ["x"] });
  mocks.notifyLocalized.mockReset().mockResolvedValue({ sent: true, created: 1, createdFor: ["x"] });
  mocks.sendTokenReminderEmail.mockReset().mockResolvedValue({ sent: true });
  mocks.sendMeetingEmailBatch
    .mockReset()
    .mockImplementation(async (messages: unknown[]) => ({ sent: true, count: messages.length }));
  mocks.sendNewsletterBatch
    .mockReset()
    .mockImplementation(async (messages: unknown[]) => ({ sent: true, count: messages.length }));
  mocks.sendUpdatesDigestBatch
    .mockReset()
    .mockImplementation(async (messages: unknown[]) => ({ sent: true, count: messages.length }));
  mocks.sendSubscriptionCanceledEmail.mockReset().mockResolvedValue({ sent: true });
  mocks.sendTermEndingEmail.mockReset().mockResolvedValue({ sent: true });
  mocks.sendAccessEndedEmail.mockReset().mockResolvedValue({ sent: true });
  mocks.sendMemberWelcomeEmail.mockReset().mockResolvedValue({ sent: true });
});

describe("the connection reminder", () => {
  const NOW = Date.parse("2026-10-02T13:00:00Z");
  const claim = {
    family_id: "family-1",
    user_id: "ana",
    org_id: "org-1",
    device_id: "laptop",
    device_name: "notebook",
    refresh_expires_at: "2026-10-06T12:00:00Z",
  };

  it("writes one bell notice and one e-mail per claimed connection, in the reader's language", async () => {
    const { service } = fakeService({
      rpc: {
        claim_token_reminders: () => ({ data: [claim] }),
        member_recipients: recipients(recipient("ana", { locale: "en" })),
      },
    });
    const outcome = await sendTokenReminders(service, NOW);

    expect(outcome).toEqual({ claimed: 1, notified: 1, emailed: 1, failed: 0 });
    const [userId, notice] = mocks.notifyUser.mock.calls[0];
    expect(userId).toBe("ana");
    expect(notice.title).toBe("Your computer's connection expires in 4 days");
    expect(notice.href).toBe("/settings/devices");
    // The key names the expiry, so a renewed connection is reminded again next month.
    expect(notice.sourceKey).toBe("token-reminder:family-1:2026-10-06");
    const [to, props] = mocks.sendTokenReminderEmail.mock.calls[0];
    expect(to).toBe("ana@flyee.invalid");
    expect(props).toMatchObject({ locale: "en", deviceName: "notebook", daysLeft: 4 });
    expect(props.devicesUrl).toMatch(/\/settings\/devices$/);
  });

  it("writes to nobody when the account has no address or is banned", async () => {
    const { service } = fakeService({
      rpc: { claim_token_reminders: () => ({ data: [claim] }), member_recipients: () => ({ data: [] }) },
    });
    expect(await sendTokenReminders(service, NOW)).toEqual({ claimed: 1, notified: 0, emailed: 0, failed: 0 });
    expect(mocks.notifyUser).not.toHaveBeenCalled();
    expect(mocks.sendTokenReminderEmail).not.toHaveBeenCalled();
  });

  it("reads no recipient when nothing is due, and counts a refused e-mail as failed", async () => {
    const quiet = fakeService({ rpc: { claim_token_reminders: () => ({ data: [] }) } });
    expect(await sendTokenReminders(quiet.service, NOW)).toEqual({ claimed: 0, notified: 0, emailed: 0, failed: 0 });
    expect(quiet.rpcCalls.map((call) => call.fn)).toEqual(["claim_token_reminders"]);

    mocks.sendTokenReminderEmail.mockResolvedValue({ sent: false, error: "rate limited" });
    const refused = fakeService({
      rpc: { claim_token_reminders: () => ({ data: [claim] }), member_recipients: recipients(recipient("ana")) },
    });
    expect(await sendTokenReminders(refused.service, NOW)).toMatchObject({ emailed: 0, failed: 1 });
  });

  it("stops when the claim itself fails, so the queue retries the run", async () => {
    const { service } = fakeService({ rpc: { claim_token_reminders: () => ({ error: { message: "down" } }) } });
    await expect(sendTokenReminders(service, NOW)).rejects.toThrow("claim_token_reminders failed");
  });
});

describe("the messages of a meeting", () => {
  const meetingRow = {
    id: "meeting-1",
    slug: "sessao-outubro",
    title: { "pt-BR": "Sessão de outubro", en: "October session" },
    starts_at: "2026-10-09T22:00:00Z",
  };
  const claims = [
    {
      registration_id: "r1",
      user_id: "ana",
      email: "ana@flyee.invalid",
      display_name: "Ana",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
    },
    {
      registration_id: "r2",
      user_id: "bob",
      email: "bob@flyee.invalid",
      display_name: "Bob",
      locale: "en",
      timezone: "America/New_York",
    },
  ];

  it("writes to each registrant in their language and on their own clock", async () => {
    let claimed = false;
    const { service } = fakeService({
      tables: { meetings: () => ({ data: meetingRow }) },
      rpc: {
        claim_meeting_emails: () => {
          const data = claimed ? [] : claims;
          claimed = true;
          return { data };
        },
      },
    });
    const outcome = await deliverMeetingEmails(service, { meetingId: "meeting-1", kind: "day" });

    expect(outcome).toMatchObject({ claimed: 2, emailed: 2, notified: 2, released: 0 });
    const messages = mocks.sendMeetingEmailBatch.mock.calls[0][0];
    expect(messages[0].props).toMatchObject({ locale: "pt-BR", kind: "day", title: "Sessão de outubro" });
    expect(messages[0].props.whenLabel).toContain("19:00");
    expect(messages[1].props).toMatchObject({ locale: "en", title: "October session" });
    expect(messages[1].props.whenLabel).toMatch(/0?6:00\sPM/);
    expect(messages[0].props.meetingUrl).toMatch(/\/encontros\/sessao-outubro$/);
    // The bell notice is keyed per meeting and kind: a retry cannot write it twice.
    expect(mocks.notifyUser.mock.calls[0][1].sourceKey).toBe("meeting:meeting-1:day");
  });

  it("writes no bell notice for a confirmation, and narrows the claim to who just registered", async () => {
    const { service, rpcCalls } = fakeService({
      tables: { meetings: () => ({ data: meetingRow }) },
      rpc: { claim_meeting_emails: () => ({ data: [claims[0]] }) },
    });
    const outcome = await deliverMeetingEmails(service, {
      meetingId: "meeting-1",
      kind: "confirmation",
      userId: "ana",
    });
    expect(outcome).toMatchObject({ claimed: 1, emailed: 1, notified: 0 });
    expect(mocks.notifyUser).not.toHaveBeenCalled();
    expect(rpcCalls[0].args).toMatchObject({ target_kind: "confirmation", target_user: "ana" });
  });

  it("claims nobody for a confirmation when there is no e-mail provider", async () => {
    mocks.configured = false;
    const { service, rpcCalls } = fakeService({ tables: { meetings: () => ({ data: meetingRow }) } });
    const outcome = await deliverMeetingEmails(service, { meetingId: "meeting-1", kind: "confirmation" });
    expect(outcome).toMatchObject({ claimed: 0, reason: "email-not-configured" });
    expect(rpcCalls).toEqual([]);
  });

  it("still rings the bell for a reminder when there is no e-mail provider", async () => {
    mocks.configured = false;
    mocks.sendMeetingEmailBatch.mockResolvedValue({ sent: false, count: 0 });
    const { service, queries } = fakeService({
      tables: { meetings: () => ({ data: meetingRow }) },
      rpc: { claim_meeting_emails: () => ({ data: [claims[0]] }) },
    });
    const outcome = await deliverMeetingEmails(service, { meetingId: "meeting-1", kind: "hour" });
    expect(outcome).toMatchObject({ claimed: 1, emailed: 0, notified: 1, released: 0 });
    // Nothing is given back: the bell was the delivery.
    expect(queries.some((query) => query.table === "meeting_registrations")).toBe(false);
  });

  it("gives the registrations back when the provider refuses the batch", async () => {
    mocks.sendMeetingEmailBatch.mockResolvedValue({ sent: false, count: 0, error: "domain not verified" });
    const { service, queries } = fakeService({
      tables: { meetings: () => ({ data: meetingRow }), meeting_registrations: () => ({ error: null }) },
      rpc: { claim_meeting_emails: () => ({ data: claims }) },
    });
    const outcome = await deliverMeetingEmails(service, { meetingId: "meeting-1", kind: "day" });

    expect(outcome).toMatchObject({ claimed: 2, emailed: 0, released: 2, error: "domain not verified" });
    const release = queries.find((query) => query.table === "meeting_registrations");
    expect(release?.calls).toEqual([
      ["update", { reminder_day_sent_at: null }],
      ["in", "id", ["r1", "r2"]],
    ]);
  });

  it("does nothing for a meeting that no longer exists", async () => {
    const { service, rpcCalls } = fakeService({ tables: { meetings: () => ({ data: null }) } });
    expect(await deliverMeetingEmails(service, { meetingId: "gone", kind: "day" })).toMatchObject({
      claimed: 0,
      reason: "no-meeting",
    });
    expect(rpcCalls).toEqual([]);
  });
});

describe("a message to the list", () => {
  const lead = (id: string, locale = "pt-BR") => ({
    lead_id: id,
    email: `${id}@flyee.invalid`,
    locale,
    unsubscribe_token: "00000000-0000-4000-8000-0000000000bb",
    subject: locale === "en" ? "We are open" : "Abrimos",
    body_md: locale === "en" ? "The store is open." : "A loja abriu.",
  });

  it("claims, sends and counts a batch, each reader with their own unsubscribe address", async () => {
    const { service, rpcCalls } = fakeService({
      rpc: {
        claim_newsletter_batch: () => ({ data: [lead("l1"), lead("l2", "en")] }),
        settle_newsletter_batch: () => ({}),
      },
    });
    expect(await deliverNewsletterBatch(service, "send-1")).toEqual({ claimed: 2, delivered: 2 });

    const messages = mocks.sendNewsletterBatch.mock.calls[0][0];
    expect(messages[0]).toMatchObject({ to: "l1@flyee.invalid", locale: "pt-BR", subject: "Abrimos" });
    expect(messages[1]).toMatchObject({ locale: "en", subject: "We are open", bodyMarkdown: "The store is open." });
    expect(new URL(messages[1].unsubscribeUrl).searchParams.get("k")).toBe("l");
    expect(new URL(messages[1].unsubscribeUrl).searchParams.get("l")).toBe("en");
    expect(rpcCalls[1]).toEqual({
      fn: "settle_newsletter_batch",
      args: { target_send: "send-1", target_leads: ["l1", "l2"], target_delivered: true, target_error: null },
    });
  });

  it("gives the readers back and stops when the provider refuses the batch", async () => {
    mocks.sendNewsletterBatch.mockResolvedValue({ sent: false, count: 0, error: "quota exceeded" });
    const { service, rpcCalls } = fakeService({
      rpc: { claim_newsletter_batch: () => ({ data: [lead("l1")] }), settle_newsletter_batch: () => ({}) },
    });
    expect(await deliverNewsletterBatch(service, "send-1")).toEqual({
      claimed: 1,
      delivered: 0,
      error: "quota exceeded",
    });
    expect(rpcCalls[1].args).toMatchObject({ target_delivered: false, target_error: "quota exceeded" });
  });

  it("closes the send when nobody is left", async () => {
    const { service, rpcCalls } = fakeService({
      rpc: { claim_newsletter_batch: () => ({ data: [] }), finish_newsletter_send: () => ({}) },
    });
    expect(await deliverNewsletterBatch(service, "send-1")).toEqual({ claimed: 0, delivered: 0 });
    expect(rpcCalls.map((call) => call.fn)).toEqual(["claim_newsletter_batch", "finish_newsletter_send"]);
    expect(mocks.sendNewsletterBatch).not.toHaveBeenCalled();
  });

  it("claims nobody when there is no e-mail provider, so the send stays as it is", async () => {
    mocks.configured = false;
    const { service, rpcCalls } = fakeService({});
    expect(await deliverNewsletterBatch(service, "send-1")).toEqual({
      claimed: 0,
      delivered: 0,
      error: "email_not_configured",
    });
    expect(rpcCalls).toEqual([]);
  });

  it("runs batch after batch until the list is exhausted", async () => {
    const batches = [[lead("l1"), lead("l2")], [lead("l3")], []];
    const { service } = fakeService({
      rpc: {
        claim_newsletter_batch: () => ({ data: batches.shift() ?? [] }),
        settle_newsletter_batch: () => ({}),
        finish_newsletter_send: () => ({}),
      },
    });
    expect(await deliverNewsletter(service, "send-1")).toEqual({ batches: 2, delivered: 3, done: true });
  });

  it("stops at the first refused batch and says why", async () => {
    mocks.sendNewsletterBatch.mockResolvedValue({ sent: false, count: 0, error: "quota exceeded" });
    const { service } = fakeService({
      rpc: { claim_newsletter_batch: () => ({ data: [lead("l1")] }), settle_newsletter_batch: () => ({}) },
    });
    expect(await deliverNewsletter(service, "send-1")).toEqual({
      batches: 0,
      delivered: 0,
      done: false,
      error: "quota exceeded",
    });
  });
});

describe("what a workspace is told when a subscription ends", () => {
  const entitlements = (limits: Record<string, number>, sources: unknown[], active = true) => ({
    data: { active, limits, sources },
  });

  it("names the purchase that still unlocks the store", async () => {
    const { service } = fakeService({
      rpc: {
        org_entitlements: () =>
          entitlements({ catalog_access: 1 }, [
            { type: "free", plan_id: "plan-free" },
            { type: "grant", plan_id: "plan-kit" },
          ]),
      },
      tables: { plans: () => ({ data: [{ id: "plan-kit", name: "Acesso flyee", limits: { catalog_access: 1 } }] }) },
    });
    expect(await keptAccess(service, "org-1")).toEqual({ by: "Acesso flyee" });
  });

  it("says nothing unlocks it when the access is gone or the workspace is suspended", async () => {
    const gone = fakeService({ rpc: { org_entitlements: () => entitlements({ catalog_access: 0 }, []) } });
    expect(await keptAccess(gone.service, "org-1")).toBeNull();
    const suspended = fakeService({
      rpc: { org_entitlements: () => entitlements({ catalog_access: 1 }, [{ type: "grant", plan_id: "p" }], false) },
    });
    expect(await keptAccess(suspended.service, "org-1")).toBeNull();
  });

  it("keeps the access unnamed when no plan stands behind it", async () => {
    const { service } = fakeService({ rpc: { org_entitlements: () => entitlements({ catalog_access: 1 }, []) } });
    expect(await keptAccess(service, "org-1")).toEqual({ by: null });
  });

  it("writes the bell for every member and the e-mail for who manages the workspace", async () => {
    const { service } = fakeService({
      rpc: {
        org_entitlements: () => entitlements({ catalog_access: 0 }, []),
        member_recipients: recipients(recipient("owner", { locale: "en" })),
      },
      tables: {
        plans: () => ({ data: { name: "FlyeeClub Pro", limits: {} } }),
        memberships: () => ({ data: [{ user_id: "owner" }] }),
      },
    });
    await notifySubscriptionEnded(service, {
      orgId: "org-1",
      planId: "plan-club",
      cause: "payment",
      endedAt: "2026-10-02T15:00:00Z",
    });

    const [members, write, options] = mocks.notifyLocalized.mock.calls[0];
    expect(members).toEqual(["owner"]);
    expect(options).toMatchObject({ type: "billing", href: "/settings/billing" });
    expect(
      write({ subscriptionEnded: (plan: string, keeps: boolean) => ({ title: plan, body: String(keeps) }) }),
    ).toEqual({
      title: "FlyeeClub Pro",
      body: "false",
    });
    const [to, props] = mocks.sendSubscriptionCanceledEmail.mock.calls[0];
    expect(to).toBe("owner@flyee.invalid");
    expect(props).toMatchObject({
      locale: "en",
      planName: "FlyeeClub Pro",
      cause: "payment",
      endedLabel: "October 2, 2026",
      keptAccess: null,
    });
  });

  it("never throws: a notice that fails must not replay the billing event above it", async () => {
    const { service } = fakeService({
      tables: { plans: () => ({ data: { name: "FlyeeClub Pro", limits: {} } }) },
      rpc: { org_entitlements: () => ({ error: { message: "down" } }) },
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      notifySubscriptionEnded(service, { orgId: "org-1", planId: "plan-club", cause: "requested" }),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(
      "billing_notice_failed",
      expect.objectContaining({ what: "subscription_ended" }),
    );
    expect(mocks.sendSubscriptionCanceledEmail).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("announces the end of a paid period once per claim, keyed by subscription and end date", async () => {
    const { service } = fakeService({
      rpc: {
        claim_term_end_notices: () => ({
          data: [
            {
              subscription_id: "sub-1",
              org_id: "org-1",
              plan_name: "Assinatura anual",
              current_period_end: "2026-10-17T03:00:00Z",
            },
          ],
        }),
        member_recipients: recipients(recipient("owner")),
      },
      tables: { memberships: () => ({ data: [{ user_id: "owner" }] }) },
    });
    expect(await sendTermEndNotices(service)).toEqual({ claimed: 1, notified: 1, emailed: 1 });
    expect(mocks.notifyLocalized.mock.calls[0][2]).toMatchObject({ sourceKey: "term-ending:sub-1:2026-10-17" });
    expect(mocks.sendTermEndingEmail.mock.calls[0][1]).toMatchObject({
      planName: "Assinatura anual",
      endsLabel: "17 de outubro de 2026",
    });
  });

  it("announces the end of an access term with the same words, keyed by the grant", async () => {
    const { service } = fakeService({
      rpc: {
        claim_access_end_notices: () => ({
          data: [
            { grant_id: "grant-1", org_id: "org-1", plan_name: "Acesso flyee", expires_at: "2026-10-20T03:00:00Z" },
          ],
        }),
        member_recipients: recipients(recipient("owner")),
      },
      tables: { memberships: () => ({ data: [{ user_id: "owner" }] }) },
    });
    expect(await sendAccessEndNotices(service)).toEqual({ claimed: 1, notified: 1, emailed: 1 });
    expect(mocks.notifyLocalized.mock.calls[0][2]).toMatchObject({ sourceKey: "access-ending:grant-1" });
    expect(mocks.sendTermEndingEmail.mock.calls[0][1]).toMatchObject({
      planName: "Acesso flyee",
      endsLabel: "20 de outubro de 2026",
    });
  });

  it("settles an ended access: told and disconnected when nothing else keeps the store open", async () => {
    const claims = [
      { grant_id: "grant-1", org_id: "org-gone", plan_name: "Acesso flyee", expires_at: "2026-10-05T03:00:00Z" },
      { grant_id: "grant-2", org_id: "org-kept", plan_name: "Acesso flyee", expires_at: "2026-10-05T03:00:00Z" },
    ];
    const { service, rpcCalls } = fakeService({
      rpc: {
        claim_access_endings: () => ({ data: claims }),
        org_entitlements: (args) => ({
          data: { active: true, limits: { catalog_access: args.target_org === "org-kept" ? 1 : 0 } },
        }),
        revoke_member_tokens: () => ({ data: 2 }),
        member_recipients: recipients(recipient("owner")),
      },
      tables: { memberships: () => ({ data: [{ user_id: "owner" }] }) },
    });
    expect(await settleAccessEndings(service)).toEqual({ claimed: 2, ended: 1, kept: 1, emailed: 1 });
    expect(rpcCalls.filter((call) => call.fn === "revoke_member_tokens")).toEqual([
      { fn: "revoke_member_tokens", args: { target_org: "org-gone", target_reason: "canceled" } },
    ]);
    expect(mocks.notifyLocalized.mock.calls[0][2]).toMatchObject({ sourceKey: "access-ended:grant-1" });
    expect(mocks.sendAccessEndedEmail.mock.calls[0][1]).toMatchObject({
      planName: "Acesso flyee",
      endedLabel: "5 de outubro de 2026",
    });
  });
});

describe("the weekly summary of new versions", () => {
  const NOW = Date.parse("2026-10-06T13:00:00Z");
  const published = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

  const store = (versionAge: number, extra: Parameters<typeof fakeService>[0]["tables"] = {}) => ({
    catalog_modules: () => ({
      data: [{ id: "m1", slug: "deploy-check", name: { "pt-BR": "Checagem de deploy", en: "Deploy check" } }],
    }),
    catalog_module_versions: () => ({
      data: [
        { module_id: "m1", version: "1.1.0", published_at: published(40) },
        { module_id: "m1", version: "1.2.0", published_at: published(versionAge) },
      ],
    }),
    ...extra,
  });
  const machines = {
    member_devices: () => ({
      data: [{ user_id: "ana", device_id: "laptop", installed_modules: [{ slug: "deploy-check", version: "1.1.0" }] }],
    }),
    oauth_tokens: () => ({ data: [{ user_id: "ana", device_id: "laptop" }] }),
  };

  it("reads no machine in a week with no release", async () => {
    const { service, queries } = fakeService({ tables: store(20, machines) });
    const outcome = await sendUpdatesDigest(service, NOW);
    expect(outcome).toMatchObject({ members: 0, reason: "nothing-new", week: "2026-W41" });
    expect(queries.map((query) => query.table)).toEqual(["catalog_modules", "catalog_module_versions"]);
  });

  it("rings the bell and e-mails a member whose app got a new version", async () => {
    const { service } = fakeService({
      tables: store(2, machines),
      rpc: { member_recipients: recipients(recipient("ana", { locale: "en" })) },
    });
    const outcome = await sendUpdatesDigest(service, NOW);

    expect(outcome).toMatchObject({ members: 1, notified: 1, emailed: 1, failed: 0 });
    expect(mocks.notifyUser.mock.calls[0][1]).toMatchObject({
      title: "1 of your apps has a new version",
      href: "/novidades",
      sourceKey: "updates:2026-W41",
    });
    const [message] = mocks.sendUpdatesDigestBatch.mock.calls[0][0];
    expect(message.to).toBe("ana@flyee.invalid");
    expect(message.props.items).toEqual([{ name: "Deploy check", from: "1.1.0", to: "1.2.0" }]);
    expect(new URL(message.props.unsubscribeUrl).searchParams.get("k")).toBe("m");
  });

  it("keeps the bell and skips the e-mail for a member who turned the news off", async () => {
    const { service } = fakeService({
      tables: store(2, machines),
      rpc: { member_recipients: recipients(recipient("ana", { marketing_email_opt_out: true })) },
    });
    const outcome = await sendUpdatesDigest(service, NOW);
    expect(outcome).toMatchObject({ members: 1, notified: 1, emailed: 0 });
    expect(mocks.sendUpdatesDigestBatch).not.toHaveBeenCalled();
  });

  it("e-mails nobody on a second run of the same week", async () => {
    mocks.notifyUser.mockResolvedValue({ sent: true, created: 0, createdFor: [] });
    const { service } = fakeService({
      tables: store(2, machines),
      rpc: { member_recipients: recipients(recipient("ana")) },
    });
    const outcome = await sendUpdatesDigest(service, NOW);
    expect(outcome).toMatchObject({ members: 1, notified: 0, emailed: 0 });
    expect(mocks.sendUpdatesDigestBatch).not.toHaveBeenCalled();
  });

  it("leaves out a machine whose connection is no longer live", async () => {
    const { service } = fakeService({
      tables: store(2, { ...machines, oauth_tokens: () => ({ data: [] }) }),
    });
    expect(await sendUpdatesDigest(service, NOW)).toMatchObject({ members: 0, reason: "nobody-behind" });
  });
});

describe("the welcome of a new account", () => {
  it("is for an account created within the week", () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    expect(isNewAccount("2026-10-02T11:50:00Z", now)).toBe(true);
    expect(isNewAccount("2026-09-27T12:00:00Z", now)).toBe(true);
    expect(isNewAccount("2026-09-20T12:00:00Z", now)).toBe(false);
    expect(isNewAccount(null, now)).toBe(false);
    expect(isNewAccount("not a date", now)).toBe(false);
  });

  it("sends the e-mail only with the first bell notice", async () => {
    mocks.service = fakeService({ rpc: { member_recipients: recipients(recipient("ana", { locale: "en" })) } }).service;
    await welcomeOnce("ana");
    expect(mocks.notifyLocalized.mock.calls[0][2]).toMatchObject({ sourceKey: "welcome", href: "/inicio" });
    expect(mocks.sendMemberWelcomeEmail).toHaveBeenCalledWith(
      "ana@flyee.invalid",
      expect.objectContaining({ locale: "en", name: "ana" }),
    );

    mocks.sendMemberWelcomeEmail.mockClear();
    mocks.notifyLocalized.mockResolvedValue({ sent: true, created: 0, createdFor: [] });
    await welcomeOnce("ana");
    expect(mocks.sendMemberWelcomeEmail).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    mocks.notifyLocalized.mockRejectedValue(new Error("down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(welcomeOnce("ana")).resolves.toBeUndefined();
    logged.mockRestore();
  });
});

describe("an unsubscribe link", () => {
  const token = "0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a4b";

  it("is read from the address and survives the trip through the cookie", () => {
    const member = parseUnsubscribe(new URLSearchParams({ k: "m", t: token }));
    expect(member).toEqual({ kind: "member", token });
    expect(decodeUnsubscribeCookie(encodeUnsubscribeCookie(member!))).toEqual(member);
    const lead = parseUnsubscribe(new URLSearchParams({ k: "l", t: token, l: "en" }));
    expect(lead).toEqual({ kind: "lead", token });
    expect(encodeUnsubscribeCookie(lead!)).toBe(`l:${token}`);
  });

  it("is refused when the kind or the token is not what the platform writes", () => {
    expect(parseUnsubscribe(new URLSearchParams({ k: "x", t: token }))).toBeNull();
    expect(parseUnsubscribe(new URLSearchParams({ k: "m", t: "not-a-token" }))).toBeNull();
    expect(parseUnsubscribe(new URLSearchParams({ k: "constructor", t: token }))).toBeNull();
    expect(parseUnsubscribe(new URLSearchParams())).toBeNull();
    expect(decodeUnsubscribeCookie("m:")).toBeNull();
    expect(decodeUnsubscribeCookie(`z:${token}`)).toBeNull();
    expect(decodeUnsubscribeCookie(null)).toBeNull();
  });

  it("changes the member's preference or the contact's, each through its own function", async () => {
    const fake = fakeService({
      rpc: { unsubscribe_profile: () => ({ data: true }), unsubscribe_lead: () => ({ data: true }) },
    });
    mocks.service = fake.service;
    expect(await unsubscribe({ kind: "member", token })).toBe(true);
    expect(await unsubscribe({ kind: "lead", token })).toBe(true);
    expect(fake.rpcCalls).toEqual([
      { fn: "unsubscribe_profile", args: { p_token: token } },
      { fn: "unsubscribe_lead", args: { target_token: token } },
    ]);
  });

  it("reports a request that could not be carried out", async () => {
    mocks.service = fakeService({ rpc: { unsubscribe_profile: () => ({ error: { message: "down" } }) } }).service;
    expect(await unsubscribe({ kind: "member", token })).toBe(false);
  });
});

describe("the sweep of unfinished uploads", () => {
  const NOW = Date.parse("2026-10-02T04:30:00Z");
  const file = (name: string, hoursAgo: number) => ({
    name,
    created_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  });

  it("removes staged files older than a day and leaves the ones still in flight", async () => {
    const removed: string[][] = [];
    const { service } = fakeService({
      storage: {
        list: () => ({ data: [file("old.zip", 30), file("older.zip", 72), file("fresh.zip", 1)] }),
        remove: (paths) => {
          removed.push(paths);
          return {};
        },
      },
    });
    expect(await sweepStagedUploads(service, NOW)).toBe(2);
    expect(removed).toEqual([["staging/old.zip", "staging/older.zip"]]);
  });

  it("removes nothing from an empty or recent folder", async () => {
    const { service } = fakeService({
      storage: { list: () => ({ data: [file("fresh.zip", 2)] }), remove: () => ({}) },
    });
    expect(await sweepStagedUploads(service, NOW)).toBe(0);
  });

  it("stops when storage cannot be listed", async () => {
    const { service } = fakeService({ storage: { list: () => ({ error: { message: "down" } }), remove: () => ({}) } });
    await expect(sweepStagedUploads(service, NOW)).rejects.toThrow("staging list failed");
  });
});
