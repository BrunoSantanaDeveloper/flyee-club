import { getLocale, getTranslations } from "next-intl/server";

import type { PublicPlanDisplay } from "@/components/marketing/pricing-section";
import type { Tone } from "@/components/marketing/tone";
import { accessTermParts } from "@/lib/access-term";

/** The plural-aware key of a term ("1 ano", "18 meses"); both literals, so the message pruner sees them. */
const termKey = (months: number) =>
  accessTermParts(months).unit === "years" ? "access-term-years" : "access-term-months";
import type { LaunchStage } from "@/lib/launch";
import type { BillingCurrency } from "@flyee/billing/currency";
import { enabledFeatures, type EntitlementKey, isTier, limitOf, type Tier } from "@flyee/billing/entitlements";
import { listPublicPlans } from "@flyee/billing/public";
import { applyDiscount, type CheckoutCoupon } from "@flyee/billing/types";

const PLACEHOLDER_SLUGS = ["plan-1", "plan-2", "plan-3"] as const;

/** One hue per rung, the same everywhere on the site (docs/DESIGN.md). */
const TIER_TONE: Record<Tier, Tone> = { kit: "accent-2", club: "primary", pro: "accent-4" };

/** The on/off rights; devices are a count, rendered apart. */
type FeatureKey = Exclude<EntitlementKey, "devices">;

/** What each on/off right reads as on a card. */
const FEATURE_LABEL: Record<FeatureKey, string> = {
  catalog_access: "pricing-feature-catalog_access",
  advanced_lessons: "pricing-feature-advanced_lessons",
  recipes: "pricing-feature-recipes",
  roadmap_vote: "pricing-feature-roadmap_vote",
  meetings: "pricing-feature-meetings",
  commercial_license: "pricing-feature-commercial_license",
  open_the_hood: "pricing-feature-open_the_hood",
};

/**
 * What a plan unlocks, as message keys: each on/off right of `plans.limits`,
 * then the computer count. Shared by the pricing cards and the founders offer,
 * so a plan edited in /admin/billing reads the same everywhere.
 */
export function planFeatureKeys(limits: Record<string, number>): { key: string; values?: { count: number } }[] {
  const keys: { key: string; values?: { count: number } }[] = enabledFeatures(limits).map((key) => ({
    key: FEATURE_LABEL[key as FeatureKey],
  }));
  const devices = limitOf(limits, "devices");
  if (devices > 0) keys.push({ key: "pricing-feature-devices", values: { count: devices } });
  return keys;
}

export type DisplayPricing = {
  plans: PublicPlanDisplay[];
  /** Present when the plans come in monthly and yearly cycles. */
  periodToggle?: { label: string; monthly: string; yearly: string; yearlyNote?: string };
};

/**
 * Display-ready plans for the public pricing sections, in one currency: real
 * rows from packages/billing formatted for the page's language, or the i18n
 * placeholder plans when the database is not configured (a fresh clone stays
 * browsable).
 *
 * Each card says what it unlocks from its entitlement keys (`plans.limits`),
 * never from hand-written copy, so a plan edited in /admin/billing reads
 * right on the site. Until the site opens (launch stage `waitlist`) every
 * button leads to the waitlist; afterwards each leads to sign-up and then to
 * that plan's own checkout.
 *
 * With a campaign coupon, every card the coupon applies to also carries its
 * ORIGINAL price and the discount label, using the same helper the providers
 * charge with.
 */
export async function getDisplayPlans({
  coupon,
  currency,
  stage,
}: {
  coupon?: CheckoutCoupon | null;
  currency: BillingCurrency;
  stage: LaunchStage;
}): Promise<DisplayPricing> {
  const [t, locale, rows] = await Promise.all([
    getTranslations("marketing"),
    getLocale(),
    listPublicPlans({ currency }),
  ]);

  if (!rows || rows.length === 0) {
    return {
      plans: PLACEHOLDER_SLUGS.map((slug) => ({
        slug,
        name: t(`${slug}-name`),
        description: t(`${slug}-description`),
        price: t(`${slug}-price`),
        period: t(`${slug}-period`),
        features: [t(`${slug}-feature-1`), t(`${slug}-feature-2`), t(`${slug}-feature-3`)],
        highlighted: slug === "plan-2",
      })),
    };
  }

  const plans = rows.filter((plan) => !plan.isFree && (plan.kind === "access" || plan.period));
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  // A fixed discount is an amount in one currency; a percentage applies anywhere.
  const planCoupon = coupon && (coupon.discountType === "percent" || coupon.currency === currency) ? coupon : undefined;

  const display = plans.map((plan): PublicPlanDisplay => {
    const tier = isTier(plan.tier) ? plan.tier : null;
    const features = planFeatureKeys(plan.limits).map(({ key, values }) => t(key, values));

    const payableCents = applyDiscount(plan.priceCents, planCoupon);
    const discounted = payableCents !== plan.priceCents;
    const isKit = plan.kind === "access";
    return {
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? undefined,
      price: money.format(payableCents / 100),
      originalPrice: discounted ? money.format(plan.priceCents / 100) : undefined,
      discountLabel: discounted
        ? planCoupon?.discountType === "percent"
          ? t("pricing-coupon-off-percent", { value: planCoupon.discountValue })
          : t("pricing-coupon-off-fixed", { value: money.format((planCoupon?.discountValue ?? 0) / 100) })
        : undefined,
      period: isKit
        ? plan.accessMonths
          ? t("pricing-access-term", {
              term: t(termKey(plan.accessMonths), { count: accessTermParts(plan.accessMonths).count }),
            })
          : t("pricing-one-time")
        : t(`pricing-period-${plan.period}`),
      features,
      // The subscription is the anchor of the ladder.
      highlighted: tier === "club",
      tone: tier ? TIER_TONE[tier] : undefined,
      cycle: plan.period === "monthly" || plan.period === "yearly" ? plan.period : undefined,
      href: stage === "open" ? `/auth/sign-up?next=${encodeURIComponent(`/assinatura?plan=${plan.slug}`)}` : "/espera",
      ctaLabel: stage === "open" && isKit ? t("pricing-cta-kit") : undefined,
      // Raw values power the Offer JSON-LD (formatted `price` is display-only).
      // Deliberately the LIST price: the structured data describes the offer
      // open to everyone, and crawlers never carry a campaign code anyway.
      priceAmount: plan.priceCents / 100,
      priceCurrency: plan.currency,
    };
  });

  const hasCycles = display.some((plan) => plan.cycle === "monthly") && display.some((plan) => plan.cycle === "yearly");
  if (!hasCycles) return { plans: display };

  // The yearly saving, from real prices: the smallest across families, so the
  // label never promises more than every plan gives.
  const savings = ["club", "pro"]
    .map((family) => {
      const monthly = plans.find((plan) => plan.family === family && plan.period === "monthly");
      const yearly = plans.find((plan) => plan.family === family && plan.period === "yearly");
      if (!monthly || !yearly || monthly.priceCents <= 0) return 0;
      return Math.round((1 - yearly.priceCents / (monthly.priceCents * 12)) * 100);
    })
    .filter((value) => value > 0);

  return {
    plans: display,
    periodToggle: {
      label: t("pricing-period-toggle-label"),
      monthly: t("pricing-monthly"),
      yearly: t("pricing-yearly"),
      yearlyNote: savings.length > 0 ? t("pricing-yearly-saving", { percent: Math.min(...savings) }) : undefined,
    },
  };
}
