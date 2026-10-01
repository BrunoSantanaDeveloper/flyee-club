import { describe, expect, it } from "vitest";

import {
  daysSince,
  formatBytes,
  formatDay,
  formatMoney,
  formatMoneyByCurrency,
  formatPercent,
  fromLocalInput,
  lastWeeks,
  ratio,
  sinceLabel,
  toLocalInput,
  untilLabel,
  weekStartOf,
} from "@/lib/admin/format";
import {
  ATTENTION_FILTERS,
  executionWeeks,
  filterMembers,
  isBanned,
  memberClock,
  type MemberRow,
  memberSearchText,
  planLabel,
  TIER_FILTERS,
} from "@/lib/admin/members";

const NOW = new Date("2026-10-01T15:00:00Z").getTime();

function member(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    orgId: "org-1",
    userId: "user-1",
    name: "Ana Souza",
    email: "ana@example.com",
    createdAt: "2026-09-01T12:00:00Z",
    lastSignInAt: "2026-09-30T12:00:00Z",
    confirmed: true,
    bannedUntil: null,
    segment: "produto_proprio",
    aiTool: "claude_code",
    locale: "pt-BR",
    tier: null,
    plan: null,
    grants: [],
    devices: { live: 0, lastSeenAt: null, lastUpdateAt: null },
    installedModules: 0,
    executions30d: 0,
    lastExecutionAt: null,
    revenue: { BRL: 0, USD: 0 },
    attribution: {},
    flags: {
      pastDue: false,
      suspended: false,
      cancelScheduled: false,
      noDevice: false,
      staleUpdate: false,
      comped: false,
      neverSignedIn: false,
    },
    ...overrides,
  };
}

const plan = (overrides: Partial<NonNullable<MemberRow["plan"]>> = {}): NonNullable<MemberRow["plan"]> => ({
  slug: "club-mensal",
  name: "Assinatura flyee",
  status: "active",
  period: "monthly",
  priceCents: 6700,
  currency: "BRL",
  renewsAt: "2026-10-20T12:00:00Z",
  endsAt: null,
  provider: "asaas",
  comped: false,
  ...overrides,
});

describe("admin formatters", () => {
  it("writes money without cents only when there are none, and never adds currencies", () => {
    expect(formatMoney(6700, "BRL")).toBe("R$ 67");
    expect(formatMoney(6750, "BRL")).toBe("R$ 67,50");
    expect(formatMoneyByCurrency({ BRL: 125000, USD: 1900 })).toBe("R$ 1.250 + US$ 19");
    expect(formatMoneyByCurrency({ BRL: 0, USD: 0 })).toBe("—");
  });

  it("keeps an empty cohort apart from a zero rate", () => {
    expect(ratio(0, 0)).toBeNull();
    expect(formatPercent(ratio(0, 0))).toBe("—");
    expect(formatPercent(ratio(0, 10))).toBe("0%");
    expect(formatPercent(ratio(1, 4))).toBe("25%");
  });

  it("writes a calendar day without moving it across a time zone", () => {
    expect(formatDay("2026-09-28")).toBe("28/09/2026");
  });

  it("measures distance in whole days, in both directions", () => {
    expect(daysSince("2026-09-28T15:00:00Z", NOW)).toBe(3);
    expect(sinceLabel(null, NOW)).toBe("nunca");
    expect(sinceLabel("2026-10-01T09:00:00Z", NOW)).toBe("hoje");
    expect(sinceLabel("2026-09-30T14:00:00Z", NOW)).toBe("ontem");
    expect(sinceLabel("2026-09-19T15:00:00Z", NOW)).toBe("há 12 d");
    expect(untilLabel("2026-10-01T20:00:00Z", NOW)).toBe("hoje");
    expect(untilLabel("2026-10-02T16:00:00Z", NOW)).toBe("amanhã");
    expect(untilLabel("2026-10-13T16:00:00Z", NOW)).toBe("em 12 d");
    expect(untilLabel("2026-09-29T10:00:00Z", NOW)).toBe("há 2 d");
  });

  it("names a package size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(18234)).toBe("17,8 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3,0 MB");
  });

  it("cuts weeks on Monday, Brasília time, like the reporting functions", () => {
    // Thursday 2026-10-01 in Brasília.
    expect(weekStartOf("2026-10-01T15:00:00Z")).toBe("2026-09-28");
    // 01:30 UTC on a Monday is still Sunday night in Brasília: the week before.
    expect(weekStartOf("2026-09-28T01:30:00Z")).toBe("2026-09-21");
    expect(weekStartOf("2026-09-28T03:00:00Z")).toBe("2026-09-28");
    expect(lastWeeks(3, "2026-10-01T15:00:00Z")).toEqual(["2026-09-14", "2026-09-21", "2026-09-28"]);
  });

  it("round-trips a meeting time through the form field on the console's clock", () => {
    expect(toLocalInput("2026-10-08T22:00:00Z")).toBe("2026-10-08T19:00");
    expect(fromLocalInput("2026-10-08T19:00")).toBe("2026-10-08T22:00:00.000Z");
    expect(fromLocalInput("amanhã")).toBeNull();
  });
});

describe("members console", () => {
  it("selects with the flags the database counted, one rung per account", () => {
    const rows = [
      member({ orgId: "a" }),
      member({ orgId: "b", tier: "kit" }),
      member({ orgId: "c", tier: "club", flags: { ...member().flags, pastDue: true } }),
      member({ orgId: "d", tier: "pro", flags: { ...member().flags, staleUpdate: true } }),
    ];
    expect(filterMembers(rows, "accounts")).toHaveLength(4);
    expect(filterMembers(rows, "noAccess").map((row) => row.orgId)).toEqual(["a"]);
    expect(filterMembers(rows, "kit").map((row) => row.orgId)).toEqual(["b"]);
    expect(filterMembers(rows, "pastDue").map((row) => row.orgId)).toEqual(["c"]);
    expect(filterMembers(rows, "staleUpdate").map((row) => row.orgId)).toEqual(["d"]);
    // Every account sits in exactly one rung filter.
    const rungs = TIER_FILTERS.filter((entry) => entry.key !== "accounts");
    for (const row of rows) expect(rungs.filter((entry) => entry.matches(row))).toHaveLength(1);
    expect(ATTENTION_FILTERS.map((entry) => entry.key)).toEqual([
      "pastDue",
      "noDevice",
      "staleUpdate",
      "cancelScheduled",
      "suspended",
    ]);
  });

  it("says what was sold: the plan and its price, a courtesy, or the kit", () => {
    expect(planLabel(member({ tier: "club", plan: plan() }))).toBe("Assinatura flyee · R$ 67 mensal");
    expect(planLabel(member({ tier: "pro", plan: plan({ name: "flyee Pro", comped: true, provider: null }) }))).toBe(
      "flyee Pro · cortesia",
    );
    const kit = { id: "g", kind: "kit", plan: "kit", source: "purchase", createdAt: "2026-09-02", expiresAt: null };
    expect(planLabel(member({ tier: "kit", grants: [kit] }))).toBe("Kit");
    expect(planLabel(member({ tier: "kit", grants: [{ ...kit, source: "admin" }] }))).toBe("Kit · cortesia");
    expect(planLabel(member())).toBe("Sem plano");
  });

  it("names the one deadline that matters, money problems first", () => {
    const flags = member().flags;
    expect(memberClock(member({ tier: "club", plan: plan(), flags: { ...flags, pastDue: true } }), NOW)).toBe(
      "inadimplente",
    );
    expect(memberClock(member({ tier: "club", plan: plan(), flags: { ...flags, suspended: true } }), NOW)).toBe(
      "acesso suspenso",
    );
    expect(memberClock(member({ tier: "club", plan: plan() }), NOW)).toBe("renova em 20/10/2026");
    expect(
      memberClock(
        member({
          tier: "club",
          plan: plan({ renewsAt: null, endsAt: "2026-10-20T12:00:00Z" }),
          flags: { ...flags, cancelScheduled: true },
        }),
        NOW,
      ),
    ).toBe("cancela em 20/10/2026");
    // A yearly plan paid in instalments does not renew: it ends.
    expect(
      memberClock(member({ tier: "club", plan: plan({ renewsAt: null, endsAt: "2027-09-01T12:00:00Z" }) }), NOW),
    ).toBe("termina em 01/09/2027");
    expect(memberClock(member({ tier: "kit" }), NOW)).toBe("kit, sem vencimento");
    expect(memberClock(member(), NOW)).toBe("sem cobrança");
  });

  it("finds a member by name, e-mail, segment, rung or campaign", () => {
    const text = memberSearchText(member({ tier: "kit", attribution: { utmCampaign: "lancamento" } }));
    for (const term of ["ana souza", "ana@example.com", "produto próprio", "claude code", "kit", "lancamento"]) {
      expect(text).toContain(term);
    }
  });

  it("treats a ban as live only while its end is ahead", () => {
    expect(isBanned(null, NOW)).toBe(false);
    expect(isBanned("2126-01-01T00:00:00Z", NOW)).toBe(true);
    expect(isBanned("2026-01-01T00:00:00Z", NOW)).toBe(false);
  });

  it("fills the quiet weeks of a dossier, so a gap is drawn as a gap", () => {
    const series = executionWeeks(
      [
        { weekStart: "2026-09-14", executions: 9 },
        { weekStart: "2026-09-28", executions: 4 },
      ],
      "2026-10-01T15:00:00Z",
      4,
    );
    expect(series).toEqual([
      { weekStart: "2026-09-07", executions: 0 },
      { weekStart: "2026-09-14", executions: 9 },
      { weekStart: "2026-09-21", executions: 0 },
      { weekStart: "2026-09-28", executions: 4 },
    ]);
  });
});
