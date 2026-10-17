import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import AppIcon from "@/components/marketing/app-icon";
import AppShowcase from "@/components/marketing/app-showcase";
import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Cta from "@/components/marketing/cta";
import { getHomeCopy } from "@/components/marketing/home-copy";
import { RuledCard } from "@/components/marketing/ruled-grid";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import StoreGrid from "@/components/marketing/store-grid";
import { pickFeatured } from "@/lib/catalog/featured";
import type { CatalogLocale } from "@/lib/catalog/links";
import { loadPublicCatalog, type PublicCatalog } from "@/lib/catalog/public";
import { accountServices, isNewApp, servicesPhrase } from "@/lib/catalog/store-badges";
import { storeLook } from "@/lib/catalog/store-look";
import { getLaunchStage, primaryCtaFor } from "@/lib/launch";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("catalog-meta-title"),
    description: t("catalog-meta-description"),
    ...publicPageMetadata({ path: "/catalogo", locale }),
  };
}

/** Product names are not translated. */
const AI_NAME: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  gemini_cli: "Gemini CLI",
  cursor: "Cursor",
};

const TYPE_KEY: Record<string, string> = {
  skill: "catalog-type-skill",
  workflow: "catalog-type-workflow",
  framework: "catalog-type-framework",
  tool: "catalog-type-tool",
};

type App = PublicCatalog["modules"][number];

/**
 * /catalogo (EN /catalog): the app store, read-only. One grid of every
 * published app, filtered by store category, the kinds of work of the home
 * brief (`catalog_store_categories`, migration 0029; the stages stay the
 * catalog's taxonomy and name the module pages). Each card says what the app
 * does, its current version and the AIs it runs on, and leads to its page.
 * Beside the title, an app answers a request (decided 2026-10-17): what an
 * app returns, never the command that installs it. Categories with nothing
 * published yet are named, never padded with placeholders. A store that could
 * not be read says so instead of looking empty.
 */
export default async function CatalogPage() {
  const [t, locale, stage] = await Promise.all([getTranslations("marketing"), getLocale(), getLaunchStage()]);
  const cta = primaryCtaFor(stage);
  const isOpen = stage === "open";
  const primary = { label: t(cta.labelKey), href: cta.href };
  const catalogLocale: CatalogLocale = locale === "en" ? "en" : "pt-BR";
  const result = await loadPublicCatalog(catalogLocale);

  const breadcrumb = <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("nav-catalog"), path: "/catalogo" }]} />;

  if (result.kind === "unavailable" || result.catalog.modules.length === 0) {
    const unavailable = result.kind === "unavailable";
    return (
      <>
        {breadcrumb}
        <Section decor="glow">
          <SectionHeader
            as="h1"
            eyebrow={t("catalog-eyebrow")}
            title={t(unavailable ? "catalog-unavailable-title" : "catalog-empty-title")}
            subtitle={t(unavailable ? "catalog-unavailable-body" : "catalog-empty-body")}
          />
        </Section>
        <Cta
          decor="orbit"
          title={t("catalog-cta-title")}
          subtitle={t(isOpen ? "catalog-cta-subtitle-open" : "catalog-cta-subtitle-waitlist")}
          cta={primary}
        />
      </>
    );
  }

  const { catalog } = result;
  const look = storeLook(catalog);
  const apps = look.sort(catalog.modules);
  const empty = look.emptyFor(apps);
  // The app beside the title: the home's featured app when it has an example in this
  // language (migration 0043), else another app that has one, else the featured app saying
  // what it does. Nothing is invented for an app the product sent no example for.
  const featuredSlug = (await getHomeCopy(locale)).store.featured.slug;
  const shown =
    pickFeatured(
      apps.filter((app) => app.example),
      featuredSlug,
    ) ?? pickFeatured(apps, featuredSlug);

  const card = (app: App) => {
    const category = look.lookOf(app);
    const ais = app.compatible_ais.map((ai) => AI_NAME[ai] ?? t("catalog-ai-other"));
    const version = app.latest ? `v${app.latest.version}` : t("catalog-no-version");
    return (
      <RuledCard
        item={{
          // The app's own icon, the same as on the home (docs/DESIGN.md, "Reference ingredients").
          appIcon: <AppIcon name={app.icon} tone={category.tone} size="md" />,
          tone: category.tone,
          title: app.name ?? app.slug,
          body: app.summary ?? t(TYPE_KEY[app.type] ?? "catalog-type-tool"),
          // The category, never a "free" badge: the free rung is not advertised (docs/PRODUCT.md, 2026-10-06).
          badge: category.name,
          meta: [version, ...ais].join(" · "),
          // From data (migration 0034): new for the first days, and the accounts it needs.
          flags: [
            ...(isNewApp(app.firstPublishedAt, catalog.newBadgeDays) ? [{ label: t("catalog-badge-new") }] : []),
            ...(accountServices(app.external_credentials).length > 0
              ? [
                  {
                    label: t("catalog-badge-account", {
                      service: servicesPhrase(accountServices(app.external_credentials), locale),
                    }),
                    tone: "neutral" as const,
                  },
                ]
              : []),
          ],
          link: { label: t("catalog-module-link"), href: `/catalogo/${app.slug}` },
        }}
      />
    );
  };

  return (
    <>
      {breadcrumb}
      <Section decor="glow">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-4">
            <SectionHeader
              as="h1"
              align="start"
              className="mx-0 mb-0 md:mb-0"
              eyebrow={t("catalog-eyebrow")}
              title={t("catalog-title")}
              subtitle={t("catalog-subtitle")}
            />
            <p className="text-text-secondary m-0 text-sm">{t("catalog-count", { count: catalog.stats.modules })}</p>
          </div>
          {shown ? (
            <AppShowcase
              icon={<AppIcon name={shown.icon} tone={look.lookOf(shown).tone} size="sm" />}
              name={shown.name ?? shown.slug}
              context={t("catalog-showcase-context")}
              request={shown.example?.request}
              lines={
                shown.example?.reply ?? [{ text: shown.summary ?? t(TYPE_KEY[shown.type] ?? "catalog-type-tool") }]
              }
              saved={shown.example?.saved}
              caption={t("catalog-showcase-caption", { app: shown.name ?? shown.slug })}
              tone={look.lookOf(shown).tone}
            />
          ) : null}
        </div>
      </Section>

      <Section background="paper" spacing="compact">
        <StoreGrid
          label={t("catalog-categories-label")}
          allLabel={t("catalog-all")}
          columns={3}
          categories={look.chipsFor(apps)}
          items={apps.map((app) => ({ key: app.slug, category: app.storeCategory, card: card(app) }))}
        />
        {empty.length > 0 ? (
          <p className="text-text-secondary mt-10 mb-0 text-center text-base leading-7">
            {t("catalog-empty-categories", { categories: empty.map((category) => category.name).join(", ") })}
          </p>
        ) : null}
      </Section>

      {/* Recipes, proposing and voting are FlyeeClub Pro's, offered inside the
          member area and never on the site (docs/PRODUCT.md, 2026-10-08). */}
      <Cta
        decor="orbit"
        title={t("catalog-cta-title")}
        subtitle={t(isOpen ? "catalog-cta-subtitle-open" : "catalog-cta-subtitle-waitlist")}
        cta={primary}
      />
    </>
  );
}
