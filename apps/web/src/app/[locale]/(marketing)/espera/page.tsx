import { WAITLIST_FORM_ID } from "./form-anchor";
import WaitlistForm from "./waitlist-form";
import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import Band from "@/components/marketing/band";
import BentoGrid from "@/components/marketing/bento-grid";
import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import Hero from "@/components/marketing/hero";
import ProcessSteps from "@/components/marketing/process-steps";
import ProductComposition, { type Satellite } from "@/components/marketing/product-composition";
import { KpiChip, ReadoutChip } from "@/components/marketing/satellite-chips";
import TerminalFrame from "@/components/marketing/terminal-frame";
import { TONE, trailTone } from "@/components/marketing/tone";
import SiteButton from "@/components/site/button";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import NiEmail from "@/icons/nexture/ni-email";
import NiEmailOpen from "@/icons/nexture/ni-email-open";
import NiMessage from "@/icons/nexture/ni-message";
import { listCatalogTrails } from "@/lib/public-content";
import { publicPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("waitlist-meta-title"),
    description: t("waitlist-meta-description"),
    ...publicPageMetadata({ path: "/espera", locale }),
  };
}

/** The AIs v1 supports, named as text (docs/DESIGN.md: never as decorative logos). */
const SUPPORTED_AIS = ["Claude Code", "Codex", "Gemini CLI", "Cursor"];

/**
 * The example module of the update moment. Fictitious but plausible until the
 * catalog publishes modules (docs/DESIGN.md, imagery); slugs and versions are
 * identifiers, the same in every language.
 */
const EXAMPLE_MODULE = "product-scope";
const EXAMPLE_VERSIONS = "1.4.0 → 1.6.0";

const FAQ_ITEMS = [1, 2, 3, 4] as const;

/**
 * The waitlist (phase 0 gate of docs/PRODUCT.md, first deploy of
 * docs/PLANO-IMPLEMENTACAO.md): what the club is, the form in the hero, and
 * the plain answers a visitor needs before giving an e-mail. Every "join"
 * button on the page points at the form; nothing here promises a date, a
 * price or a number the database does not hold.
 */
export default async function WaitlistPage() {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const trails = await listCatalogTrails(locale);
  const anchor = `#${WAITLIST_FORM_ID}`;

  const satellites: Satellite[] = [
    {
      position: "top-right",
      depth: "front",
      rotate: 3,
      float: true,
      children: <ReadoutChip text={EXAMPLE_VERSIONS} tone="accent-2" />,
    },
    {
      position: "bottom-left",
      depth: "front",
      rotate: -2,
      float: true,
      floatDelay: 1.2,
      children: <ReadoutChip text={t("waitlist-chip-checksum")} tone="accent-3" />,
    },
  ];
  // A real count or no chip: the trails come from the catalog.
  if (trails.length > 0) {
    satellites.push({
      position: "right",
      depth: "back",
      rotate: 2,
      hideBelow: "md",
      children: <KpiChip label={t("waitlist-chip-trails")} value={String(trails.length)} tone="accent-1" />,
    });
  }

  return (
    <>
      <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("waitlist-eyebrow"), path: "/espera" }]} />
      <Hero
        layout="split"
        decor="glow"
        eyebrow={t("waitlist-eyebrow")}
        title={t.rich("waitlist-title", { em: (chunks) => <em>{chunks}</em> })}
        subtitle={t("waitlist-subtitle")}
        action={<WaitlistForm />}
        note={t("waitlist-note")}
        highlights={[SUPPORTED_AIS.join(" · "), t("waitlist-highlight-languages"), t("waitlist-highlight-checksum")]}
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
                  { kind: "muted", text: t("waitlist-terminal-next") },
                ]}
              />
            }
            satellites={satellites}
          />
        }
      />

      <BentoGrid
        decor="grid"
        eyebrow={t("waitlist-get-eyebrow")}
        title={t("waitlist-get-title")}
        subtitle={t("waitlist-get-subtitle")}
        items={[
          {
            featured: true,
            tone: "accent-2",
            title: t("waitlist-get-catalog-title"),
            body: t("waitlist-get-catalog-body"),
            visual:
              trails.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {trails.map((trail, index) => {
                    const tone = TONE[trailTone(trail.slug, index)];
                    return (
                      <li
                        key={trail.slug}
                        className={cn("rounded-full px-3 py-1 text-sm font-semibold", tone.softBg, tone.text)}
                      >
                        {trail.name}
                      </li>
                    );
                  })}
                </ul>
              ) : undefined,
          },
          {
            tone: "primary",
            title: t("waitlist-get-updates-title"),
            body: t("waitlist-get-updates-body"),
            visual: (
              <p className="text-text-primary font-mono text-sm leading-6">
                <span className="text-text-secondary">{EXAMPLE_MODULE}</span> {EXAMPLE_VERSIONS}
              </p>
            ),
          },
          {
            tone: "accent-1",
            title: t("waitlist-get-ai-title"),
            body: t("waitlist-get-ai-body"),
            visual: (
              <ul className="flex flex-wrap gap-2">
                {SUPPORTED_AIS.map((ai) => (
                  <li
                    key={ai}
                    className="border-grey-100 text-text-primary rounded-lg border px-2.5 py-1 font-mono text-xs"
                  >
                    {ai}
                  </li>
                ))}
              </ul>
            ),
          },
          {
            featured: true,
            tone: "accent-3",
            title: t("waitlist-get-verified-title"),
            body: t("waitlist-get-verified-body"),
            visual: (
              <div className="text-text-secondary flex flex-col gap-1 font-mono text-xs leading-5">
                <span>
                  sha256 <span className="text-text-primary">9f2c…a41e</span> <span className="text-accent-3">✓</span>
                </span>
                <span>{t("waitlist-get-verified-permissions")}</span>
              </div>
            ),
          },
        ]}
      />

      <ProcessSteps
        variant="mono"
        eyebrow={t("waitlist-steps-eyebrow")}
        title={t("waitlist-steps-title")}
        steps={[
          {
            icon: <NiEmail size="medium" />,
            kicker: t("waitlist-step-1-kicker"),
            title: t("waitlist-step-1-title"),
            body: t("waitlist-step-1-body"),
            tone: "accent-2",
          },
          {
            icon: <NiCheckSquare size="medium" />,
            kicker: t("waitlist-step-2-kicker"),
            title: t("waitlist-step-2-title"),
            body: t("waitlist-step-2-body"),
            tone: "accent-1",
          },
          {
            icon: <NiEmailOpen size="medium" />,
            kicker: t("waitlist-step-3-kicker"),
            title: t("waitlist-step-3-title"),
            body: t("waitlist-step-3-body"),
            tone: "accent-4",
          },
          {
            icon: <NiMessage size="medium" />,
            kicker: t("waitlist-step-4-kicker"),
            title: t("waitlist-step-4-title"),
            body: t("waitlist-step-4-body"),
            tone: "accent-3",
          },
        ]}
      />

      <Band angle={-1} decor="dots">
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="font-display text-display-lg text-text-primary site-emphasis max-w-3xl font-extrabold">
            {t.rich("waitlist-band-title", { em: (chunks) => <em>{chunks}</em> })}
          </p>
          <SiteButton plain size="large" variant="contained" href={anchor}>
            {t("cta-waitlist")}
          </SiteButton>
        </div>
      </Band>

      <Faq
        layout="split"
        eyebrow={t("waitlist-faq-eyebrow")}
        title={t("waitlist-faq-title")}
        items={FAQ_ITEMS.map((index) => ({
          question: t(`waitlist-faq-${index}-question`),
          answer: t(`waitlist-faq-${index}-answer`),
        }))}
      />

      <Cta
        decor="orbit"
        title={t("waitlist-cta-title")}
        subtitle={t("waitlist-cta-subtitle")}
        cta={{ label: t("cta-waitlist"), href: anchor }}
      />
    </>
  );
}
