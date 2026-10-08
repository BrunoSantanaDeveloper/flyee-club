import "server-only";

import type { UpsellOffer } from "@/lib/upsell";
import type { BillingCurrency } from "@flyee/billing/currency";
import { listPublicPlans, type PublicPlan } from "@flyee/billing/public";

/**
 * The plan an offer card sells, in the member's currency: FlyeeClub, or the
 * monthly FlyeeClub Pro (the cheapest way in; the checkout shows the yearly
 * option). Prices come from `plans`, never from code.
 */
export type OfferPlan = {
  offer: UpsellOffer;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  period: PublicPlan["period"];
};

export async function loadOfferPlans(currency: BillingCurrency): Promise<Partial<Record<UpsellOffer, OfferPlan>>> {
  // The member area's grid: FlyeeClub Pro is offered here, never on the site.
  const plans = (await listPublicPlans({ surface: "member", currency })) ?? [];
  const pick = (tier: UpsellOffer) =>
    plans
      .filter((plan) => plan.tier === tier && (tier === "kit" ? plan.kind === "access" : plan.period === "monthly"))
      .sort((a, b) => a.sort - b.sort)[0];
  const offers: Partial<Record<UpsellOffer, OfferPlan>> = {};
  for (const tier of ["kit", "club"] as const) {
    const plan = pick(tier);
    if (plan) {
      offers[tier] = {
        offer: tier,
        slug: plan.slug,
        name: plan.name,
        priceCents: plan.priceCents,
        currency: plan.currency,
        period: plan.period,
      };
    }
  }
  return offers;
}
