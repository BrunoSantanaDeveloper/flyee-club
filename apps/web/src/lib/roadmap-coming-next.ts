import { cache } from "react";

import type { CatalogLocale } from "@/lib/catalog/links";
import { createAnonClient } from "@/lib/public-content";

/**
 * "Próximos na loja", the home brief's list of apps on their way (migration
 * 0033). A visitor reads the planned and building ideas of the roadmap through
 * `roadmap_coming_next()`, never the roadmap itself; each idea carries ONE
 * badge, the most specific that is true of it:
 *
 *   commissioned   → "Em desenvolvimento, sai para todos" (a paid request,
 *                    public by default, terms of use version 4)
 *   won a month    → "Mais votado de {mês}"
 *   building       → "Em produção"
 *   planned        → "Planejado" (the brief names no badge for it; this is
 *                    the honest one)
 *
 * An address in a language serves that language: an idea without a title in
 * it stays out (docs/SEO.md). Unreadable is "unavailable", never an empty list.
 */

export type ComingNextBadge =
  | { kind: "paid" }
  | { kind: "mostVoted"; month: string }
  | { kind: "production" }
  | { kind: "planned" };

export type ComingNextRow = {
  id: string;
  title: Record<string, string> | null;
  status: string;
  won_month: string | null;
  commissioned: boolean;
};

export type ComingNextItem = { id: string; title: string; badge: ComingNextBadge };

/** The one badge an idea carries. Pure. */
export function comingNextBadge(row: Pick<ComingNextRow, "status" | "won_month" | "commissioned">): ComingNextBadge {
  if (row.commissioned) return { kind: "paid" };
  if (row.won_month) return { kind: "mostVoted", month: row.won_month };
  if (row.status === "building") return { kind: "production" };
  return { kind: "planned" };
}

/** The rows readable at an address in `locale`, with their badge. Pure. */
export function comingNextItems(rows: ComingNextRow[], locale: CatalogLocale): ComingNextItem[] {
  return rows.flatMap((row) => {
    const title = row.title?.[locale]?.trim();
    if (!title) return [];
    return [{ id: row.id, title, badge: comingNextBadge(row) }];
  });
}

export type ComingNextResult = { kind: "ready"; items: ComingNextItem[] } | { kind: "unavailable" };

async function readComingNext(locale: CatalogLocale): Promise<ComingNextResult> {
  const client = createAnonClient();
  if (!client) return { kind: "unavailable" };
  const { data, error } = await client.rpc("roadmap_coming_next");
  if (error) return { kind: "unavailable" };
  return { kind: "ready", items: comingNextItems((data ?? []) as ComingNextRow[], locale) };
}

/** Read once per request. */
export const loadComingNext = cache(readComingNext);
