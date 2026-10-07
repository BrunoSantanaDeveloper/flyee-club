import { planFeatureKeys } from "../../(marketing)/plans";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import TrackEvent from "@/components/consent/track-event";
import Container from "@/components/marketing/container";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import Hero from "@/components/marketing/hero";
import PricingSection from "@/components/marketing/pricing-section";
import ProductComposition, { type Satellite } from "@/components/marketing/product-composition";
import { KpiChip, ReadoutChip } from "@/components/marketing/satellite-chips";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import TerminalFrame from "@/components/marketing/terminal-frame";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { type FoundersOffer, getFoundersOffer } from "@/lib/founders-offer";
import { getLaunchStage, primaryCtaFor } from "@/lib/launch";
import { publicPageMetadata } from "@/lib/seo";
import { formatPrice } from "@flyee/billing/currency";
import { getPlanBySlug } from "@flyee/billing/public";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("founders-meta-title"),
    description: t("founders-meta-description"),
    // A campaign page: reached by the link the operator sends, never by search.
    robots: { index: false, follow: false },
    ...publicPageMetadata({ path: "/fundadores", locale }),
  };
}

/** Module and versions of the update moment; identifiers, the same in every language. */
const EXAMPLE_MODULE = "product-scope";
const EXAMPLE_VERSIONS = "1.4.0 → 1.6.0";

const FAQ_ITEMS = [1, 2, 3, 4] as const;

/** Which closed state to explain: each cause reads differently (docs/FUNIL.md had the same rule). */
function closedReason(offer: FoundersOffer | null): "sold_out" | "expired" | "off" {
  if (offer?.reason === "sold_out") return "sold_out";
  if (offer?.reason === "expired") return "expired";
  return "off";
}

/**
 * /fundadores (EN /founders): the limited founders price of the yearly
 * membership (`founders_offer()`, migration 0004). Every number on the page is
 * the database's: the seats left, the deadline and the price of the offer plan.
 * The checkout refuses the sale once the seats are gone (settings/billing), so
 * the counter and the guard cannot disagree. This is the one page that shows
 * the seats and the deadline, and the price stands alone: never beside a
 * struck-through regular price, which lives on /planos (docs/PRODUCT.md,
 * "Preço e vagas").
 *
 * Closed — sold out, past its deadline, switched off or not configured — the
 * page says which, and points at the regular plans. Until the site opens
 * (lib/launch.ts) the action is the waitlist, like every other page.
 */
export default async function FoundersPage() {
  const [t, locale, stage, offer] = await Promise.all([
    getTranslations("marketing"),
    getLocale(),
    getLaunchStage(),
    getFoundersOffer(),
  ]);
  const siteCta = primaryCtaFor(stage);
  const open = offer && !offer.closed && offer.planSlug ? offer : null;
  const plan = open ? await getPlanBySlug(open.planSlug ?? "") : null;

  if (!open || !plan) {
    const reason = closedReason(offer);
    const date =
      offer?.deadline && reason === "expired"
        ? new Date(offer.deadline).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
        : "";
    const next =
      stage === "open"
        ? { label: t("founders-closed-cta-plans"), href: "/planos" }
        : { label: t(siteCta.labelKey), href: siteCta.href };
    return (
      <>
        <Section decor="glow">
          <SectionHeader
            as="h1"
            eyebrow={t("founders-eyebrow")}
            title={t(`founders-closed-${reason}-title`)}
            subtitle={t(`founders-closed-${reason}-body`, { date })}
          />
        </Section>
        <Cta decor="orbit" title={t("founders-closed-cta-title")} cta={next} />
      </>
    );
  }

  const checkout =
    stage === "open"
      ? {
          label: t("founders-cta"),
          href: `/auth/sign-up?next=${encodeURIComponent(`/assinatura?plan=${plan.slug}`)}`,
        }
      : { label: t(siteCta.labelKey), href: siteCta.href };
  const deadline = open.deadline
    ? new Date(open.deadline).toLocaleDateString(locale, { day: "numeric", month: "long" })
    : null;

  const satellites: Satellite[] = [
    {
      position: "top-right",
      depth: "front",
      rotate: 3,
      float: true,
      children: (
        <KpiChip
          label={t("founders-seats-label")}
          value={t("founders-seats-value", { left: open.seatsLeft, total: open.seatsTotal })}
          tone="accent-2"
        />
      ),
    },
  ];
  if (deadline) {
    satellites.push({
      position: "bottom-left",
      depth: "front",
      rotate: -2,
      float: true,
      floatDelay: 1.2,
      children: <ReadoutChip text={t("founders-deadline", { date: deadline })} tone="accent-3" />,
    });
  } else {
    satellites.push({
      position: "bottom-left",
      depth: "front",
      rotate: -2,
      float: true,
      floatDelay: 1.2,
      children: <ReadoutChip text={EXAMPLE_VERSIONS} tone="accent-3" />,
    });
  }

  return (
    <>
      <Hero
        layout="split"
        decor="glow"
        eyebrow={t("founders-eyebrow")}
        title={t.rich("founders-title", { em: (chunks) => <em>{chunks}</em> })}
        subtitle={t("founders-subtitle", { total: open.seatsTotal })}
        primaryCta={checkout}
        note={t("founders-note")}
        media={
          <ProductComposition
            frame={
              <TerminalFrame
                glow
                title={t("waitlist-terminal-title")}
                label={t("waitlist-terminal-label")}
                lines={[
                  { kind: "command", text: "npx flyee update" },
                  { kind: "muted", text: t("waitlist-terminal-checking") },
                  {
                    kind: "success",
                    text: t("waitlist-terminal-updated", { module: EXAMPLE_MODULE, versions: EXAMPLE_VERSIONS }),
                  },
                  { kind: "output", text: t("waitlist-terminal-changelog") },
                  { kind: "success", text: t("waitlist-terminal-verified") },
                ]}
              />
            }
            satellites={satellites}
          />
        }
      />

      <PricingSection
        eyebrow={t("founders-price-eyebrow")}
        title={t("founders-price-title")}
        subtitle={t("founders-price-subtitle")}
        plans={[
          {
            slug: plan.slug,
            name: plan.name,
            description: plan.description ?? undefined,
            price: formatPrice(plan.priceCents, plan.currency, locale),
            period: plan.period ? t(`pricing-period-${plan.period}`) : t("pricing-one-time"),
            features: planFeatureKeys(plan.limits).map(({ key, values }) => t(key, values)),
            highlighted: true,
            tone: "primary",
            href: checkout.href,
            priceAmount: plan.priceCents / 100,
            priceCurrency: plan.currency,
          },
        ]}
        ctaLabel={checkout.label}
        ctaHref={checkout.href}
      />

      <Container>
        <div className="border-grey-100 bg-background-paper mx-auto flex max-w-2xl items-start gap-4 rounded-3xl border p-6">
          <span className="bg-secondary/10 text-secondary flex h-11 w-11 flex-none items-center justify-center rounded-xl">
            <NiShieldCheck size="medium" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-text-primary font-heading m-0 text-lg font-normal">{t("pricing-guarantee-title")}</p>
            <p className="text-text-secondary m-0 text-sm leading-6">{t("pricing-guarantee-body")}</p>
          </div>
        </div>
      </Container>

      {/* Marketing-only ViewContent (Meta/GA4), the same event as /planos; no-op without consent or ids. */}
      <TrackEvent event="ViewContent" props={{ content_name: "fundadores", content_category: "offer" }} />

      <Faq
        eyebrow={t("founders-faq-eyebrow")}
        title={t("founders-faq-title")}
        items={FAQ_ITEMS.map((index) => ({
          question: t(`founders-faq-${index}-question`),
          answer: t(`founders-faq-${index}-answer`),
        }))}
      />

      <Cta decor="orbit" title={t("founders-cta-title")} subtitle={t("founders-cta-subtitle")} cta={checkout} />
    </>
  );
}
