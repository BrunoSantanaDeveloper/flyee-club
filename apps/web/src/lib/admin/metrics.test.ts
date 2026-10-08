import { describe, expect, it } from "vitest";

import type { MemberRow } from "@/lib/admin/members";
import {
  buildMatrix,
  doorTotals,
  FOCUS_MIN_PEOPLE,
  focusRule,
  focusSentence,
  leaderOf,
  proFeatureTotals,
  segmentPopulation,
  type SegmentWeekRow,
} from "@/lib/admin/metrics";

// Thursday 2026-10-01, Brasília: the running week starts on 2026-09-28.
const NOW = new Date("2026-10-01T15:00:00Z").getTime();
const WEEKS = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
const SEGMENTS = ["negocio", "agencia", "produto", "dev", "outro", "unknown"];

function row(week: string, segment: string, overrides: Partial<SegmentWeekRow> = {}): SegmentWeekRow {
  return {
    week_start: week,
    segment,
    kit_buyers: 0,
    page_views: 500,
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

/** Every week × segment, with `leader` ahead on the three focus metrics from `fromWeek` on. */
function world(leader: string | null, fromWeek = WEEKS[0]): SegmentWeekRow[] {
  return WEEKS.flatMap((week) =>
    SEGMENTS.map((segment) =>
      segment === leader && week >= fromWeek
        ? row(week, segment, { kit_buyers: 5, access_cohort: 5, activated_7d: 4, weekly_active: 9 })
        : row(week, segment, { kit_buyers: 2, access_cohort: 4, activated_7d: 1, weekly_active: 3 }),
    ),
  );
}

const enoughPeople = { produto: 40, agencia: 35, negocio: 31, dev: 50, outro: 90 };

describe("focus rule", () => {
  it("leads nobody on a tie or on a week with nothing in it", () => {
    expect(
      leaderOf([
        { segment: "dev", value: 3 },
        { segment: "outro", value: 1 },
      ]),
    ).toEqual({ segment: "dev" });
    expect(
      leaderOf([
        { segment: "dev", value: 3 },
        { segment: "outro", value: 3 },
      ]),
    ).toEqual({ segment: null, reason: "tie" });
    expect(
      leaderOf([
        { segment: "dev", value: 0 },
        { segment: "outro", value: null },
      ]),
    ).toEqual({
      segment: null,
      reason: "no_data",
    });
  });

  it("is met when one segment leads the three metrics for four complete weeks", () => {
    const result = focusRule(world("dev"), enoughPeople, NOW);
    // The running week (2026-09-28) never counts.
    expect(result.weeks.map((week) => week.week)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(result.status).toBe("met");
    expect(result.streak).toEqual({ segment: "dev", weeks: 4 });
    expect(focusSentence(result)).toContain("Regra cumprida: Dev");
  });

  it("counts the streak back from the newest complete week", () => {
    const result = focusRule(world("produto", "2026-09-14"), enoughPeople, NOW);
    expect(result.status).toBe("leading");
    expect(result.streak).toEqual({ segment: "produto", weeks: 2 });
    expect(focusSentence(result)).toBe("Produto digital lidera as três métricas há 2 de 4 semanas seguidas.");
  });

  it("never lets 'outro' lead, however large it is", () => {
    const result = focusRule(world("outro"), enoughPeople, NOW);
    expect(result.comparable).not.toContain("outro");
    expect(result.status).toBe("no_leader");
  });

  it("compares only segments with enough people, and needs two of them", () => {
    const one = focusRule(world("dev"), { dev: FOCUS_MIN_PEOPLE, produto: FOCUS_MIN_PEOPLE - 1 }, NOW);
    expect(one.comparable).toEqual(["dev"]);
    expect(one.status).toBe("not_enough_people");
    expect(focusSentence(one)).toContain("Só Dev tem 30 contas com acesso");
    expect(focusRule(world("dev"), {}, NOW).status).toBe("not_enough_people");
  });

  it("counts accounts with access, per segment, as the people of the rule", () => {
    const member = (segment: string | null, tier: MemberRow["tier"]) => ({ segment, tier }) as MemberRow;
    expect(
      segmentPopulation([member("dev", "kit"), member("dev", "club"), member("dev", null), member(null, "pro")]),
    ).toEqual({ dev: 2, unknown: 1 });
  });
});

describe("weekly matrix", () => {
  it("puts weeks oldest first, segments in the fixed order, the two outside the rule last", () => {
    const matrix = buildMatrix(world("dev"), "kit", NOW);
    expect(matrix.weeks).toEqual(WEEKS);
    expect(matrix.current).toBe("2026-09-28");
    expect(matrix.rows.map((entry) => entry.segment)).toEqual(SEGMENTS);
    expect(matrix.rows.find((entry) => entry.segment === "outro")?.inRule).toBe(false);
    expect(matrix.totals[0]).toEqual({ week: "2026-08-31", value: 15, display: "15" });
  });

  it("shows a rate with its x-of-y, a dash for an empty cohort, and marks a window still open", () => {
    const rows = [
      row("2026-09-14", "dev", { access_cohort: 4, activated_7d: 3 }),
      row("2026-09-21", "dev", { access_cohort: 2, activated_7d: 1 }),
      row("2026-09-28", "dev"),
    ];
    const cells = buildMatrix(rows, "activation", NOW).rows[0].cells;
    expect(cells[0]).toMatchObject({ display: "75%", detail: "3 de 4 com acesso novo", pending: false });
    // A cohort that entered last Sunday has until next Sunday to activate.
    expect(cells[1]).toMatchObject({ display: "50%", pending: true });
    expect(cells[2]).toMatchObject({ display: "—", value: null });
  });

  it("divides each currency by its own payers, and never adds them", () => {
    const rows = [
      row("2026-09-21", "dev", {
        payers_90d: 3,
        payers_90d_brl: 2,
        payers_90d_usd: 1,
        revenue_90d_brl: 19400,
        revenue_90d_usd: 2900,
      }),
    ];
    const cell = buildMatrix(rows, "revenue", NOW).rows[0].cells[0];
    expect(cell.display).toBe("R$ 97 · US$ 29");
    expect(cell.detail).toBe("3 pagantes");
  });
});

describe("entry doors", () => {
  it("adds the weeks per door, names an untracked arrival 'direto', most visited first", () => {
    const doors = doorTotals([
      { week_start: "2026-09-21", origem: "parceiro", page_views: 40, kit_buyers: 1, page_conversion: null },
      { week_start: "2026-09-28", origem: "parceiro", page_views: 60, kit_buyers: 1, page_conversion: null },
      { week_start: "2026-09-28", origem: null, page_views: 300, kit_buyers: 0, page_conversion: null },
    ]);
    expect(doors).toEqual([
      { door: "direto", views: 300, buyers: 0, conversion: 0 },
      { door: "parceiro", views: 100, buyers: 2, conversion: 0.02 },
    ]);
  });
});

describe("what sells FlyeeClub Pro", () => {
  it("puts the feature that sold the most first, with purchases over prompts opened", () => {
    const totals = proFeatureTotals([
      { feature: "roadmap_propose", viewed: 0, clicked: 0, purchased: 0 },
      { feature: "roadmap_vote", viewed: 10, clicked: 3, purchased: 1 },
      { feature: "recipe_install", viewed: 4, clicked: 4, purchased: 2 },
      { feature: "more_devices", viewed: 8, clicked: 3, purchased: 1 },
    ]);
    expect(totals.map((row) => row.feature)).toEqual([
      "recipe_install",
      "roadmap_vote",
      "more_devices",
      "roadmap_propose",
    ]);
    expect(totals[0].conversion).toBe(0.5);
    expect(totals[3].conversion).toBeNull();
  });
});
