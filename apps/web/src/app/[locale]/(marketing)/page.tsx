import { getDisplayPlans } from "./plans";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { AiMark, aiName, SUPPORTED_AIS } from "@/components/marketing/ai-marks";
import AppCard from "@/components/marketing/app-card";
import AppCarousel from "@/components/marketing/app-carousel";
import AppIcon from "@/components/marketing/app-icon";
import AppShowcase from "@/components/marketing/app-showcase";
import AppStorePreview from "@/components/marketing/app-store-preview";
import Band from "@/components/marketing/band";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import FeatureRows from "@/components/marketing/feature-row";
import Hero from "@/components/marketing/hero";
import { getHomeCopy, type HomeCopy } from "@/components/marketing/home-copy";
import { rich } from "@/components/marketing/home-copy/rich";
import { splitTokens } from "@/components/marketing/home-copy/tokens";
import LocaleLink from "@/components/marketing/locale-link";
import PersonaGrid, { type Persona } from "@/components/marketing/persona-grid";
import PricingSection from "@/components/marketing/pricing-section";
import ProcessSteps from "@/components/marketing/process-steps";
import ProductComposition, { type Satellite } from "@/components/marketing/product-composition";
import ProductFrame from "@/components/marketing/product-frame";
import RuledGrid from "@/components/marketing/ruled-grid";
import { KpiChip, LinkChip, ReadoutChip } from "@/components/marketing/satellite-chips";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import TerminalFrame from "@/components/marketing/terminal-frame";
import { TONE, type Tone } from "@/components/marketing/tone";
import SiteButton from "@/components/site/button";
import { COOKIE_KEYS } from "@/constants";
import NiAi from "@/icons/nexture/ni-ai";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiBriefcase from "@/icons/nexture/ni-briefcase";
import NiCells from "@/icons/nexture/ni-cells";
import NiCode from "@/icons/nexture/ni-code";
import NiCoin from "@/icons/nexture/ni-coin";
import NiFlask from "@/icons/nexture/ni-flask";
import NiHealth from "@/icons/nexture/ni-health";
import NiKey from "@/icons/nexture/ni-key";
import NiLaptop from "@/icons/nexture/ni-laptop";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiServer from "@/icons/nexture/ni-server";
import NiUsers from "@/icons/nexture/ni-users";
import { resolveCurrency } from "@/lib/billing-currency";
import { getMaxInstallments } from "@/lib/billing-settings";
import { pickFeatured } from "@/lib/catalog/featured";
import type { CatalogLocale } from "@/lib/catalog/links";
import { loadPublicCatalog, type PublicCatalog } from "@/lib/catalog/public";
import { startersFor } from "@/lib/catalog/starters";
import { accountServices, isNewApp, servicesPhrase } from "@/lib/catalog/store-badges";
import { storeLook } from "@/lib/catalog/store-look";
import { getLaunchStage, invitesToInstall, primaryCtaFor } from "@/lib/launch";
import { normalizeCouponCode } from "@/lib/offer-link";
import { publicPageMetadata } from "@/lib/seo";
import { trackAttributes } from "@/lib/site-events";
import { normalizeSegment, PERSONA_SEGMENTS } from "@/lib/site-segment";
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

type App = PublicCatalog["modules"][number];

/** The anchor of "Para quem é"; each persona's card is `#para-quem-e-<segment>`. */
const WHO_FOR = "para-quem-e";

/** Each persona's concept and hue in "Para quem é" (the site's personas, lib/site-segment.ts). */
const PERSONA_LOOK: Record<(typeof PERSONA_SEGMENTS)[number], { icon: React.ReactNode; tone: Tone }> = {
  negocio: { icon: <NiBriefcase size="medium" />, tone: "accent-4" },
  agencia: { icon: <NiUsers size="medium" />, tone: "accent-2" },
  produto: { icon: <NiRocket size="medium" />, tone: "accent-1" },
  dev: { icon: <NiCode size="medium" />, tone: "accent-3" },
};

/** The home's copy with one value filled in ("Atualizado em {date}"). */
const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * The home (phase 7.2), composed as docs/HOME-COPY.md lays it out: a centred
 * hero with the marks of the AIs the apps run on and the store under the fold
 * line, the app store itself (the featured app answering a request, then
 * every app in one row), how it works, why a store, where the apps come from,
 * the access cards, the questions and the last call. Every app, date and count
 * comes from the catalog; every price from the plans. The owner's review of
 * 2026-10-17 set the marks, the shelf of icons, the result in place of the
 * command and the row (docs/DESIGN.md, "Reference ingredients").
 *
 * "Para quem é" (the personas, each with the apps marked for it) sits after
 * the reasons for a store, and the hero's segments and its "O FlyeeClub é pra
 * mim?" lead to it, the brief's way of learning which segment a visitor is
 * while the quiz and the segment pages do not exist.
 *
 * Left out until they exist, as that draft asks: the testimonials (only
 * placeholders today), the custom-app, mentoring and consulting block (the
 * platform does not sell them yet), the segment pages, the quiz and the
 * compatibility page. Every button that converts follows the launch stage
 * (lib/launch.ts): the waitlist until the site opens, sign-up after.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, t, stage, cookieStore, params, splitsInReais] = await Promise.all([
    getLocale(),
    getTranslations("marketing"),
    getLaunchStage(),
    cookies(),
    searchParams,
    // How long the access lasts says what /planos says: the split in reais only while the
    // checkout in reais splits (no split while Stripe charges them).
    getMaxInstallments("BRL").then((count) => count > 1),
  ]);
  // A `?segment=` link rings its persona's card (the brief, 7.8).
  const chosenSegment = normalizeSegment(typeof params.segment === "string" ? params.segment : null);
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
  const number = new Intl.NumberFormat(locale);
  const date = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" }) : "";
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });

  // The store filters by store category (migration 0029); an app without one shows its stage.
  // Both the shelf of the hero and the row of the store list the apps in the store's order.
  const look = storeLook(catalog ?? { trails: [], storeCategories: [] });
  const lookOf = (app: App) => look.lookOf(app);
  const apps = look.sort(catalog?.modules ?? []);
  const example = copy.store.featured;
  const featured = pickFeatured(apps, example.slug);
  const icon = (app: App, size: React.ComponentProps<typeof AppIcon>["size"], className?: string) => (
    <AppIcon name={app.icon} tone={lookOf(app).tone} size={size} className={className} />
  );

  const heroMedia =
    catalog && apps.length > 0 ? (
      <ProductComposition
        frame={
          <ProductFrame glow>
            <AppStorePreview
              title={copy.hero.store.title}
              label={copy.hero.store.label}
              allLabel={copy.hero.store.allLabel}
              categories={look.chipsFor(apps).map((chip) => chip.label)}
              apps={apps.slice(0, 8).map((app) => ({
                slug: app.slug,
                name: app.name ?? app.slug,
                category: lookOf(app).name,
                href: `/catalogo/${app.slug}`,
                icon: icon(app, "xl", "sm:size-22"),
                track: trackAttributes({ event: "app_card_click", app: app.slug, location: "hero" }),
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
          ...(catalog.stats.lastReleaseAt
            ? ([
                {
                  position: "bottom-left",
                  depth: "front",
                  rotate: -2,
                  float: true,
                  floatDelay: 1.2,
                  children: (
                    <KpiChip
                      label={copy.hero.store.updatedLabel}
                      value={shortDate(catalog.stats.lastReleaseAt)}
                      tone="accent-4"
                    />
                  ),
                },
              ] satisfies Satellite[])
            : []),
          {
            // The brief's floating button over the preview: it takes the reader down to the store.
            position: "bottom",
            depth: "front",
            children: (
              <LinkChip
                label={copy.store.allApps}
                href="#apps"
                icon={<NiArrowRight size="small" />}
                track={trackAttributes({ event: "see_all_apps_click", location: "hero" })}
              />
            ),
          },
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

  // The row of the store: every app, the featured one in its place too (the brief), up to
  // fifteen (the store page lists them all), filtered by the categories they are in. A card
  // says less than the app's page: icon, name, two lines, category and, from data
  // (migration 0034), "Novo" for the first days after the app's first publication.
  const storeApps = apps.slice(0, 15);
  const appCard = (app: App) => (
    <AppCard
      href={`/catalogo/${app.slug}`}
      icon={icon(app, "lg")}
      name={app.name ?? app.slug}
      summary={app.summary ?? lookOf(app).name}
      category={lookOf(app).name}
      tone={lookOf(app).tone}
      badge={catalog && isNewApp(app.firstPublishedAt, catalog.newBadgeDays) ? copy.store.newBadge : undefined}
      track={trackAttributes({ event: "app_card_click", app: app.slug, location: "store" })}
    />
  );

  // The featured app answers the request of the copy's example; another app in the slot
  // (the copy names one that is not published) shows what it does, with nothing invented.
  const hasExample = featured?.slug === example.slug;
  const featuredServices = featured ? accountServices(featured.external_credentials) : [];

  // The hero's segments: each a link to its persona's card, which rings while it is the
  // target; the click is `segment_click` (`location: "hero"`) and keeps the segment.
  const subtitle = splitTokens(copy.hero.subtitle, PERSONA_SEGMENTS).map((part, index) =>
    "token" in part ? (
      <a
        key={index}
        href={`#${WHO_FOR}-${part.token}`}
        className="text-text-primary decoration-primary-ink font-semibold underline decoration-2 underline-offset-4"
        {...trackAttributes({ event: "segment_click", segment: part.token, location: "hero" })}
      >
        {copy.hero.segments[part.token as keyof typeof copy.hero.segments]}
      </a>
    ) : (
      part.text
    ),
  );

  // "Para quem é": each persona with the apps the operator marked for it (migration 0032).
  const personas: Persona[] = PERSONA_SEGMENTS.map((segment) => ({
    segment,
    name: copy.whoFor.personas[segment].name,
    text: copy.whoFor.personas[segment].text,
    icon: PERSONA_LOOK[segment].icon,
    tone: PERSONA_LOOK[segment].tone,
    chosen: chosenSegment === segment,
    starters: startersFor(apps, segment).map((app) => ({
      slug: app.slug,
      name: app.name ?? app.slug,
      icon: icon(app, "xs"),
      href: `/catalogo/${app.slug}`,
      track: trackAttributes({ event: "app_card_click", app: app.slug, location: "who_for" }),
    })),
  }));

  // How long the access lasts and the team question answer as /planos does (one source, the
  // marketing catalog), after "curso" and "clientes" (the brief's order).
  const duration = {
    id: "duracao",
    question: t("faq-1-question"),
    answer: splitsInReais ? t("faq-1-answer") : t("faq-1-answer-at-once"),
  };
  const team = { id: "equipe", question: t("faq-4-question"), answer: t("faq-4-answer") };
  const faqItems = copy.faq.items.flatMap((item) =>
    item.id === "curso" ? [item, duration] : item.id === "clientes" ? [item, team] : [item],
  );

  return (
    <>
      <Hero
        layout="center"
        decor="glow"
        track="hero"
        eyebrow={copy.hero.eyebrow}
        // The brief's badge: the featured app, as a link to its page.
        badge={
          featured
            ? {
                tag:
                  catalog && isNewApp(featured.firstPublishedAt, catalog.newBadgeDays)
                    ? copy.hero.newLabel
                    : copy.store.featuredLabel,
                label: featured.name ?? featured.slug,
                href: `/catalogo/${featured.slug}`,
                track: trackAttributes({ event: "app_card_click", app: featured.slug, location: "badge" }),
              }
            : undefined
        }
        title={rich(copy.hero.title)}
        subtitle={subtitle}
        primaryCta={primary}
        secondaryCta={{ label: copy.hero.secondaryCta, href: `#${WHO_FOR}` }}
        note={copy.hero.note}
        strip={{
          label: copy.hero.stripLabel,
          items: SUPPORTED_AIS.map((id) => ({ name: aiName(id), mark: <AiMark id={id} className="size-7" /> })),
        }}
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
                icon: icon(featured, "lg"),
                title: featured.name ?? featured.slug,
                body: featured.summary ?? lookOf(featured).name,
                bullets: [
                  lookOf(featured).name,
                  ...(featured.latest
                    ? [
                        `v${featured.latest.version} · ${fill(copy.store.updatedOn, { date: date(featured.latest.published_at) })}`,
                      ]
                    : []),
                  ...(featuredServices.length > 0
                    ? [fill(copy.store.usesAccount, { service: servicesPhrase(featuredServices, locale) })]
                    : []),
                ],
                tone: lookOf(featured).tone,
                action: (
                  <SiteButton
                    variant="pastel"
                    href={`/catalogo/${featured.slug}`}
                    {...trackAttributes({ event: "app_card_click", app: featured.slug, location: "featured" })}
                  >
                    {copy.store.viewApp}
                  </SiteButton>
                ),
                // The result of the app, not the command that installs it (decided 2026-10-17).
                media: (
                  <AppShowcase
                    icon={icon(featured, "sm")}
                    name={featured.name ?? featured.slug}
                    context={copy.store.showcase.context}
                    request={hasExample ? example.request : undefined}
                    lines={hasExample ? example.reply : [{ text: featured.summary ?? lookOf(featured).name }]}
                    saved={hasExample ? example.saved : undefined}
                    caption={fill(copy.store.showcase.caption, { app: featured.name ?? featured.slug })}
                    tone={lookOf(featured).tone}
                  />
                ),
              },
            ]}
          >
            <div className="flex flex-col gap-8">
              {/* Only the apps: asking for a custom app is FlyeeClub Pro's, and the
                  site never advertises it (docs/PRODUCT.md, 2026-10-08). */}
              <AppCarousel
                label={copy.store.carouselLabel}
                chipsLabel={copy.store.categoriesLabel}
                allLabel={copy.store.allLabel}
                previousLabel={copy.store.previous}
                nextLabel={copy.store.next}
                categories={look.chipsFor(storeApps)}
                items={storeApps.map((app) => ({ key: app.slug, category: app.storeCategory, card: appCard(app) }))}
              />
              <p className="text-text-secondary m-0 text-center text-base leading-7">
                {copy.store.footnote}{" "}
                <LocaleLink
                  href="/catalogo"
                  className="text-text-primary font-semibold underline"
                  {...trackAttributes({ event: "see_all_apps_click", location: "store" })}
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

      <PersonaGrid
        id={WHO_FOR}
        track="whoFor"
        eyebrow={copy.whoFor.eyebrow}
        title={copy.whoFor.title}
        appsLabel={copy.whoFor.appsLabel}
        personas={personas}
        notForYou={copy.whoFor.notForYou}
      />

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
        items={faqItems}
        link={primary}
        footnote={
          <>
            {copy.faq.contact.lead}{" "}
            <LocaleLink
              href="/contato"
              className="text-text-primary font-semibold underline"
              {...trackAttributes({ event: "contact_click", location: "faq_footer" })}
            >
              {copy.faq.contact.link}
            </LocaleLink>
            . {copy.faq.contact.tail}
          </>
        }
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
