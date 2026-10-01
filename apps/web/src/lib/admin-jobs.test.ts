import { sendWeeklyDigest } from "./admin-jobs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberTotals } from "@/lib/admin/members";
import type { SegmentWeekRow } from "@/lib/admin/metrics";
import { buildWeeklyDigest } from "@/lib/admin/weekly-digest";
import type { SupabaseClient } from "@supabase/supabase-js";

// The job is server-only and wired to Inngest, Resend and the service role.
// None of that is what the test is about: the logic worth pinning is WHEN the
// digest goes out, what it says, and that the same week never goes out twice.
const { notifyUsers, sendDigest } = vi.hoisted(() => ({ notifyUsers: vi.fn(), sendDigest: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@flyee/jobs", () => ({ inngest: { createFunction: () => ({ id: "admin-weekly-digest" }) } }));
vi.mock("@flyee/auth/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/notifications", () => ({ notifyUsers }));
vi.mock("@flyee/email", () => ({ sendAdminWeeklyDigestEmail: sendDigest }));

// Monday 2026-10-05, 08:30 in Brasília: the digest reports the week of 2026-09-28.
const NOW = new Date("2026-10-05T11:30:00Z").getTime();

const ZERO_TOTALS: MemberTotals = {
  accounts: 0,
  kit: 0,
  club: 0,
  pro: 0,
  noAccess: 0,
  pastDue: 0,
  noDevice: 0,
  staleUpdate: 0,
  suspended: 0,
  cancelScheduled: 0,
};

function row(week: string, segment: string, overrides: Partial<SegmentWeekRow> = {}): SegmentWeekRow {
  return {
    week_start: week,
    segment,
    kit_buyers: 0,
    page_views: 0,
    page_conversion: null,
    access_cohort: 0,
    activated_7d: 0,
    weekly_active: 0,
    kit_to_club_60d: 0,
    payers_90d: 0,
    revenue_90d_brl: 0,
    revenue_90d_usd: 0,
    payers_90d_brl: 0,
    payers_90d_usd: 0,
    ...overrides,
  };
}

const quietWeeks = ["2026-09-21", "2026-09-28", "2026-10-05"].flatMap((week) =>
  ["dev", "outro", "unknown"].map((segment) => row(week, segment)),
);

const busyWeeks = quietWeeks.map((entry) =>
  entry.week_start === "2026-09-28" && entry.segment === "dev"
    ? {
        ...entry,
        kit_buyers: 3,
        access_cohort: 4,
        activated_7d: 2,
        weekly_active: 5,
        payers_90d: 3,
        payers_90d_brl: 3,
        revenue_90d_brl: 29100,
      }
    : entry,
);

const supabaseWith = (weekly: SegmentWeekRow[], totals: MemberTotals, operators: { id: string }[] = [{ id: "op-1" }]) =>
  ({
    rpc: vi.fn(async (name: string) =>
      name === "admin_segment_weekly"
        ? { data: weekly, error: null }
        : { data: { generatedAt: "", totals, members: [] }, error: null },
    ),
    from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: operators, error: null }) }) })),
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: "operator@flyee.dev" } } })) } },
  }) as unknown as SupabaseClient;

beforeEach(() => {
  notifyUsers.mockReset().mockResolvedValue({ sent: true, created: 1, createdFor: ["op-1"] });
  sendDigest.mockReset().mockResolvedValue({ sent: true });
});

describe("weekly digest content", () => {
  it("says nothing about a week with nothing in it", () => {
    expect(buildWeeklyDigest(quietWeeks, {}, ZERO_TOTALS, NOW)).toBeNull();
  });

  it("reports the last COMPLETE week, never the one that just started", () => {
    const digest = buildWeeklyDigest(busyWeeks, {}, ZERO_TOTALS, NOW);
    expect(digest?.week).toBe("2026-09-28");
    expect(digest?.headline).toBe("Semana de 28/09: 3 compras do kit, 2 ativações, 5 com uso semanal");
    expect(digest?.rows.map((entry) => entry.segment)).toEqual(["Dev", "Outro", "Não informado"]);
    // The cohort of 28/09 can still activate until 12/10: the rate is marked open.
    expect(digest?.rows[0]).toMatchObject({ kit: "3", activation: "50%†", weekly: "5", revenue: "R$ 97" });
  });

  it("goes out for accounts that need someone even in a quiet week", () => {
    const digest = buildWeeklyDigest(quietWeeks, {}, { ...ZERO_TOTALS, pastDue: 2, staleUpdate: 1 }, NOW);
    expect(digest?.attention).toEqual([
      { label: "inadimplentes", count: 2 },
      { label: "sem atualizar há 25 dias ou mais", count: 1 },
    ]);
  });
});

describe("weekly digest job", () => {
  it("sends nothing when there is nothing to report", async () => {
    const outcome = await sendWeeklyDigest(supabaseWith(quietWeeks, ZERO_TOTALS), NOW);
    expect(outcome.reason).toBe("nothing-to-report");
    expect(notifyUsers).not.toHaveBeenCalled();
    expect(sendDigest).not.toHaveBeenCalled();
  });

  it("rings every operator once per week and e-mails only those it just notified", async () => {
    const outcome = await sendWeeklyDigest(supabaseWith(busyWeeks, ZERO_TOTALS), NOW);
    expect(outcome).toMatchObject({ notified: 1, emailed: 1, week: "2026-09-28" });
    expect(notifyUsers).toHaveBeenCalledWith(
      ["op-1"],
      expect.objectContaining({ href: "/admin/metricas", sourceKey: "admin-weekly:2026-09-28" }),
    );
    expect(sendDigest).toHaveBeenCalledWith(
      "operator@flyee.dev",
      expect.objectContaining({ appUrl: expect.stringMatching(/\/admin\/metricas$/) }),
    );
  });

  it("does not e-mail an operator who already has this week's notification", async () => {
    notifyUsers.mockResolvedValue({ sent: true, created: 0, createdFor: [] });
    const outcome = await sendWeeklyDigest(supabaseWith(busyWeeks, ZERO_TOTALS), NOW);
    expect(outcome.emailed).toBe(0);
    expect(sendDigest).not.toHaveBeenCalled();
  });

  it("reports a failed read instead of a quiet week", async () => {
    const broken = {
      ...supabaseWith(busyWeeks, ZERO_TOTALS),
      rpc: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
    } as unknown as SupabaseClient;
    const outcome = await sendWeeklyDigest(broken, NOW);
    expect(outcome.error).toBe("boom");
    expect(notifyUsers).not.toHaveBeenCalled();
  });
});
