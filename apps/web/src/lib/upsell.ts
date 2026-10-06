import type { Tier } from "@flyee/billing/entitlements";

/**
 * What the member area offers next (docs/PRODUCT.md, the two-plan ladder of
 * 2026-10-06). Pure, so the rule is tested without a database;
 * `lib/member/upsell-facts.ts` reads the facts.
 *
 *  - nothing bought yet → FlyeeClub, the one-time access;
 *  - FlyeeClub → FlyeeClub Pro, the subscription. The offer starts the moment
 *    the access is bought, and its reason is earned by use when it can be:
 *    three or more trails in 30 days means the depth (advanced guides,
 *    recipes, meetings) lands on apps already used broadly;
 *  - FlyeeClub Pro (and the retired Pro) → no plan above it.
 *
 * The services sold on demand (mentoring, consulting) are not plans: every
 * paying member sees them, and their card leads to the contact form.
 */

export type UpsellOffer = "kit" | "club";

export type UpsellReason = "no_access" | "broad_use" | "member";

export type ServiceOffer = "mentoring" | "consulting";

export type UpsellFacts = {
  tier: Tier | null;
  /** Distinct trails among the tools executed in the last 30 days. */
  trailsUsed30d: number;
};

export const BROAD_USE_TRAILS = 3;

export function decideUpsell(facts: UpsellFacts): { offer: UpsellOffer; reason: UpsellReason } | null {
  if (!facts.tier) return { offer: "kit", reason: "no_access" };
  if (facts.tier === "kit") {
    return { offer: "club", reason: facts.trailsUsed30d >= BROAD_USE_TRAILS ? "broad_use" : "member" };
  }
  return null;
}

/** The services a member may book: every paid rung sees both; an account without a purchase is sold nothing on demand. */
export function decideServiceOffers(tier: Tier | null): ServiceOffer[] {
  return tier ? ["mentoring", "consulting"] : [];
}
