import { getLocale, getTranslations } from "next-intl/server";

import { PublicPlanDisplay } from "@/components/marketing/pricing-section";
import { listPublicPlans } from "@flyee/billing/public";
import { applyDiscount, type CheckoutCoupon } from "@flyee/billing/types";

const PLACEHOLDER_SLUGS = ["plan-1", "plan-2", "plan-3"] as const;

/**
 * Display-ready plans for the public pricing sections: real rows from
 * packages/billing formatted for the active locale, or the i18n placeholder
 * plans when the database is not configured (fresh clone stays browsable).
 *
 * With a campaign coupon, every paid card also carries its ORIGINAL price and
 * the discount label: a visitor who was told to use a code and lands on table
 * prices concludes the code failed, so the page shows the promised number
 * instead of accepting the code silently.
 *
 * Feature bullets are interim until phase 4 derives them from the entitlement
 * keys (`pricing-feature-<key>`).
 */
export async function getDisplayPlans(coupon?: CheckoutCoupon | null): Promise<PublicPlanDisplay[]> {
  const [t, locale, plans] = await Promise.all([getTranslations("marketing"), getLocale(), listPublicPlans()]);

  if (!plans || plans.length === 0) {
    return PLACEHOLDER_SLUGS.map((slug) => ({
      slug,
      name: t(`${slug}-name`),
      description: t(`${slug}-description`),
      price: t(`${slug}-price`),
      period: t(`${slug}-period`),
      features: [t(`${slug}-feature-1`), t(`${slug}-feature-2`), t(`${slug}-feature-3`)],
      highlighted: slug === "plan-2",
    }));
  }

  // Highlight the middle plan — the conventional anchor of a 3-tier grid.
  const highlightIndex = plans.length >= 3 ? 1 : -1;

  return plans.map((plan, index) => {
    const features: string[] = [];
    if (plan.kind === "credits" && plan.creditAmount) {
      features.push(t("pricing-feature-credits", { count: plan.creditAmount }));
    }
    // One person per account, so the device ceiling is the plan's real
    // capacity unit (kit 1 / club 3 / pro 5 — docs/PRODUCT.md).
    if (typeof plan.limits.devices === "number" && plan.limits.devices > 0) {
      features.push(t("pricing-feature-devices", { count: plan.limits.devices }));
    }
    if (plan.trialDays > 0) {
      features.push(t("pricing-feature-trial", { days: plan.trialDays }));
    }

    const money = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: plan.currency,
      maximumFractionDigits: 0,
    });
    // The SAME helper both providers use to charge, so the promised price and
    // the invoiced one cannot drift. A free plan has nothing to discount.
    const payableCents = plan.isFree ? 0 : applyDiscount(plan.priceCents, coupon ?? undefined);
    const discounted = !plan.isFree && payableCents !== plan.priceCents;

    return {
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? undefined,
      price: plan.isFree ? t("pricing-free") : money.format(payableCents / 100),
      originalPrice: discounted ? money.format(plan.priceCents / 100) : undefined,
      discountLabel: discounted
        ? coupon?.discountType === "percent"
          ? t("pricing-coupon-off-percent", { value: coupon.discountValue })
          : t("pricing-coupon-off-fixed", { value: money.format((coupon?.discountValue ?? 0) / 100) })
        : undefined,
      period: plan.kind === "recurring" && plan.period && !plan.isFree ? t(`pricing-period-${plan.period}`) : undefined,
      features,
      highlighted: index === highlightIndex,
      // Raw values power the Offer JSON-LD (formatted `price` is display-only).
      // Deliberately the LIST price: the structured data describes the offer
      // open to everyone, and crawlers never carry a campaign code anyway.
      priceAmount: plan.isFree ? 0 : plan.priceCents / 100,
      priceCurrency: plan.currency,
    };
  });
}
