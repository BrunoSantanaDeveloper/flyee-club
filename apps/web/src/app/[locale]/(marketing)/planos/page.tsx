import { getDisplayPlans } from "../plans";
import { Metadata } from "next";
import { cookies } from "next/headers";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import TrackEvent from "@/components/consent/track-event";
import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Container from "@/components/marketing/container";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import PricingSection from "@/components/marketing/pricing-section";
import { COOKIE_KEYS } from "@/constants";
import { localizeHref } from "@/i18n/routing";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { resolveCurrency } from "@/lib/billing-currency";
import { getLaunchStage, primaryCtaFor } from "@/lib/launch";
import { normalizeCouponCode } from "@/lib/offer-link";
import { publicPageMetadata } from "@/lib/seo";
import { resolvePublicCoupon } from "@flyee/billing/public";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("pricing-meta-title"),
    description: t("pricing-meta-description"),
    ...publicPageMetadata({ path: "/planos", locale }),
  };
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, locale, params, cookieStore, stage] = await Promise.all([
    getTranslations("marketing"),
    getLocale(),
    searchParams,
    cookies(),
    getLaunchStage(),
  ]);
  // The visitor's own pick (a `?moeda=` link, kept by the middleware) wins;
  // otherwise the page language decides: Portuguese BRL, English USD.
  const currency = resolveCurrency({
    cookie: typeof params.moeda === "string" ? params.moeda : cookieStore.get(COOKIE_KEYS.currency)?.value,
    locale,
  });
  const otherCurrency = currency === "BRL" ? "USD" : "BRL";
  // Before the site opens the plans are shown, and every button leads to the waitlist.
  const cta = primaryCtaFor(stage);

  /**
   * The campaign code, straight from the followed link or from the cookie the
   * middleware stored on an earlier page. Resolved HERE, on the server, because
   * a visitor told to use a code who lands on table prices concludes the code
   * failed and leaves before reaching the sign-up.
   */
  const requestedCoupon =
    normalizeCouponCode(typeof params.cupom === "string" ? params.cupom : null) ??
    normalizeCouponCode(cookieStore.get(COOKIE_KEYS.offerCoupon)?.value);
  const coupon = requestedCoupon ? await resolvePublicCoupon(requestedCoupon) : null;
  const { plans, periodToggle } = await getDisplayPlans({ coupon, currency, stage });

  return (
    <>
      <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("nav-pricing"), path: "/planos" }]} />
      <PricingSection
        eyebrow={t("pricing-eyebrow")}
        title={t("pricing-page-title")}
        subtitle={t("pricing-page-subtitle")}
        plans={plans}
        periodToggle={periodToggle}
        ctaLabel={t(cta.labelKey)}
        ctaHref={cta.href}
        headingAs="h1"
        decor="glow"
        // A code that did not resolve is named, not ignored: the visitor must
        // not read the table price as the discounted one.
        couponNotice={
          requestedCoupon
            ? coupon
              ? { label: t("pricing-coupon-applied", { code: coupon.code }), applied: true }
              : { label: t("pricing-coupon-unknown", { code: requestedCoupon }), applied: false }
            : undefined
        }
      />

      {/* Risk reversal, next to the price (blueprint: reduce perceived risk). */}
      <Container>
        <div className="border-grey-100 bg-background-paper mx-auto flex max-w-2xl items-start gap-4 rounded-3xl border p-6">
          <span className="bg-secondary/10 text-secondary flex h-11 w-11 flex-none items-center justify-center rounded-xl">
            <NiShieldCheck size="medium" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-text-primary font-heading text-lg font-normal">{t("pricing-guarantee-title")}</p>
            <p className="text-text-secondary text-sm leading-6">{t("pricing-guarantee-body")}</p>
          </div>
        </div>
      </Container>

      <Container>
        <p className="text-text-secondary mx-auto max-w-2xl pb-4 text-center text-sm leading-5">
          {t("pricing-note")} {/* A full load: the currency is a cookie the middleware writes from the link. */}
          <NextLink
            href={`${localizeHref("/planos", locale)}?moeda=${otherCurrency}`}
            prefetch={false}
            className="text-primary underline"
          >
            {t("pricing-currency-switch", {
              currency: t(otherCurrency === "USD" ? "pricing-currency-usd" : "pricing-currency-brl"),
            })}
          </NextLink>
        </p>
      </Container>

      {/* Marketing-only ViewContent (Meta/GA4) — no-op until consent + provider. */}
      <TrackEvent event="ViewContent" props={{ content_name: "planos", content_category: "pricing" }} />

      <Faq
        eyebrow={t("faq-eyebrow")}
        title={t("faq-title")}
        items={[1, 2, 3, 4].map((index) => ({
          question: t(`faq-${index}-question`),
          answer: t(`faq-${index}-answer`),
        }))}
      />

      <Cta title={t("cta-title")} subtitle={t("cta-subtitle")} cta={{ label: t(cta.labelKey), href: cta.href }} />
    </>
  );
}
