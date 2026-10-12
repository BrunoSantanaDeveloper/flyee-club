import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import Band from "@/components/marketing/band";
import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import FeatureRows from "@/components/marketing/feature-row";
import Hero from "@/components/marketing/hero";
import ProcessSteps from "@/components/marketing/process-steps";
import ProductComposition from "@/components/marketing/product-composition";
import RuledGrid from "@/components/marketing/ruled-grid";
import { ReadoutChip } from "@/components/marketing/satellite-chips";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import TerminalFrame from "@/components/marketing/terminal-frame";
import { TONE } from "@/components/marketing/tone";
import SiteButton from "@/components/site/button";
import NiDownloadCloud from "@/icons/nexture/ni-download-cloud";
import NiKey from "@/icons/nexture/ni-key";
import NiTerminal from "@/icons/nexture/ni-terminal";
import { REFERENCE_COMMAND } from "@/lib/install-links";
import { getLaunchStage, invitesToInstall, primaryCtaFor } from "@/lib/launch";
import { publicPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("how-meta-title"),
    description: t("how-meta-description"),
    ...publicPageMetadata({ path: "/como-funciona", locale }),
  };
}

/** The AIs v1 supports, named as text (docs/DESIGN.md: never as decorative logos). */
const SUPPORTED_AIS = ["Claude Code", "Codex", "Gemini CLI", "Cursor"];

/** Module, version and file of the example; identifiers, the same in every language. */
const EXAMPLE_MODULE = "product-scope";
const EXAMPLE_FILE = "product-scope-1.6.0.zip";

const STEP_TONES = ["accent-2", "accent-1", "accent-4", "accent-3"] as const;

/**
 * What the member's AI runs at each step, shown as a reference; the first step
 * happens on the site. A command is no translation and never goes through a
 * message: `<app>` in one reads as a rich-text tag, and the page printed the
 * key in its place.
 */
const STEP_COMMANDS = [
  null,
  REFERENCE_COMMAND.install,
  REFERENCE_COMMAND.add("<app>"),
  REFERENCE_COMMAND.update,
] as const;

/** The step whose text names /instalar.md once the store is open. */
const INSTALL_STEP = 2;

/**
 * /como-funciona (EN /how-it-works): how a member goes from an account to a
 * tool running in their AI, and the mechanisms behind it — the 30-day token,
 * the package check, the AI running on the member's own plan — then the limits
 * of version 1, stated plainly. The signature update moment of docs/DESIGN.md
 * opens the page; nothing here claims more than the platform does. The member
 * asks and their AI runs the commands (docs/PRODUCT.md, 2026-10-08): the
 * terminals show what the AI runs, the ones /instalar.md gives it
 * (`REFERENCE_COMMAND`), never a task for the visitor. Until the store opens
 * the install step says what the AI does without the page's address
 * (`invitesToInstall`, docs/PRODUCT.md, 2026-10-12).
 */
export default async function HowItWorksPage() {
  const [t, stage] = await Promise.all([getTranslations("marketing"), getLaunchStage()]);
  const cta = primaryCtaFor(stage);
  const isOpen = stage === "open";
  const primary = { label: t(cta.labelKey), href: cta.href };
  // Read with a literal key: the catalog check does not see a key built inside t().
  const installBodyBeforeOpening = t("how-step-2-body-waitlist");
  const showsInstallAddress = invitesToInstall(stage);

  return (
    <>
      <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("nav-how-it-works"), path: "/como-funciona" }]} />
      <Hero
        layout="split"
        decor="glow"
        eyebrow={t("how-eyebrow")}
        title={t.rich("how-title", { em: (chunks) => <em>{chunks}</em> })}
        subtitle={t("how-subtitle")}
        primaryCta={primary}
        secondaryCta={{ label: t("how-secondary-cta"), href: "/catalogo" }}
        highlights={[SUPPORTED_AIS.join(" · "), t("how-highlight-plan"), t("how-highlight-check")]}
        media={
          <ProductComposition
            frame={
              <TerminalFrame
                glow
                title={t("how-terminal-title")}
                label={t("how-terminal-label")}
                lines={[
                  { kind: "command", text: REFERENCE_COMMAND.install },
                  { kind: "muted", text: t("how-terminal-opening") },
                  { kind: "success", text: t("how-terminal-connected") },
                  { kind: "command", text: REFERENCE_COMMAND.add(EXAMPLE_MODULE) },
                  { kind: "success", text: t("how-terminal-installed", { module: EXAMPLE_MODULE, version: "1.6.0" }) },
                  { kind: "muted", text: t("how-terminal-available") },
                ]}
              />
            }
            satellites={[
              {
                position: "top-right",
                depth: "front",
                rotate: 3,
                float: true,
                children: <ReadoutChip text={t("how-chip-token")} tone="accent-3" />,
              },
              {
                position: "bottom-left",
                depth: "front",
                rotate: -2,
                float: true,
                floatDelay: 1.2,
                children: <ReadoutChip text={t("how-chip-checksum")} tone="accent-1" />,
              },
            ]}
          />
        }
      />

      <ProcessSteps
        variant="mono"
        eyebrow={t("how-steps-eyebrow")}
        title={t("how-steps-title")}
        steps={[1, 2, 3, 4].map((index) => {
          const command = STEP_COMMANDS[index - 1];
          return {
            kicker: t(`how-step-${index}-kicker`),
            title: t(`how-step-${index}-title`),
            body:
              index === INSTALL_STEP && !showsInstallAddress ? installBodyBeforeOpening : t(`how-step-${index}-body`),
            deliverableLabel: t(command ? "how-step-command" : "how-step-where"),
            deliverableValue: command ?? t("how-step-1-value"),
            tone: STEP_TONES[index - 1],
          };
        })}
      />

      <FeatureRows
        decor="grid"
        eyebrow={t("how-rows-eyebrow")}
        title={t("how-rows-title")}
        subtitle={t("how-rows-subtitle")}
        items={[
          {
            eyebrow: t("how-token-eyebrow"),
            title: t("how-token-title"),
            body: t("how-token-body"),
            bullets: [t("how-token-bullet-1"), t("how-token-bullet-2"), t("how-token-bullet-3")],
            tone: "accent-3",
            media: (
              <TerminalFrame
                title={t("how-terminal-title")}
                label={t("how-token-terminal-label")}
                lines={[
                  { kind: "command", text: REFERENCE_COMMAND.update },
                  { kind: "output", text: t("how-token-terminal-expired") },
                  { kind: "output", text: t("how-token-terminal-revalidate") },
                  { kind: "muted", text: t("how-token-terminal-keeps") },
                ]}
              />
            ),
          },
          {
            eyebrow: t("how-security-eyebrow"),
            title: t("how-security-title"),
            body: t("how-security-body"),
            bullets: [t("how-security-bullet-1"), t("how-security-bullet-2"), t("how-security-bullet-3")],
            tone: "accent-1",
            media: (
              <TerminalFrame
                title={t("how-terminal-title")}
                label={t("how-security-terminal-label")}
                lines={[
                  { kind: "command", text: `shasum -a 256 ${EXAMPLE_FILE}` },
                  { kind: "output", text: `9f2c4e1a7d03…f6d2b09e4a1e  ${EXAMPLE_FILE}` },
                  { kind: "success", text: t("how-security-terminal-match") },
                ]}
              />
            ),
          },
          {
            eyebrow: t("how-ai-eyebrow"),
            title: t("how-ai-title"),
            body: t("how-ai-body"),
            bullets: [t("how-ai-bullet-1"), t("how-ai-bullet-2"), t("how-ai-bullet-3")],
            tone: "accent-4",
            media: (
              <figure className="border-grey-100 bg-background-paper m-0 flex flex-col gap-5 rounded-3xl border p-6 md:p-8">
                <ul aria-label={t("how-ai-media-label")} className="m-0 grid list-none grid-cols-2 gap-3 p-0">
                  {SUPPORTED_AIS.map((ai) => (
                    <li
                      key={ai}
                      className={cn(
                        "text-text-primary rounded-2xl px-4 py-5 text-center font-mono text-sm",
                        TONE["accent-4"].softBg,
                      )}
                    >
                      {ai}
                    </li>
                  ))}
                </ul>
                <figcaption className="text-text-secondary text-center text-sm leading-5">
                  {t("how-ai-media-caption")}
                </figcaption>
              </figure>
            ),
          },
        ]}
      />

      <Band angle={-1} decor="dots">
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="font-display text-display-lg text-text-primary site-emphasis max-w-3xl font-extrabold">
            {t.rich("how-band-title", { em: (chunks) => <em>{chunks}</em> })}
          </p>
          <SiteButton size="large" variant="contained" href={primary.href}>
            {primary.label}
          </SiteButton>
        </div>
      </Band>

      <Section>
        <SectionHeader
          eyebrow={t("how-limits-eyebrow")}
          title={t("how-limits-title")}
          subtitle={t("how-limits-subtitle")}
        />
        <RuledGrid
          columns={3}
          items={[
            { icon: <NiTerminal size="medium" />, tone: "accent-2" as const },
            { icon: <NiDownloadCloud size="medium" />, tone: "accent-1" as const },
            { icon: <NiKey size="medium" />, tone: "accent-3" as const },
          ].map((item, index) => ({
            ...item,
            title: t(`how-limit-${index + 1}-title`),
            body: t(`how-limit-${index + 1}-body`),
          }))}
        />
      </Section>

      <Faq
        eyebrow={t("how-faq-eyebrow")}
        title={t("how-faq-title")}
        items={[1, 2, 3, 4].map((index) => ({
          question: t(`how-faq-${index}-question`),
          answer: t(`how-faq-${index}-answer`),
        }))}
      />

      <Cta
        decor="orbit"
        title={t("how-cta-title")}
        subtitle={t(isOpen ? "how-cta-subtitle-open" : "how-cta-subtitle-waitlist")}
        cta={primary}
      />
    </>
  );
}
