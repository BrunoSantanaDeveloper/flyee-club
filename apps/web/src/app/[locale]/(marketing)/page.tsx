import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import Cta from "@/components/marketing/cta";
import DataVizPlaceholder from "@/components/marketing/data-viz-placeholder";
import Hero from "@/components/marketing/hero";
import { getHomeCopy } from "@/components/marketing/home-copy";
import { rich } from "@/components/marketing/home-copy/rich";
import ProcessSteps from "@/components/marketing/process-steps";
import ProductFrame from "@/components/marketing/product-frame";
import { toneAt } from "@/components/marketing/tone";
import NiCode from "@/icons/nexture/ni-code";
import NiDownloadCloud from "@/icons/nexture/ni-download-cloud";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiTerminal from "@/icons/nexture/ni-terminal";
import { getLaunchStage, primaryCtaFor } from "@/lib/launch";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = await getHomeCopy(locale);

  return {
    title: { absolute: copy.meta.title },
    description: copy.meta.description,
    ...publicPageMetadata({ path: "/", locale }),
  };
}

const STEP_ICONS = [NiDownloadCloud, NiTerminal, NiCode, NiRefresh];

/**
 * Interim home (phase 1 of docs/PLANO-IMPLEMENTACAO.md): the value line, how
 * the club works and one call to action, composed from the marketing library.
 * The full home of docs/DESIGN.md (catalog by trail, the update moment, real
 * numbers from the catalog, pricing) is built in phase 7.
 */
export default async function Home() {
  const [locale, t, stage] = await Promise.all([getLocale(), getTranslations("marketing"), getLaunchStage()]);
  const copy = await getHomeCopy(locale);
  // Until the site opens, both calls to action lead to the waitlist (lib/launch.ts).
  const cta = primaryCtaFor(stage);
  const waiting = stage === "waitlist";

  return (
    <>
      <Hero
        layout="split"
        decor="glow"
        eyebrow={copy.hero.eyebrow}
        title={rich(copy.hero.title)}
        subtitle={copy.hero.subtitle}
        primaryCta={{ label: waiting ? t(cta.labelKey) : copy.hero.primaryCta, href: cta.href }}
        secondaryCta={{ label: copy.hero.secondaryCta, href: "/planos" }}
        note={copy.hero.note}
        highlights={copy.hero.highlights}
        media={
          <ProductFrame glow>
            <DataVizPlaceholder label={copy.hero.mediaLabel} />
          </ProductFrame>
        }
      />
      <ProcessSteps
        eyebrow={copy.steps.eyebrow}
        title={copy.steps.title}
        variant="icon"
        steps={copy.steps.items.map((step, index) => {
          const Icon = STEP_ICONS[index % STEP_ICONS.length];
          return { ...step, icon: <Icon size="medium" />, tone: toneAt(index) };
        })}
      />
      <Cta
        title={copy.cta.title}
        subtitle={copy.cta.subtitle}
        cta={{ label: waiting ? t(cta.labelKey) : copy.cta.label, href: cta.href }}
      />
    </>
  );
}
