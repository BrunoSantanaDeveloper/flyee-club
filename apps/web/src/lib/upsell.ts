import type { Tier } from "@flyee/billing/entitlements";

/**
 * The offers a screen shows on its own, without a click (docs/PRODUCT.md,
 * decisions of 2026-10-06 and 2026-10-08). Pure, so the rule is tested
 * without a database; `lib/member/upsell-facts.ts` reads the facts.
 *
 *  - nothing bought → both: FlyeeClub, the one-time access that gives the
 *    current versions of every app, and FlyeeClub Pro;
 *  - FlyeeClub → FlyeeClub Pro, on the home only when use earned it (three or
 *    more trails in 30 days: the depth lands on apps already used broadly),
 *    and always on the 30-day revalidation, the one moment a member who has
 *    been away is looking;
 *  - FlyeeClub Pro (and the retired Pro) → no plan above it.
 *
 * Everywhere else FlyeeClub Pro is offered where one of its features is
 * clicked, through the upgrade prompt (lib/upgrade.ts).
 *
 * The services sold on demand (the custom app, mentoring, consulting) are
 * not plans: every paying member sees them, and their card leads to the
 * contact form. The custom app also has the proposal route on the roadmap
 * for FlyeeClub Pro members (migration 0026).
 */

export type UpsellOffer = "kit" | "club";

/** Why the card shows: the line under its title. */
export type UpsellReason = "no_access" | "beyond_apps" | "broad_use" | "member";

/** The screen asking: the home answers more sparingly than the revalidation. */
export type UpsellSurface = "home" | "revalidation";

export type ServiceOffer = "custom_app" | "mentoring" | "consulting";

export type UpsellFacts = {
  tier: Tier | null;
  /** Distinct trails among the tools executed in the last 30 days. */
  trailsUsed30d: number;
};

export const BROAD_USE_TRAILS = 3;

export function decideOffers(
  facts: UpsellFacts,
  surface: UpsellSurface,
): { offer: UpsellOffer; reason: UpsellReason }[] {
  if (!facts.tier) {
    return [
      { offer: "kit", reason: "no_access" },
      { offer: "club", reason: "beyond_apps" },
    ];
  }
  if (facts.tier === "kit") {
    if (facts.trailsUsed30d >= BROAD_USE_TRAILS) return [{ offer: "club", reason: "broad_use" }];
    return surface === "revalidation" ? [{ offer: "club", reason: "member" }] : [];
  }
  return [];
}

/** The services a member may book: every paid rung sees both; an account without a purchase is sold nothing on demand. */
export function decideServiceOffers(tier: Tier | null): ServiceOffer[] {
  return tier ? ["custom_app", "mentoring", "consulting"] : [];
}
