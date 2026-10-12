import { getDisplayPlans } from "./plans";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import AppStorePreview from "@/components/marketing/app-store-preview";
import Band from "@/components/marketing/band";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import FeatureRows from "@/components/marketing/feature-row";
import Hero from "@/components/marketing/hero";
import { getHomeCopy, type HomeCopy } from "@/components/marketing/home-copy";
import { rich } from "@/components/marketing/home-copy/rich";
import LocaleLink from "@/components/marketing/locale-link";
import PricingSection from "@/components/marketing/pricing-section";
import ProcessSteps from "@/components/marketing/process-steps";
import ProductComposition, { type Satellite } from "@/components/marketing/product-composition";
import ProductFrame from "@/components/marketing/product-frame";
import RuledGrid, { RuledCard, type RuledGridItem } from "@/components/marketing/ruled-grid";
import { KpiChip, ReadoutChip } from "@/components/marketing/satellite-chips";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import StoreGrid from "@/components/marketing/store-grid";
import TerminalFrame from "@/components/marketing/terminal-frame";
import { TONE } from "@/components/marketing/tone";
import CatalogIcon from "@/components/product/catalog-icon";
import SiteButton from "@/components/site/button";
import { COOKIE_KEYS } from "@/constants";
import NiAi from "@/icons/nexture/ni-ai";
import NiCells from "@/icons/nexture/ni-cells";
import NiCoin from "@/icons/nexture/ni-coin";
import NiFlask from "@/icons/nexture/ni-flask";
import NiHealth from "@/icons/nexture/ni-health";
import NiKey from "@/icons/nexture/ni-key";
import NiLaptop from "@/icons/nexture/ni-laptop";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiServer from "@/icons/nexture/ni-server";
import { resolveCurrency } from "@/lib/billing-currency";
import type { CatalogLocale } from "@/lib/catalog/links";
import { loadPublicCatalog, type PublicCatalog } from "@/lib/catalog/public";
import { accountServices, isNewApp, servicesPhrase } from "@/lib/catalog/store-badges";
import { storeLook } from "@/lib/catalog/store-look";
import { getLaunchStage, invitesToInstall, primaryCtaFor } from "@/lib/launch";
import { normalizeCouponCode } from "@/lib/offer-link";
import { publicPageMetadata } from "@/lib/seo";
import { trackAttributes } from "@/lib/site-events";
import { resolvePublicCoupon } from "@flyee/billing/public";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = await getHomeCopy(locale);

  return {
    title: { absolute: copy.meta.title },
    description: copy.meta.description,
    ...publicPageMetadata({ path: "/", locale }),
  };
}

/** The AIs v1 supports, named as text (docs/DESIGN.md: never as decorative logos). */
const SUPPORTED_AIS = ["Claude Code", "Codex", "Gemini CLI", "Cursor"];

type App = PublicCatalog["modules"][number];

/** The app most recently updated: the store's featured slot, from real release dates. */
function featuredApp(apps: App[]): App | null {
  return (
    [...apps]
      .filter((app) => app.latest?.published_at)
      .sort((a, b) => Date.parse(b.latest?.published_at ?? "") - Date.parse(a.latest?.published_at ?? ""))[0] ?? null
  );
}

/** The home's copy with one value filled in ("Atualizado em {date}"). */
const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * The home (phase 7.2), composed as docs/HOME-COPY.md lays it out: a centred
 * hero with the store under the fold line, the app store itself (featured app,
 * categories, the grid), how it works, why a store, where the apps come from,
 * the access cards, the questions and the last call. Every app, date and count
 * comes from the catalog; every price from the plans.
 *
 * Left out until they exist, as that draft asks: the testimonials (only
 * placeholders today), the custom-app, mentoring and consulting block (the
 * platform does not sell them yet), the "Para quem é" pages, the quiz and the
 * compatibility page. Every button that converts follows the launch stage
 * (lib/launch.ts): the waitlist until the site opens, sign-up after.
 */
export default async function Home() {
  const [locale, t, stage, cookieStore] = await Promise.all([
    getLocale(),
    getTranslations("marketing"),
    getLaunchStage(),
    cookies(),
  ]);
  const copy: HomeCopy = await getHomeCopy(locale);
  const cta = primaryCtaFor(stage);
  const primary = { label: t(cta.labelKey), href: cta.href };

  // Same rules as /planos: the visitor's currency and a campaign code that the
  // middleware kept from the link, so the prices here match the ones there.
  const currency = resolveCurrency({ cookie: cookieStore.get(COOKIE_KEYS.currency)?.value, locale });
  const requestedCoupon = normalizeCouponCode(cookieStore.get(COOKIE_KEYS.offerCoupon)?.value);
  const coupon = requestedCoupon ? await resolvePublicCoupon(requestedCoupon) : null;

  const catalogLocale: CatalogLocale = locale === "en" ? "en" : "pt-BR";
  const [catalogResult, pricing] = await Promise.all([
    loadPublicCatalog(catalogLocale),
    getDisplayPlans({ coupon, currency, stage }),
  ]);
  const catalog = catalogResult.kind === "ready" ? catalogResult.catalog : null;
  const apps = catalog?.modules ?? [];
  const featured = featuredApp(apps);
  const number = new Intl.NumberFormat(locale);
  const date = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" }) : "";

  // The two badges of a store card, from data (migration 0034): "Novo" for the first days
  // after an app's first publication, and the services of its required credentials.
  const storeFlags = (app: App): RuledGridItem["flags"] => {
    const services = accountServices(app.external_credentials);
    return [
      ...(catalog && isNewApp(app.firstPublishedAt, catalog.newBadgeDays) ? [{ label: copy.store.newBadge }] : []),
      ...(services.length > 0
        ? [
            {
              label: fill(copy.store.usesAccount, { service: servicesPhrase(services, locale) }),
              tone: "neutral" as const,
            },
          ]
        : []),
    ];
  };

  // The store filters by store category (migration 0029); an app without one shows its stage.
  const look = storeLook(catalog ?? { trails: [], storeCategories: [] });
  const trailOf = (app: App) => look.lookOf(app);

  const heroMedia =
    catalog && apps.length > 0 ? (
      <ProductComposition
        frame={
          <ProductFrame glow>
            <AppStorePreview
              label={copy.hero.store.label}
              allLabel={copy.hero.store.allLabel}
              installLabel={copy.hero.store.installLabel}
              categories={look.chipsFor(apps).map((chip) => chip.label)}
              apps={apps.slice(0, 8).map((app) => ({
                slug: app.slug,
                name: app.name ?? app.slug,
                category: trailOf(app).name,
                tone: trailOf(app).tone,
                icon: <CatalogIcon name={app.icon} size="medium" />,
              }))}
            />
          </ProductFrame>
        }
        satellites={[
          {
            position: "top-right",
            depth: "front",
            rotate: 3,
            float: true,
            children: (
              <KpiChip label={copy.hero.store.appsLabel} value={number.format(catalog.stats.modules)} tone="accent-1" />
            ),
          },
          ...(featured
            ? ([
                {
                  position: "bottom-left",
                  depth: "front",
                  rotate: -2,
                  float: true,
                  floatDelay: 1.2,
                  children: <ReadoutChip text={`npx flyee add ${featured.slug}`} tone="accent-2" />,
                },
              ] satisfies Satellite[])
            : []),
        ]}
      />
    ) : (
      // Without a readable catalog the hero keeps the update moment of docs/DESIGN.md.
      <ProductComposition
        frame={
          <TerminalFrame
            glow
            title={copy.hero.terminal.title}
            label={copy.hero.terminal.label}
            lines={[
              { kind: "command", text: "npx flyee update" },
              { kind: "muted", text: copy.hero.terminal.checking },
              { kind: "success", text: copy.hero.terminal.updated },
              { kind: "output", text: copy.hero.terminal.changelog },
              { kind: "success", text: copy.hero.terminal.verified },
            ]}
          />
        }
        satellites={[
          {
            position: "top-right",
            depth: "front",
            rotate: 3,
            float: true,
            children: <ReadoutChip text={copy.hero.chips.versions} tone="accent-2" />,
          },
          {
            position: "bottom-left",
            depth: "front",
            rotate: -2,
            float: true,
            floatDelay: 1.2,
            children: <ReadoutChip text={copy.hero.chips.checksum} tone="accent-3" />,
          },
        ]}
      />
    );

  const appCard = (app: App): RuledGridItem => ({
    icon: <CatalogIcon name={app.icon} size="medium" />,
    tone: trailOf(app).tone,
    title: app.name ?? app.slug,
    body: app.summary ?? trailOf(app).name,
    badge: trailOf(app).name,
    meta: app.latest ? fill(copy.store.updatedOn, { date: date(app.latest.published_at) }) : undefined,
    flags: storeFlags(app),
    link: { label: copy.store.viewApp, href: `/catalogo/${app.slug}` },
    track: trackAttributes({ event: "app_card_click", app: app.slug }),
  });

  // The store grid of the home: every app but the featured one, up to fifteen
  // (the store page lists them all), filtered by the categories they are in.
  const storeApps = apps.filter((app) => app.slug !== featured?.slug).slice(0, 15);
  const storeCategories = look.chipsFor(storeApps);

  return (
    <>
      <Hero
        layout="center"
        decor="glow"
        track="hero"
        eyebrow={featured ? `${copy.store.featuredLabel} · ${featured.name ?? featured.slug}` : copy.hero.eyebrow}
        title={rich(copy.hero.title)}
        subtitle={copy.hero.subtitle}
        primaryCta={primary}
        secondaryCta={{ label: copy.hero.secondaryCta, href: "#perguntas" }}
        note={copy.hero.note}
        strip={{ label: copy.hero.stripLabel, items: SUPPORTED_AIS }}
        media={heroMedia}
      />

      {catalog && featured ? (
        <>
          <FeatureRows
            id="apps"
            track="store"
            eyebrow={copy.store.eyebrow}
            title={copy.store.title}
            subtitle={copy.store.subtitle}
            items={[
              {
                eyebrow: copy.store.featuredLabel,
                title: featured.name ?? featured.slug,
                body: featured.summary ?? trailOf(featured).name,
                bullets: [
                  trailOf(featured).name,
                  ...(featured.latest
                    ? [
                        `v${featured.latest.version} · ${fill(copy.store.updatedOn, { date: date(featured.latest.published_at) })}`,
                      ]
                    : []),
                ],
                tone: trailOf(featured).tone,
                media: (
                  <div className="flex flex-col gap-4">
                    <TerminalFrame
                      title={copy.hero.terminal.title}
                      label={copy.store.terminalLabel}
                      lines={[
                        { kind: "command", text: `npx flyee add ${featured.slug}` },
                        ...(featured.latest
                          ? [
                              {
                                kind: "success" as const,
                                text: fill(copy.store.installed, {
                                  app: featured.slug,
                                  version: featured.latest.version,
                                }),
                              },
                              { kind: "success" as const, text: copy.store.verified },
                            ]
                          : []),
                      ]}
                    />
                    <SiteButton variant="pastel" href={`/catalogo/${featured.slug}`} className="self-start">
                      {copy.store.viewApp}
                    </SiteButton>
                  </div>
                ),
              },
            ]}
          >
            <div className="flex flex-col gap-8">
              <StoreGrid
                label={copy.store.categoriesLabel}
                allLabel={copy.store.allLabel}
                categories={storeCategories}
                // Only the apps: asking for a custom app is FlyeeClub Pro's, and the
                // site never advertises it (docs/PRODUCT.md, 2026-10-08).
                items={storeApps.map((app) => ({
                  key: app.slug,
                  category: app.storeCategory,
                  card: <RuledCard item={appCard(app)} />,
                }))}
              />
              <p className="text-text-secondary m-0 text-center text-base leading-7">
                {copy.store.footnote}{" "}
                <LocaleLink
                  href="/catalogo"
                  className="text-text-primary font-semibold underline"
                  data-track="see_all_apps_click"
                >
                  {copy.store.allApps}
                </LocaleLink>
              </p>
            </div>
          </FeatureRows>
        </>
      ) : (
        <Section id="apps" track="store">
          <SectionHeader
            eyebrow={copy.store.eyebrow}
            title={catalog ? copy.store.emptyTitle : copy.store.unavailableTitle}
            subtitle={catalog ? copy.store.emptyBody : copy.store.unavailableBody}
          />
          <div className="flex justify-center">
            <SiteButton variant="pastel" href="/catalogo" data-track="see_all_apps_click">
              {copy.store.allApps}
            </SiteButton>
          </div>
        </Section>
      )}

      <ProcessSteps
        track="howItWorks"
        variant="mono"
        eyebrow={copy.steps.eyebrow}
        title={copy.steps.title}
        steps={copy.steps.items.map(({ bodyWaitlist, ...step }, index) => ({
          ...step,
          // Before the opening the install step names no address to follow (lib/launch.ts).
          body: invitesToInstall(stage) ? step.body : (bodyWaitlist ?? step.body),
          tone: (["accent-2", "accent-1", "accent-4"] as const)[index % 3],
        }))}
      />

      <Section background="paper" track="whyStore">
        <SectionHeader eyebrow={copy.why.eyebrow} title={copy.why.title} />
        <RuledGrid
          columns={3}
          items={copy.why.items.map((item, index) => ({
            ...item,
            icon: [
              <NiCells key="cells" size="medium" />,
              <NiLaptop key="laptop" size="medium" />,
              <NiRefresh key="refresh" size="medium" />,
            ][index],
            tone: (["accent-2", "accent-4", "accent-3"] as const)[index],
          }))}
        />
      </Section>

      <Band angle={-1} background="primary-soft" decor="dots">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <p className="text-text-secondary m-0 text-sm font-semibold tracking-wide uppercase">{copy.origin.eyebrow}</p>
          <h2 className="font-display text-display-lg text-text-primary m-0 font-extrabold">{copy.origin.title}</h2>
          <p className="text-text-secondary m-0 text-lg leading-7">{copy.origin.body}</p>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
            {copy.origin.facts.map((fact, index) => {
              const Icon = [NiServer, NiHealth, NiCoin, NiFlask][index] ?? NiServer;
              const tone = (["accent-2", "accent-1", "accent-4", "accent-3"] as const)[index % 4];
              return (
                <li
                  key={fact}
                  className="bg-background-paper text-text-primary inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold"
                >
                  <Icon size="small" className={TONE[tone].text} aria-hidden />
                  {fact}
                </li>
              );
            })}
          </ul>
        </div>
      </Band>

      <PricingSection
        id="acesso"
        track="pricing"
        decor="glow"
        eyebrow={copy.access.eyebrow}
        title={copy.access.title}
        subtitle={copy.access.subtitle}
        plans={pricing.plans}
        periodToggle={pricing.periodToggle}
        ctaLabel={primary.label}
        ctaHref={primary.href}
      />

      <Section spacing="compact" background="paper" track="requirements">
        <SectionHeader title={copy.access.requirementsTitle} />
        <RuledGrid
          columns={3}
          items={copy.access.requirements.map((item, index) => ({
            ...item,
            icon: [
              <NiAi key="ai" size="medium" />,
              <NiLaptop key="laptop" size="medium" />,
              <NiKey key="key" size="medium" />,
            ][index],
            tone: (["accent-1", "accent-4", "accent-3"] as const)[index],
          }))}
        />
      </Section>

      <Faq
        id="perguntas"
        track="faq"
        layout="split"
        eyebrow={copy.faq.eyebrow}
        title={copy.faq.title}
        items={copy.faq.items}
        link={primary}
      />

      <Cta
        decor="orbit"
        track="finalCta"
        title={copy.cta.title}
        subtitle={stage === "open" ? copy.cta.subtitleOpen : copy.cta.subtitleWaitlist}
        cta={primary}
      />
    </>
  );
}
