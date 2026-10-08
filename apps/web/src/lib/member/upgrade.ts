"use server";

import { getMemberContext } from "@/lib/member/context";
import { loadProAvailability } from "@/lib/member/pro-availability";
import type { ProAvailability } from "@/lib/upgrade";
import type { BillingCurrency } from "@flyee/billing/currency";
import type { Tier } from "@flyee/billing/entitlements";
import { listPublicPlans, type PublicPlan } from "@flyee/billing/public";

/**
 * What the upgrade prompt shows (components/product/upgrade-prompt.tsx), read
 * when it opens rather than on every screen: the account's rung and rights,
 * the FlyeeClub Pro plans and FlyeeClub in the member's currency, and what
 * each area of Pro has published, so an empty one says "Em breve"
 * (docs/PRODUCT.md, 2026-10-08). Prices come from `plans`, never from code.
 */

export type UpgradePlan = { slug: string; name: string; priceCents: number; currency: string };

export type UpgradeOffer = {
  tier: Tier | null;
  /** The account's rights today, so the prompt lists only what Pro adds. */
  limits: Record<string, unknown>;
  currency: BillingCurrency;
  pro: { monthly: UpgradePlan | null; yearly: UpgradePlan | null; limits: Record<string, unknown> } | null;
  /** FlyeeClub, the smaller step, offered beside Pro to an account that bought nothing. */
  kit: UpgradePlan | null;
  available: ProAvailability;
};

const lite = (plan: PublicPlan | undefined): UpgradePlan | null =>
  plan ? { slug: plan.slug, name: plan.name, priceCents: plan.priceCents, currency: plan.currency } : null;

export async function loadUpgradeOffer(): Promise<{ ok: true; offer: UpgradeOffer } | { ok: false }> {
  try {
    const context = await getMemberContext();
    if (!context) return { ok: false };
    const [plans, available] = await Promise.all([
      listPublicPlans({ surface: "member", currency: context.currency }),
      loadProAvailability(context.supabase),
    ]);
    const rows = plans ?? [];
    const proRows = rows.filter((plan) => plan.tier === "club").sort((a, b) => a.sort - b.sort);
    const monthly = proRows.find((plan) => plan.period === "monthly");
    const yearly = proRows.find((plan) => plan.period === "yearly");
    const kit = rows.find((plan) => plan.tier === "kit" && plan.kind === "access");
    const tier = context.entitlements.tier;
    return {
      ok: true,
      offer: {
        tier,
        limits: context.entitlements.active ? context.entitlements.limits : {},
        currency: context.currency,
        pro:
          monthly || yearly
            ? { monthly: lite(monthly), yearly: lite(yearly), limits: (monthly ?? yearly)!.limits }
            : null,
        kit: tier ? null : lite(kit),
        available,
      },
    };
  } catch {
    return { ok: false };
  }
}
