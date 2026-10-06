import type { Tier } from "@flyee/billing/entitlements";

/**
 * When the member area offers the next rung of the ladder (docs/PRODUCT.md,
 * docs/PLANO-IMPLEMENTACAO.md phase 5). Pure, so the rule is tested without a
 * database; `lib/member/upsell-facts.ts` reads the facts.
 *
 * The offer is earned by use, never by a timer:
 *  - nothing bought yet → the kit;
 *  - the kit in use across three or more trails in 30 days → the membership,
 *    which adds the depth (advanced lessons, recipes, meetings) to what is
 *    already being used broadly.
 * Nothing offers Pro: since every paid plan may be used in client projects
 * (migration 0024), no use of the tools calls for it. Mentoring interest is
 * recorded elsewhere, never shown as a card.
 */

export type UpsellOffer = "kit" | "club";

export type UpsellReason = "no_access" | "broad_use";

export type UpsellFacts = {
  tier: Tier | null;
  /** Distinct trails among the tools executed in the last 30 days. */
  trailsUsed30d: number;
};

export const BROAD_USE_TRAILS = 3;

export function decideUpsell(facts: UpsellFacts): { offer: UpsellOffer; reason: UpsellReason } | null {
  if (!facts.tier) return { offer: "kit", reason: "no_access" };
  if (facts.tier === "kit" && facts.trailsUsed30d >= BROAD_USE_TRAILS) return { offer: "club", reason: "broad_use" };
  return null;
}
