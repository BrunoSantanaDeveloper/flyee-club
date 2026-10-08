import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import Band from "@/components/marketing/band";
import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Comparison from "@/components/marketing/comparison";
import Cta from "@/components/marketing/cta";
import Hero from "@/components/marketing/hero";
import ProductComposition from "@/components/marketing/product-composition";
import RuledGrid from "@/components/marketing/ruled-grid";
import { ReadoutChip } from "@/components/marketing/satellite-chips";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import TerminalFrame from "@/components/marketing/terminal-frame";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiServer from "@/icons/nexture/ni-server";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiWorld from "@/icons/nexture/ni-world";
import { getLaunchStage, primaryCtaFor } from "@/lib/launch";
import { getLegalEntity } from "@/lib/platform-settings";
import { publicPageMetadata } from "@/lib/seo";
import { formatCnpj } from "@flyee/fields";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("about-meta-title"),
    description: t("about-meta-description"),
    ...publicPageMetadata({ path: "/sobre", locale }),
  };
}

/** Modules and versions of the example update; identifiers, the same in every language. */
const EXAMPLE_UPDATES = ["product-scope 1.4.0 → 1.6.0", "deploy-check 1.1.0 → 1.2.0", "landing-copy 2.0.1 → 2.1.0"];

/**
 * /sobre (EN /about): who keeps the tools working and on which principles —
 * tools born in production, upkeep as the product, numbers only from the
 * database, two languages from day one — then what the club is and is not,
 * and who operates it when the company is set in /admin/support. Provisional
 * copy (docs/PRODUCT.md): it states principles, not a story nobody can check.
 */
export default async function AboutPage() {
  const [t, stage, legalEntity] = await Promise.all([getTranslations("marketing"), getLaunchStage(), getLegalEntity()]);
  const cta = primaryCtaFor(stage);
  const primary = { label: t(cta.labelKey), href: cta.href };

  return (
    <>
      <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("nav-about"), path: "/sobre" }]} />
      <Hero
        layout="split"
        decor="glow"
        eyebrow={t("about-eyebrow")}
        title={t.rich("about-title", { em: (chunks) => <em>{chunks}</em> })}
        subtitle={t("about-subtitle")}
        primaryCta={primary}
        secondaryCta={{ label: t("about-secondary-cta"), href: "/como-funciona" }}
        media={
          <ProductComposition
            frame={
              <TerminalFrame
                glow
                title={t("about-terminal-title")}
                label={t("about-terminal-label")}
                lines={[
                  { kind: "command", text: "npx flyee update" },
                  ...EXAMPLE_UPDATES.map((text) => ({ kind: "success" as const, text })),
                  { kind: "muted", text: t("about-terminal-summary") },
                ]}
              />
            }
            satellites={[
              {
                position: "top-right",
                depth: "front",
                rotate: 3,
                float: true,
                children: <ReadoutChip text={t("about-chip-production")} tone="accent-2" />,
              },
              {
                position: "bottom-left",
                depth: "front",
                rotate: -2,
                float: true,
                floatDelay: 1.2,
                children: <ReadoutChip text={t("about-chip-languages")} tone="accent-4" />,
              },
            ]}
          />
        }
      />

      <Section decor="grid">
        <SectionHeader
          eyebrow={t("about-principles-eyebrow")}
          title={t("about-principles-title")}
          subtitle={t("about-principles-subtitle")}
        />
        <RuledGrid
          variant="cards"
          columns={2}
          items={[
            { icon: <NiServer size="medium" />, tone: "accent-2" as const },
            { icon: <NiRefresh size="medium" />, tone: "accent-1" as const },
            { icon: <NiShieldCheck size="medium" />, tone: "accent-3" as const },
            { icon: <NiWorld size="medium" />, tone: "accent-4" as const },
          ].map((item, index) => ({
            ...item,
            title: t(`about-principle-${index + 1}-title`),
            body: t(`about-principle-${index + 1}-body`),
          }))}
        />
      </Section>

      <Section spacing="compact" background="paper">
        <SectionHeader
          eyebrow={t("about-builder-eyebrow")}
          title={t("about-builder-title")}
          subtitle={t("about-builder-body")}
        />
      </Section>

      <Band angle={-1} decor="dots">
        <p className="font-display text-display-lg text-text-primary site-emphasis mx-auto max-w-3xl text-center font-extrabold">
          {t.rich("about-band-title", { em: (chunks) => <em>{chunks}</em> })}
        </p>
      </Band>

      <Section>
        <SectionHeader eyebrow={t("about-compare-eyebrow")} title={t("about-compare-title")} />
        <Comparison
          before={{
            label: t("about-not-label"),
            title: t("about-not-title"),
            items: [1, 2, 3, 4].map((index) => t(`about-not-${index}`)),
          }}
          after={{
            label: t("about-is-label"),
            title: t("about-is-title"),
            items: [1, 2, 3, 4].map((index) => t(`about-is-${index}`)),
          }}
        />
        {legalEntity ? (
          <p className="text-text-secondary mx-auto mt-10 max-w-2xl text-center text-sm leading-6">
            {legalEntity.document
              ? t("about-operator-document", { name: legalEntity.name, document: formatCnpj(legalEntity.document) })
              : t("about-operator", { name: legalEntity.name })}
          </p>
        ) : null}
      </Section>

      <Cta
        decor="orbit"
        title={t("about-cta-title")}
        subtitle={t("about-cta-subtitle")}
        cta={primary}
        secondaryCta={{ label: t("about-cta-contact"), href: "/contato" }}
      />
    </>
  );
}
