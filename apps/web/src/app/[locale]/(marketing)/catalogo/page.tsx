import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Cta from "@/components/marketing/cta";
import RuledGrid, { RuledCard } from "@/components/marketing/ruled-grid";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import StoreGrid from "@/components/marketing/store-grid";
import TerminalFrame from "@/components/marketing/terminal-frame";
import { trailTone } from "@/components/marketing/tone";
import CatalogIcon from "@/components/product/catalog-icon";
import NiPath from "@/icons/nexture/ni-path";
import type { CatalogLocale } from "@/lib/catalog/links";
import { loadPublicCatalog, type PublicCatalog } from "@/lib/catalog/public";
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
 * published app, filtered by category (the trails) as docs/HOME-COPY.md lays
 * the store out; each card says what the app does, its current version and the
 * AIs it runs on, and leads to its page. Installing is a member action
 * (`npx flyee add`). Categories with nothing published yet are named, never
 * padded with placeholders. A store that could not be read says so instead of
 * looking empty.
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
  const trails = catalog.trails.map((trail, index) => ({ ...trail, tone: trailTone(trail.slug, index) }));
  const trailOf = new Map(trails.map((trail) => [trail.slug, trail]));
  const filled = trails.filter((trail) => catalog.modules.some((module) => module.trail === trail.slug));
  const empty = trails.filter((trail) => !catalog.modules.some((module) => module.trail === trail.slug));
  // The order of the store: by category, in the stage order of the trails.
  const order = new Map(trails.map((trail, index) => [trail.slug, index]));
  const apps = [...catalog.modules].sort((a, b) => (order.get(a.trail) ?? 99) - (order.get(b.trail) ?? 99));
  const example = apps.find((module) => module.latest) ?? null;

  const card = (app: App) => {
    const trail = trailOf.get(app.trail);
    const ais = app.compatible_ais.map((ai) => AI_NAME[ai] ?? t("catalog-ai-other"));
    const version = app.latest ? `v${app.latest.version}` : t("catalog-no-version");
    return (
      <RuledCard
        item={{
          icon: <CatalogIcon name={app.icon} size="medium" />,
          tone: trail?.tone ?? "accent-1",
          title: app.name ?? app.slug,
          body: app.summary ?? t(TYPE_KEY[app.type] ?? "catalog-type-tool"),
          badge: app.is_free_sample ? t("catalog-free-sample") : (trail?.name ?? undefined),
          meta: [version, ...ais].join(" · "),
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
          {example?.latest ? (
            <TerminalFrame
              glow
              title={t("catalog-terminal-title")}
              label={t("catalog-terminal-label")}
              lines={[
                { kind: "command", text: `npx flyee add ${example.slug}` },
                {
                  kind: "success",
                  text: t("catalog-terminal-installed", { module: example.slug, version: example.latest.version }),
                },
                { kind: "success", text: t("catalog-terminal-verified") },
                { kind: "muted", text: t("catalog-terminal-update") },
              ]}
            />
          ) : null}
        </div>
      </Section>

      <Section background="paper" spacing="compact">
        <StoreGrid
          label={t("catalog-trails-label")}
          allLabel={t("catalog-all")}
          columns={3}
          categories={filled.map((trail) => ({
            slug: trail.slug,
            label: trail.name ?? trail.slug,
            tone: trail.tone,
            description: trail.description,
          }))}
          items={apps.map((app) => ({ key: app.slug, category: app.trail, card: card(app) }))}
        />
        {empty.length > 0 ? (
          <p className="text-text-secondary mt-10 mb-0 text-center text-base leading-7">
            {t("catalog-empty-trails", { trails: empty.map((trail) => trail.name ?? trail.slug).join(", ") })}{" "}
            {t("catalog-roadmap-note")}
          </p>
        ) : null}
      </Section>

      {catalog.recipes.length > 0 ? (
        <Section decor="grid">
          <SectionHeader
            align="start"
            className="mx-0"
            eyebrow={t("catalog-recipes-eyebrow")}
            title={t("catalog-recipes-title")}
            subtitle={t("catalog-recipes-subtitle")}
          />
          <RuledGrid
            variant="cards"
            columns={3}
            items={catalog.recipes.map((recipe) => ({
              icon: <NiPath size="medium" />,
              tone: "accent-4",
              title: recipe.name ?? recipe.slug,
              body: recipe.summary ?? "",
              badge: t("catalog-recipes-badge"),
              meta: recipe.modules.join(" + "),
            }))}
          />
        </Section>
      ) : null}

      <Cta
        decor="orbit"
        title={t("catalog-cta-title")}
        subtitle={t(isOpen ? "catalog-cta-subtitle-open" : "catalog-cta-subtitle-waitlist")}
        cta={primary}
      />
    </>
  );
}
