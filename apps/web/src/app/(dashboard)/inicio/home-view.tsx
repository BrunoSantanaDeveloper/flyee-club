"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Grid, Typography } from "@mui/material";

import CommandBlock from "@/components/product/command-block";
import OnboardingChecklistCard from "@/components/product/onboarding-checklist-card";
import PageHeader from "@/components/product/page-header";
import { TILE_TONE } from "@/components/product/tile-tone";
import UpsellCard from "@/components/product/upsell-card";
import UsageMeter from "@/components/product/usage-meter";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiBadge from "@/icons/nexture/ni-badge";
import NiCheck from "@/icons/nexture/ni-check";
import NiTerminal from "@/icons/nexture/ni-terminal";
import type { DevicesOverview } from "@/lib/member/devices";
import { FEATURE_LABEL, TIER_LABEL } from "@/lib/member/labels";
import type { NewsItem } from "@/lib/member/news";
import { OFFER_COPY, REASON_COPY, SERVICE_COPY } from "@/lib/member/offer-copy";
import type { OfferPlan } from "@/lib/member/offers";
import type { ServiceOffer, UpsellOffer, UpsellReason } from "@/lib/upsell";
import { cn } from "@/lib/utils";
import { formatPrice } from "@flyee/billing/currency";
import type { Tier } from "@flyee/billing/entitlements";

export type HomeState =
  | {
      kind: "ready";
      firstName: string;
      locale: string;
      tier: Tier | null;
      suspended: boolean;
      features: string[];
      /** Null when the machines could not be read. */
      devices: DevicesOverview | null;
      news: NewsItem[] | null;
      upsell: { offer: UpsellOffer; reason: UpsellReason; plan: OfferPlan | null } | null;
      /** The services sold on demand, each with the contact link in the member's language. */
      services: { offer: ServiceOffer; href: string }[];
    }
  | { kind: "unavailable" };

/**
 * Who: a member opening the dashboard. Job: know where they stand and what
 * to do next. Success: the next action taken, whether that is getting access,
 * connecting a machine, updating, or reading what changed.
 *
 * Order follows that job: where you stand (your rung), what keeps your tools
 * alive (the install block, machines and the revalidation date), the next
 * step (the activation checklist), what changed (the latest releases), the
 * next rung when there is one, and, for a paying member, the services sold
 * on demand.
 */
export default function HomeView({ state }: { state: HomeState }) {
  const t = useTranslations("product");

  if (state.kind !== "ready") {
    return (
      <Box className="flex flex-col gap-6">
        <PageHeader title={t("home-greeting-generic")} crumbs={[{ label: t("home-breadcrumb") }]} />
        <Alert severity="info" className="neutral bg-background-paper/60!">
          {t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  const money = (plan: OfferPlan) => formatPrice(plan.priceCents, plan.currency, state.locale);
  const priceLabel = (plan: OfferPlan | null) =>
    plan
      ? plan.period === "monthly"
        ? t("home-offer-price-monthly", { price: money(plan) })
        : t("home-offer-price-once", { price: money(plan) })
      : null;
  const offer = state.upsell;
  const tierTone = TILE_TONE[state.tier === "pro" ? "accent-4" : state.tier === "club" ? "primary" : "accent-2"];
  const devices = state.devices;
  const revalidationDays = devices?.nextRevalidationAt
    ? Math.max(0, Math.ceil((Date.parse(devices.nextRevalidationAt) - Date.now()) / 86_400_000))
    : null;
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat(state.locale, { dateStyle: "medium" }).format(new Date(value));

  return (
    <Box className="flex flex-col gap-6">
      <PageHeader
        title={state.firstName ? t("home-greeting", { name: state.firstName }) : t("home-greeting-generic")}
        crumbs={[{ label: t("home-breadcrumb") }]}
      />

      {state.suspended ? (
        <Alert severity="warning" className="neutral bg-background-paper/60!">
          {t("home-suspended")}
        </Alert>
      ) : null}

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 6 }}>
          {state.tier ? (
            <Card className="flex h-full flex-row p-1">
              <Box
                aria-hidden
                className={cn(
                  "flex w-16 flex-none items-center justify-center rounded-2xl",
                  tierTone.bg,
                  tierTone.text,
                )}
              >
                <NiBadge size="large" />
              </Box>
              <CardContent className="flex flex-1 flex-col gap-3">
                <Box className="flex flex-col gap-1">
                  <Typography variant="subtitle1" component="h2" className="mb-0">
                    {t("home-tier-title", { tier: t(TIER_LABEL[state.tier]) })}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {t("home-tier-body")}
                  </Typography>
                </Box>
                <Box component="ul" className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {state.features.map((feature) => (
                    <Box component="li" key={feature} className="flex flex-row items-start gap-2">
                      <NiCheck size="small" className={cn("mt-0.5 flex-none", tierTone.text)} aria-hidden />
                      <Typography variant="body2">
                        {t(FEATURE_LABEL[feature] ?? "billing-feature-catalog_access")}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Box>
                  <Button
                    size="small"
                    component={Link}
                    href="/settings/billing"
                    endIcon={<NiArrowRight size="small" />}
                  >
                    {t("home-tier-manage")}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : offer ? (
            <UpsellCard
              offer={offer.offer}
              origin="home"
              tone={OFFER_COPY[offer.offer].tone}
              title={t(OFFER_COPY[offer.offer].title)}
              reason={t(REASON_COPY[offer.reason])}
              features={OFFER_COPY[offer.offer].features.map((key) => t(key))}
              priceLabel={priceLabel(offer.plan)}
              ctaLabel={t("home-offer-cta")}
              href={offer.plan ? `/assinatura?plan=${offer.plan.slug}` : "/settings/billing?source=home"}
            />
          ) : null}
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card id="instalar" className="h-full scroll-mt-24">
            <CardContent className="flex flex-col gap-4">
              <Box className="flex flex-row items-center gap-2">
                <NiTerminal size="medium" className="text-primary" aria-hidden />
                <Typography variant="subtitle1" component="h2" className="mb-0">
                  {t("home-install-title")}
                </Typography>
              </Box>
              <Typography variant="body2" className="text-text-secondary">
                {t("home-install-body")}
              </Typography>
              <CommandBlock command="npx flyee login" copyLabel={t("command-copy")} copiedLabel={t("command-copied")} />
              {devices === null ? (
                <Typography variant="body2" className="text-text-secondary">
                  {t("home-devices-error")}
                </Typography>
              ) : devices.live === 0 ? (
                <Typography variant="body2" className="text-text-secondary">
                  {t("home-devices-none")}
                </Typography>
              ) : (
                <Box className="flex flex-col gap-2">
                  {devices.limit > 0 ? (
                    <UsageMeter
                      headline={t("home-devices-headline", { live: devices.live, limit: devices.limit })}
                      ariaLabel={t("home-devices-aria", { live: devices.live, limit: devices.limit })}
                      segments={[
                        {
                          key: "live",
                          label: t("home-devices-live"),
                          value: devices.live,
                          display: String(devices.live),
                          tone: "primary",
                        },
                        {
                          key: "free",
                          label: t("home-devices-free"),
                          value: Math.max(0, devices.limit - devices.live),
                          display: String(Math.max(0, devices.limit - devices.live)),
                          tone: "secondary",
                        },
                      ]}
                    />
                  ) : null}
                  {revalidationDays !== null ? (
                    <Typography
                      variant="body2"
                      className={revalidationDays <= 5 ? "font-semibold" : "text-text-secondary"}
                    >
                      {revalidationDays <= 5
                        ? t("home-revalidate-soon", { days: revalidationDays })
                        : t("home-revalidate-in", { days: revalidationDays })}
                    </Typography>
                  ) : null}
                </Box>
              )}
              <Box>
                <Button size="small" component={Link} href="/settings/devices" endIcon={<NiArrowRight size="small" />}>
                  {t("home-devices-manage")}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <OnboardingChecklistCard title={t("home-checklist-title")} />

      {offer && state.tier ? (
        <UpsellCard
          offer={offer.offer}
          origin="home"
          tone={OFFER_COPY[offer.offer].tone}
          title={t(OFFER_COPY[offer.offer].title)}
          reason={t(REASON_COPY[offer.reason])}
          features={OFFER_COPY[offer.offer].features.map((key) => t(key))}
          priceLabel={priceLabel(offer.plan)}
          ctaLabel={t("home-offer-cta")}
          href={offer.plan ? `/assinatura?plan=${offer.plan.slug}` : "/settings/billing?source=home"}
        />
      ) : null}

      {state.services.length > 0 ? (
        <Box component="section" aria-labelledby="home-services-title" className="flex flex-col gap-3">
          <Box className="flex flex-col gap-1">
            <Typography id="home-services-title" variant="subtitle1" component="h2" className="mb-0">
              {t("home-services-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("home-services-body")}
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {state.services.map((service) => (
              <Grid key={service.offer} size={{ xs: 12, lg: 4 }}>
                <UpsellCard
                  offer={service.offer}
                  origin="home"
                  tone={SERVICE_COPY[service.offer].tone}
                  title={t(SERVICE_COPY[service.offer].title)}
                  reason={t(SERVICE_COPY[service.offer].body)}
                  features={[]}
                  priceLabel={null}
                  ctaLabel={t("home-service-cta")}
                  href={service.href}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Box className="flex flex-row items-center justify-between gap-2">
            <Typography variant="subtitle1" component="h2" className="mb-0">
              {t("home-news-title")}
            </Typography>
            <Button size="small" component={Link} href="/novidades" endIcon={<NiArrowRight size="small" />}>
              {t("home-news-all")}
            </Button>
          </Box>
          {state.news === null ? (
            <Typography variant="body2" className="text-text-secondary">
              {t("news-error")}
            </Typography>
          ) : state.news.length === 0 ? (
            <Typography variant="body2" className="text-text-secondary">
              {t("home-news-none")}
            </Typography>
          ) : (
            <Box component="ul" className="m-0 flex list-none flex-col gap-2 p-0">
              {state.news.map((item) =>
                item.kind === "release" ? (
                  <Box component="li" key={item.id} className="flex flex-row flex-wrap items-baseline gap-x-2">
                    <Link href={`/modulos/${item.module.slug}`} className="font-semibold hover:underline">
                      {item.module.name}
                    </Link>
                    <span className="font-mono text-sm">v{item.version}</span>
                    <Typography variant="body2" className="text-text-secondary">
                      {dateLabel(item.date)}
                    </Typography>
                  </Box>
                ) : null,
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
