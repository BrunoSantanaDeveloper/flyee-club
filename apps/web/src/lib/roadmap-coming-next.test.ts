// @vitest-environment node
import { describe, expect, it } from "vitest";

import { comingNextBadge, comingNextItems, type ComingNextRow } from "@/lib/roadmap-coming-next";

const row = (overrides: Partial<ComingNextRow>): ComingNextRow => ({
  id: "i1",
  title: { "pt-BR": "Ideia", en: "Idea" },
  status: "planned",
  won_month: null,
  commissioned: false,
  ...overrides,
});

describe("Próximos na loja: one badge per idea, the most specific that is true", () => {
  it("names a paid request first, even while it is being built or after it won a month", () => {
    expect(comingNextBadge(row({ commissioned: true, status: "building", won_month: "2026-10-01" }))).toEqual({
      kind: "paid",
    });
  });

  it("then the month an idea won, then building, then planned", () => {
    expect(comingNextBadge(row({ won_month: "2026-10-01", status: "building" }))).toEqual({
      kind: "mostVoted",
      month: "2026-10-01",
    });
    expect(comingNextBadge(row({ status: "building" }))).toEqual({ kind: "production" });
    expect(comingNextBadge(row({}))).toEqual({ kind: "planned" });
  });

  it("serves at an address only the ideas titled in its language", () => {
    const rows = [row({ id: "both" }), row({ id: "pt-only", title: { "pt-BR": "Só português" } })];
    expect(comingNextItems(rows, "en").map((item) => item.id)).toEqual(["both"]);
    expect(comingNextItems(rows, "pt-BR").map((item) => item.title)).toEqual(["Ideia", "Só português"]);
  });
});
