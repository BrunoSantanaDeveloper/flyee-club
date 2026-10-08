import { getLocale, getTranslations } from "next-intl/server";

import type { PublicPlanDisplay } from "@/components/marketing/pricing-section";
import type { Tone } from "@/components/marketing/tone";
import { accessTermParts } from "@/lib/access-term";
import { getMaxInstallments } from "@/lib/billing-settings";
import { splitInstallments } from "@/lib/installments";

/** The plural-aware key of a term ("1 ano", "18 meses"); both literals, so the message pruner sees them. */
const termKey = (months: number) =>
  accessTermParts(months).unit === "years" ? "access-term-years" : "access-term-months";
import type { LaunchStage } from "@/lib/launch";
import { type BillingCurrency, formatPrice } from "@flyee/billing/currency";
import {
  enabledFeatures,
  type EntitlementKey,
  hasEntitlement,
  isTier,
  limitOf,
  type Tier,
} from "@flyee/billing/entitlements";
import { listPublicPlans } from "@flyee/billing/public";
import { applyDiscount, type CheckoutCoupon } from "@flyee/billing/types";

/** The site sells one plan (docs/PRODUCT.md, 2026-10-08), so a clone without a database shows one. */
const PLACEHOLDER_SLUGS = ["plan-1"] as const;

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
 * The site lists only the plans marked `listed_on_site` (migration 0037):
 * FlyeeClub, the one-time access, because FlyeeClub Pro is offered inside the
 * member area (docs/PRODUCT.md, 2026-10-08). A card says what it unlocks from
 * its entitlement keys (`plans.limits`), never from hand-written copy, so a
 * plan edited in /admin/billing reads right on the site: the one-time access
 * in the labelled rows of the home brief, each row present only when the
 * plan grants it, and any other plan the operator lists in its feature list.
 * The only plan on the page is the highlighted one. Until the site opens (launch stage `waitlist`) every
 * button leads to the waitlist; afterwards each leads to sign-up and then to
 * that plan's own checkout.
 *
 * With a campaign coupon, every card the coupon applies to shows the price the
 * coupon gives, computed with the same helper the providers charge with, and
 * names the coupon beside it. The list price is never shown struck through
 * (docs/PRODUCT.md, "Preço e vagas").
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
  const [t, locale, rows, maxInstallments] = await Promise.all([
    getTranslations("marketing"),
    getLocale(),
    listPublicPlans({ surface: "site", currency }),
    // Card installments exist only in reais (Asaas); the ceiling is data.
    currency === "BRL" ? getMaxInstallments() : Promise.resolve(1),
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
        highlighted: true,
        ctaId: "plan_access",
      })),
    };
  }

  const plans = rows.filter((plan) => !plan.isFree && (plan.kind === "access" || plan.period));
  const money = (cents: number) => formatPrice(cents, currency, locale);
  // A fixed discount is an amount in one currency; a percentage applies anywhere.
  const planCoupon = coupon && (coupon.discountType === "percent" || coupon.currency === currency) ? coupon : undefined;

  const display = plans.map((plan): PublicPlanDisplay => {
    const tier = isTier(plan.tier) ? plan.tier : null;
    const features = planFeatureKeys(plan.limits).map(({ key, values }) => t(key, values));

    const payableCents = applyDiscount(plan.priceCents, planCoupon);
    const discounted = payableCents !== plan.priceCents;
    const isKit = plan.kind === "access";
    // The rows of the one-time access, as the home brief lays them out.
    const rows = isKit
      ? [
          ...(hasEntitlement(plan.limits, "catalog_access")
            ? [
                { label: t("pricing-row-apps"), value: t("pricing-row-apps-value") },
                { label: t("pricing-row-updates"), value: t("pricing-row-updates-value") },
                { label: t("pricing-row-guides"), value: t("pricing-row-guides-value") },
              ]
            : []),
          ...(hasEntitlement(plan.limits, "commercial_license")
            ? [{ label: t("pricing-row-projects"), value: t("pricing-row-projects-value") }]
            : []),
          ...(limitOf(plan.limits, "devices") > 0
            ? [
                {
                  label: t("pricing-row-devices"),
                  value: t("pricing-row-devices-value", { count: limitOf(plan.limits, "devices") }),
                },
              ]
            : []),
        ]
      : undefined;
    return {
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? undefined,
      price: money(payableCents),
      priceCondition: discounted && planCoupon ? t("pricing-price-coupon", { code: planCoupon.code }) : undefined,
      period: isKit
        ? plan.accessMonths
          ? t("pricing-access-term", {
              term: t(termKey(plan.accessMonths), { count: accessTermParts(plan.accessMonths).count }),
            })
          : t("pricing-one-time")
        : t(`pricing-period-${plan.period}`),
      features,
      rows,
      priceLabel: isKit ? t("pricing-row-price") : undefined,
      // With more than one plan listed, the subscription anchors the ladder.
      highlighted: tier === "club",
      tone: tier ? TIER_TONE[tier] : undefined,
      cycle: plan.period === "monthly" || plan.period === "yearly" ? plan.period : undefined,
      href: stage === "open" ? `/auth/sign-up?next=${encodeURIComponent(`/assinatura?plan=${plan.slug}`)}` : "/espera",
      // Each purchase button names its plan; before the opening, the section's waitlist label.
      ctaLabel:
        stage === "open" ? (isKit ? t("pricing-cta-kit") : t("pricing-cta-plan", { plan: plan.name })) : undefined,
      // The split the checkout offers on the one-time access, at the price this card shows.
      installmentsLabel:
        isKit && maxInstallments > 1
          ? t("pricing-installments", {
              count: maxInstallments,
              amount: money(splitInstallments(payableCents, maxInstallments).each),
            })
          : undefined,
      ctaId: isKit ? "plan_access" : "plan_full",
      // Raw values power the Offer JSON-LD (formatted `price` is display-only).
      // Deliberately the LIST price: the structured data describes the offer
      // open to everyone, and crawlers never carry a campaign code anyway.
      priceAmount: plan.priceCents / 100,
      priceCurrency: plan.currency,
    };
  });

  // The only plan on the page is the offer: its card carries the page's emphasis.
  if (display.length === 1) display[0] = { ...display[0], highlighted: true };

  const hasCycles = display.some((plan) => plan.cycle === "monthly") && display.some((plan) => plan.cycle === "yearly");
  if (!hasCycles) return { plans: display };

  // The yearly saving, from real prices: the smallest across the recurring
  // families on sale, so the label never promises more than every plan gives.
  const families = [...new Set(plans.filter((plan) => plan.period).map((plan) => plan.family))].filter(
    (family): family is string => Boolean(family),
  );
  const savings = families
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
